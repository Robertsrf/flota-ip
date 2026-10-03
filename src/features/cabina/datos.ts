import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rpc, type Categoria, type Precio, type Ubicacion, type Unidad, type Viaje } from '@/lib/api';
import { exigir } from '@/lib/errores';
import { hoyIso } from '@/lib/formato';
import { usePendientes, type Pendiente } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { supabase, MODO_LOCAL } from '@/lib/supabase';

export interface ViajeEnCurso {
  id: string;
  folio_txt: string | null;
  unidad_id: string;
  unidad_nombre: string;
  placa: string | null;
  capacidad: number;
  ruta: string;
  paradas: string[];
  salida_at: string;
  km_salida: number;
  litros_salida: number;
  fuente: string;
  pendiente: boolean;
}

interface ContextoServidor {
  viaje_abierto: Viaje | null;
  ultima_unidad_id: string | null;
  ultimo_viaje: Viaje | null;
}

export function useContextoCabina() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['cabina', sesion?.user.id],
    enabled: Boolean(sesion),
    refetchInterval: MODO_LOCAL ? 30_000 : 60_000,
    queryFn: async () => (await rpc('contexto_cabina')) as unknown as ContextoServidor,
  });
}

/** Estado de la cabina: lo que dice el servidor más lo que espera en la cola del teléfono */
export function useEstadoCabina() {
  const { sesion } = useSesion();
  const ctx = useContextoCabina();
  const pendientes = usePendientes(sesion?.user.id);

  const estado = useMemo(() => {
    const vivos = pendientes.filter((p) => p.estado === 'pendiente');
    const finalizados = new Set(vivos.filter((p) => p.tipo === 'finalizar_viaje').map((p) => p.args.p_viaje_id as string));
    const anulados = new Set(
      vivos.filter((p) => p.tipo === 'anular_registro' && p.args.p_tabla === 'viajes').map((p) => p.args.p_id as string),
    );
    let abierto: ViajeEnCurso | null = null;
    const s = ctx.data?.viaje_abierto;
    if (s && !finalizados.has(s.id!) && !anulados.has(s.id!)) {
      abierto = {
        id: s.id!,
        folio_txt: s.folio_txt,
        unidad_id: s.unidad_id!,
        unidad_nombre: s.unidad_nombre ?? '',
        placa: s.placa,
        capacidad: Number(s.capacidad_tanque_l ?? 0),
        ruta: s.ruta ?? s.destino_nombre ?? '',
        paradas: s.paradas_nombres ?? [],
        salida_at: s.salida_at!,
        km_salida: Number(s.km_salida),
        litros_salida: Number(s.litros_salida),
        fuente: s.fuente_nivel_salida ?? 'lleno',
        pendiente: false,
      };
    }
    if (!abierto) {
      const inicio = [...vivos].reverse().find((p) => p.tipo === 'iniciar_viaje' && !finalizados.has(p.id) && !anulados.has(p.id));
      if (inicio?.extra) {
        const x = inicio.extra as unknown as Omit<ViajeEnCurso, 'pendiente' | 'id' | 'folio_txt'>;
        abierto = { ...x, id: inicio.id, folio_txt: null, pendiente: true };
      }
    }
    const ultimaUnidadLocal = [...vivos].reverse().find((p) => p.tipo === 'iniciar_viaje')?.args.p_unidad_id as string | undefined;
    return {
      abierto,
      ultimaUnidadId: abierto?.unidad_id ?? ultimaUnidadLocal ?? ctx.data?.ultima_unidad_id ?? null,
      ultimoViaje: ctx.data?.ultimo_viaje ?? null,
      pendientes,
    };
  }, [ctx.data, pendientes]);

  return { ...estado, cargando: ctx.isLoading, error: ctx.error, refrescar: ctx.refetch };
}

export function useCamiones() {
  return useQuery({
    queryKey: ['unidades', 'camiones'],
    queryFn: async () =>
      exigir(await supabase.from('v_unidades').select('*').eq('tipo', 'camion').neq('estado', 'inactivo').order('placa')) as Unidad[],
  });
}

export function useUnidad(id: string | null | undefined) {
  return useQuery({
    queryKey: ['unidades', id],
    enabled: Boolean(id),
    queryFn: async () => exigir(await supabase.from('v_unidades').select('*').eq('id', id!).single()) as Unidad,
  });
}

export function useDestinos() {
  return useQuery({
    queryKey: ['ubicaciones', 'activas'],
    staleTime: 5 * 60_000,
    queryFn: async () => exigir(await supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre')) as Ubicacion[],
  });
}

export function usePrecios() {
  return useQuery({
    queryKey: ['precios', 'activos'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      exigir(await supabase.from('precios_combustible').select('*').eq('activo', true).order('orden')) as Precio[],
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias', 'activas'],
    staleTime: 5 * 60_000,
    queryFn: async () =>
      exigir(await supabase.from('categorias_mantenimiento').select('*').eq('activo', true).order('orden')) as Categoria[],
  });
}

/** Precio de la última carga de la unidad (Fleetio lo prellena igual) */
export function useUltimoPrecio(unidadId: string | null | undefined) {
  return useQuery({
    queryKey: ['repostajes', 'ultimo', unidadId],
    enabled: Boolean(unidadId),
    queryFn: async () => {
      const { data } = await supabase
        .from('repostajes')
        .select('precio_id, precio_usd_litro')
        .eq('unidad_id', unidadId!)
        .eq('anulado', false)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
}

export function useSugerenciaNivel(unidadId: string | null | undefined, km: number | null) {
  return useQuery({
    queryKey: ['sugerir-nivel', unidadId, km],
    enabled: Boolean(unidadId) && km !== null,
    queryFn: async () => {
      const r = await rpc('sugerir_nivel_salida', { p_unidad: unidadId!, p_km: km! });
      return r[0] ?? null;
    },
  });
}

export function useCargasViaje(viajeId: string | null | undefined) {
  return useQuery({
    queryKey: ['repostajes', 'viaje', viajeId],
    enabled: Boolean(viajeId),
    queryFn: async () =>
      exigir(await supabase.from('repostajes').select('litros, precio_usd_litro, lectura_medidor').eq('viaje_id', viajeId!).eq('anulado', false)),
  });
}

export function useTasaHoy() {
  return useQuery({
    queryKey: ['tasa', hoyIso()],
    queryFn: async () => (await rpc('tasa_para_fecha', { p_fecha: hoyIso() }))[0] ?? null,
  });
}

/** Ubicaciones usadas en los últimos viajes del chofer, para mostrarlas primero */
export function useDestinosRecientes() {
  const { sesion } = useSesion();
  return useQuery({
    queryKey: ['viajes', 'recientes', sesion?.user.id],
    enabled: Boolean(sesion),
    queryFn: async () => {
      const filas = exigir(
        await supabase.from('v_viajes').select('paradas_ids').eq('chofer_id', sesion!.user.id).order('salida_at', { ascending: false }).limit(15),
      );
      const ids: string[] = [];
      for (const f of filas) for (const id of f.paradas_ids ?? []) if (!ids.includes(id)) ids.push(id);
      return ids;
    },
  });
}

export function resumenPendiente(p: Pendiente): string {
  return p.resumen;
}
