import { supabase } from './supabase';
import type { Database, Tables } from './database.types';

type Funciones = Database['public']['Functions'];
export type NombreRpc = keyof Funciones;

/** Argumentos de una RPC: los opcionales aceptan null (PostgREST los recibe como null) */
export type ArgsRpc<N extends NombreRpc> = Funciones[N]['Args'] extends never
  ? Record<string, never>
  : { [K in keyof Funciones[N]['Args']]: Funciones[N]['Args'][K] | null };

export type RetornoRpc<N extends NombreRpc> = Funciones[N]['Returns'];

/** Llama una función RPC y lanza el error tal cual (se traduce en la interfaz). */
export async function rpc<N extends NombreRpc>(nombre: N, args?: Partial<ArgsRpc<N>>): Promise<RetornoRpc<N>> {
  const limpios = Object.fromEntries(Object.entries(args ?? {}).filter(([, v]) => v !== undefined));
  const { data, error } = await supabase.rpc(nombre, limpios as never);
  if (error) throw error;
  return data as RetornoRpc<N>;
}

// Filas de las vistas que usa la interfaz
export type Unidad = Tables<'v_unidades'>;
export type Viaje = Tables<'v_viajes'>;
export type Repostaje = Tables<'v_repostajes'>;
export type Gasto = Tables<'v_mantenimientos'>;
export type Alerta = Tables<'v_alertas'>;
export type KpiUnidadMes = Tables<'v_kpi_unidad_mes'>;
export type KpiFlotaMes = Tables<'v_kpi_flota_mes'>;
export type MantCategoriaMes = Tables<'v_mant_categoria_mes'>;
export type Ciclo = Tables<'v_ciclos_combustible'>;
export type Auditoria = Tables<'v_auditoria'>;
export type Ubicacion = Tables<'ubicaciones'>;
export type Precio = Tables<'precios_combustible'>;
export type Categoria = Tables<'categorias_mantenimiento'>;
export type TasaBcv = Tables<'tasas_bcv'>;
export type Configuracion = Tables<'configuracion'>;
export type PerfilFila = Tables<'perfiles'>;
export type Recordatorio = Tables<'v_recordatorios'>;
export type Documento = Tables<'v_documentos'>;
export type Situacion = 'vencido' | 'pronto' | 'al_dia' | 'archivado';
export type ResumenUnidad = RetornoRpc<'resumen_unidades'>[number];
export type CostoDestino = RetornoRpc<'costo_por_destino'>[number];
export type CostoRuta = RetornoRpc<'costo_por_ruta'>[number];

export interface Kpis {
  viajes: number;
  km_total: number;
  km: number;
  litros: number;
  costo_viajes: number;
  rendimiento: number | null;
  litros_100km: number | null;
  costo_km_comb: number | null;
  gasto_comb: number;
  gasto_comb_camiones: number;
  gasto_comb_plantas: number;
  litros_plantas: number;
  gasto_mant: number | null;
  gasto_total: number;
  costo_km_total: number | null;
  viajes_incompletos: number;
}

/** Para nombres legibles en listas */
export function nombreUnidad(u: { alias?: string | null; placa?: string | null; nombre?: string | null }): string {
  return u.nombre ?? (u.alias && u.placa ? `${u.alias} (${u.placa})` : (u.placa ?? u.alias ?? '—'));
}
