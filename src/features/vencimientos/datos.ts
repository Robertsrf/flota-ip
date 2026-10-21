import { useQuery } from '@tanstack/react-query';
import type { Documento, Recordatorio, Situacion } from '@/lib/api';
import { exigir } from '@/lib/errores';
import { fecha, km as fKm, num } from '@/lib/formato';
import { supabase } from '@/lib/supabase';

const ORDEN: Record<Situacion, number> = { vencido: 0, pronto: 1, al_dia: 2, archivado: 3 };

/** Lo vencido primero, luego lo que está por vencer; dentro de cada grupo, lo más cercano arriba */
function ordenar<T extends { situacion: string | null }>(filas: T[], cercania: (f: T) => number): T[] {
  return [...filas].sort((a, b) => ORDEN[(a.situacion ?? 'al_dia') as Situacion] - ORDEN[(b.situacion ?? 'al_dia') as Situacion] || cercania(a) - cercania(b));
}

/** Qué tan cerca está un servicio, en "días equivalentes" para ordenar (100 km ≈ 1 día) */
const cercaniaServicio = (r: Recordatorio) =>
  Math.min(r.dias_restantes ?? Infinity, r.km_restantes == null ? Infinity : Number(r.km_restantes) / 100);

export function useRecordatorios(unidad?: string | null) {
  return useQuery({
    queryKey: ['vencimientos', 'recordatorios', unidad ?? null],
    queryFn: async () => {
      let q = supabase.from('v_recordatorios').select('*');
      if (unidad) q = q.eq('unidad_id', unidad);
      return ordenar(exigir(await q) as Recordatorio[], cercaniaServicio);
    },
  });
}

export function useDocumentos(filtro: { unidad?: string | null; persona?: string | null } = {}) {
  return useQuery({
    queryKey: ['vencimientos', 'documentos', filtro.unidad ?? null, filtro.persona ?? null],
    queryFn: async () => {
      let q = supabase.from('v_documentos').select('*');
      if (filtro.unidad) q = q.eq('unidad_id', filtro.unidad);
      if (filtro.persona) q = q.eq('persona_id', filtro.persona);
      return ordenar(exigir(await q) as Documento[], (d) => d.dias_restantes ?? Infinity);
    },
  });
}

/** Personas que pueden tener documentos propios (licencia, certificado médico) */
export function usePersonas() {
  return useQuery({
    queryKey: ['perfiles', 'personas'],
    staleTime: 5 * 60_000,
    queryFn: async () => exigir(await supabase.from('perfiles').select('id, nombre, rol, activo').order('nombre')),
  });
}

/** "Faltan 350 km (toca en el km 107.443)" y "toca el 25/10/2026 (en 5 días)" */
export function estadoServicio(r: Recordatorio): string[] {
  const partes: string[] = [];
  if (r.km_restantes != null) {
    const k = Number(r.km_restantes);
    partes.push(k < 0 ? `Se pasó por ${fKm(-k)} (tocaba en el km ${num(r.proximo_km)})` : `Faltan ${fKm(k)} (toca en el km ${num(r.proximo_km)})`);
  }
  if (r.dias_restantes != null) partes.push(estadoFecha(r.dias_restantes, r.proxima_fecha, 'Toca'));
  return partes;
}

/** "Vence el 29/10/2026 (en 9 días)", "Vence hoy", "Venció el 16/10/2026 (hace 4 días)" */
export function estadoFecha(dias: number, cuando: string | null, verbo: 'Toca' | 'Vence'): string {
  if (dias < 0) return `${verbo === 'Toca' ? 'Tocaba' : 'Venció'} el ${fecha(cuando)} (hace ${-dias} ${-dias === 1 ? 'día' : 'días'})`;
  if (dias === 0) return `${verbo} hoy`;
  return `${verbo} el ${fecha(cuando)} (en ${dias} ${dias === 1 ? 'día' : 'días'})`;
}

/** "cada 5.000 km o 120 días, lo que llegue primero" */
export function frecuencia(r: Pick<Recordatorio, 'cada_km' | 'cada_dias'>): string {
  const km = r.cada_km != null ? fKm(r.cada_km) : null;
  const dias = r.cada_dias != null ? `${num(r.cada_dias)} días` : null;
  if (km && dias) return `Cada ${km} o ${dias}, lo que llegue primero`;
  return `Cada ${km ?? dias}`;
}

/** Fracción del intervalo ya consumida (0 a 1), para la barra */
export function avanceServicio(r: Recordatorio): number {
  const fr: number[] = [];
  if (r.cada_km && r.km_restantes != null) fr.push(1 - Number(r.km_restantes) / Number(r.cada_km));
  if (r.cada_dias && r.dias_restantes != null) fr.push(1 - r.dias_restantes / r.cada_dias);
  return Math.min(1, Math.max(0, ...fr));
}
