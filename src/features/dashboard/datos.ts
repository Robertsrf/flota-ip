import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { rpc, type Alerta, type KpiUnidadMes, type Kpis, type MantCategoriaMes, type Unidad } from '@/lib/api';
import { exigir } from '@/lib/errores';
import { supabase } from '@/lib/supabase';
import { INTERVALO_VIVO } from '@/lib/tiempoReal';
import { calcularPeriodo, type ClavePeriodo } from './periodo';

export interface Filtros {
  periodo: ClavePeriodo;
  desde: string | null;
  hasta: string | null;
  unidad: string | null;
  chofer: string | null;
  destino: string | null;
  soloExactos: boolean;
}

/** Filtros del dashboard en la URL (se pueden compartir) */
export function useFiltros() {
  const [p, setP] = useSearchParams();
  const filtros: Filtros = {
    periodo: (p.get('periodo') as ClavePeriodo) ?? 'mes',
    desde: p.get('desde'),
    hasta: p.get('hasta'),
    unidad: p.get('unidad'),
    chofer: p.get('chofer'),
    destino: p.get('destino'),
    soloExactos: p.get('calidad') === 'exactos',
  };
  const cambiar = (cambios: Partial<Record<'periodo' | 'desde' | 'hasta' | 'unidad' | 'chofer' | 'destino' | 'calidad', string | null>>) =>
    setP(
      (actual) => {
        for (const [k, v] of Object.entries(cambios)) {
          if (v === null || v === '') actual.delete(k);
          else actual.set(k, v);
        }
        return actual;
      },
      { replace: true },
    );
  const periodo = useMemo(() => calcularPeriodo(filtros.periodo, filtros.desde, filtros.hasta), [filtros.periodo, filtros.desde, filtros.hasta]);
  return { filtros, periodo, cambiar };
}

function argsFiltros(f: Filtros, desde: string, hasta: string) {
  return {
    p_desde: desde,
    p_hasta: hasta,
    p_unidad: f.unidad,
    p_chofer: f.chofer,
    p_destino: f.destino,
    p_solo_exactos: f.soloExactos,
  };
}

export function useKpis(f: Filtros, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', f, desde, hasta],
    queryFn: async () => (await rpc('kpis_periodo', argsFiltros(f, desde, hasta))) as unknown as Kpis,
  });
}

export function useResumenUnidades(f: Filtros, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'resumen', f, desde, hasta],
    queryFn: async () => rpc('resumen_unidades', argsFiltros(f, desde, hasta)),
  });
}

export function useCostoDestino(f: Filtros, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'destinos', f, desde, hasta],
    queryFn: async () =>
      rpc('costo_por_destino', { p_desde: desde, p_hasta: hasta, p_unidad: f.unidad, p_chofer: f.chofer, p_solo_exactos: f.soloExactos }),
  });
}

export function useCostoRuta(f: Filtros, desde: string, hasta: string) {
  return useQuery({
    queryKey: ['dashboard', 'rutas', f, desde, hasta],
    queryFn: async () =>
      rpc('costo_por_ruta', { p_desde: desde, p_hasta: hasta, p_unidad: f.unidad, p_chofer: f.chofer, p_solo_exactos: f.soloExactos }),
  });
}

export function useKpiMensual(unidad: string | null, desdeMes: string) {
  return useQuery({
    queryKey: ['dashboard', 'mensual', unidad, desdeMes],
    queryFn: async () => {
      let q = supabase.from('v_kpi_unidad_mes').select('*').gte('mes', desdeMes).order('mes');
      if (unidad) q = q.eq('unidad_id', unidad);
      return exigir(await q) as KpiUnidadMes[];
    },
  });
}

export function useMantCategoria(unidad: string | null, desdeMes: string, hastaMes: string) {
  return useQuery({
    queryKey: ['dashboard', 'categorias', unidad, desdeMes, hastaMes],
    queryFn: async () => {
      let q = supabase.from('v_mant_categoria_mes').select('*').gte('mes', desdeMes).lte('mes', hastaMes);
      if (unidad) q = q.eq('unidad_id', unidad);
      return exigir(await q) as MantCategoriaMes[];
    },
  });
}

export function useEnRuta() {
  return useQuery({
    queryKey: ['dashboard', 'en-ruta'],
    refetchInterval: INTERVALO_VIVO,
    queryFn: async () =>
      exigir(await supabase.from('v_unidades').select('*').eq('estado', 'en_ruta').order('viaje_abierto_salida_at')) as Unidad[],
  });
}

export function useAlertas(unidad?: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'alertas', unidad ?? null],
    refetchInterval: INTERVALO_VIVO,
    queryFn: async () => {
      let q = supabase.from('v_alertas').select('*').order('fecha', { ascending: false }).limit(200);
      if (unidad) q = q.eq('unidad_id', unidad);
      return exigir(await q) as Alerta[];
    },
  });
}

export function useOpcionesFiltro() {
  return useQuery({
    queryKey: ['dashboard', 'opciones'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [unidades, choferes, destinos] = await Promise.all([
        supabase.from('unidades').select('id, placa, alias, tipo').order('tipo').order('placa'),
        supabase.from('perfiles').select('id, nombre').eq('rol', 'chofer').order('nombre'),
        supabase.from('ubicaciones').select('id, nombre, tipo, activo').neq('tipo', 'sede').order('nombre'),
      ]);
      return {
        unidades: exigir(unidades),
        choferes: exigir(choferes),
        destinos: exigir(destinos),
      };
    },
  });
}
