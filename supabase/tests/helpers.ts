import type { PGlite } from '@electric-sql/pglite';
import { crearDb, crearUsuario, comoUsuario, llamarRpc } from '../../scripts/pglite/db.mjs';

export type Fila = Record<string, unknown>;

export interface Escenario {
  db: PGlite;
  u: { super: string; flota: string; consulta: string; chofer1: string; chofer2: string };
  l: { sede: string; valera: string; maracaibo: string; merida: string; otro: string };
  p: { p050: string; p060: string };
}

export const uuid = () => crypto.randomUUID();

/** Base nueva con usuarios de cada rol, ubicaciones y los dos precios. */
export async function escenario(): Promise<Escenario> {
  const db = await crearDb();
  const u = {
    super: await crearUsuario(db, { email: 'roberts@ejemplo.test', nombre: 'Roberts', rol: 'superusuario' }),
    flota: await crearUsuario(db, { email: 'flota@ejemplo.test', nombre: 'Flota', rol: 'flota' }),
    consulta: await crearUsuario(db, { email: 'gerencia@ejemplo.test', nombre: 'Gerencia', rol: 'consulta' }),
    chofer1: await crearUsuario(db, { email: 'pedro@chofer.test', nombre: 'Pedro', usuario: 'pedro', rol: 'chofer' }),
    chofer2: await crearUsuario(db, { email: 'luis@chofer.test', nombre: 'Luis', usuario: 'luis', rol: 'chofer' }),
  };
  const ub = async (nombre: string, tipo = 'cliente') =>
    (await db.query<{ id: string }>(`insert into public.ubicaciones (nombre, tipo) values ($1, $2) returning id`, [nombre, tipo]))
      .rows[0].id;
  const l = {
    sede: await ub('Sede principal', 'sede'),
    valera: await ub('Valera'),
    maracaibo: await ub('Maracaibo'),
    merida: await ub('Mérida'),
    otro: (await db.query<{ id: string }>(`select id from public.ubicaciones where es_sistema`)).rows[0].id,
  };
  const precios = (await db.query<{ id: string; precio_usd_litro: string }>(`select id, precio_usd_litro from public.precios_combustible`)).rows;
  const p = {
    p050: precios.find((x) => Number(x.precio_usd_litro) === 0.5)!.id,
    p060: precios.find((x) => Number(x.precio_usd_litro) === 0.6)!.id,
  };
  return { db, u, l, p };
}

export async function crearCamion(
  db: PGlite,
  { placa, capacidad = 200, lectura = 10000, inicial = capacidad, min = 1.5, max = 15 }:
  { placa: string; capacidad?: number; lectura?: number; inicial?: number; min?: number; max?: number },
): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.unidades (tipo, placa, alias, capacidad_tanque_l, lectura_inicial, combustible_inicial_l,
                                  rendimiento_min, rendimiento_max, fecha_alta)
     values ('camion', $1, $1, $2, $3, $4, $5, $6, '2026-01-01') returning id`,
    [placa, capacidad, lectura, inicial, min, max],
  );
  return r.rows[0].id;
}

export async function crearPlanta(db: PGlite, nombre: string, capacidad = 100): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.unidades (tipo, alias, medidor, capacidad_tanque_l, combustible, combustible_inicial_l)
     values ('planta', $1, 'ninguno', $2, 'diesel', 0) returning id`,
    [nombre, capacidad],
  );
  return r.rows[0].id;
}

export function rpc<T = Fila>(db: PGlite, uid: string | null, nombre: string, args: Fila = {}): Promise<T> {
  return comoUsuario(db, uid, (tx) => llamarRpc(tx, nombre, args)) as Promise<T>;
}

/** Consulta como el usuario indicado (RLS activa); con uid null, como dueño de la base. */
export async function consultar<T = Fila>(db: PGlite, uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  if (uid === null) return (await db.query<T>(sql, params)).rows;
  return comoUsuario(db, uid, async (tx) => (await tx.query<T>(sql, params)).rows);
}

/** Consulta como visitante sin sesión (rol anon). */
export async function consultarAnon<T = Fila>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return comoUsuario(db, null, async (tx) => (await tx.query<T>(sql, params)).rows, 'anon');
}

export interface ErrorPg extends Error {
  code?: string;
  detail?: string;
  hint?: string;
}

export async function error(promesa: Promise<unknown>): Promise<ErrorPg> {
  try {
    await promesa;
  } catch (e) {
    return e as ErrorPg;
  }
  throw new Error('Se esperaba un error y la operación funcionó');
}

export const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Inicia una ruta como el chofer indicado. */
export function iniciar(
  e: Escenario,
  chofer: string,
  unidad: string,
  datos: { id?: string; km: number; litros?: number; fuente?: string; paradas?: string[]; salida?: string },
) {
  return rpc(e.db, chofer, 'iniciar_viaje', {
    p_id: datos.id ?? uuid(),
    p_unidad_id: unidad,
    p_paradas: datos.paradas ?? [e.l.valera],
    p_salida_at: datos.salida ?? '2026-09-10T08:00:00-04:00',
    p_km_salida: datos.km,
    p_litros_salida: datos.litros ?? null,
    p_fuente_nivel: datos.fuente ?? 'lleno',
  });
}

export function finalizar(
  e: Escenario,
  usuario: string,
  viaje: string,
  datos: {
    km: number;
    reposto: boolean;
    litros?: number;
    precio?: string;
    lleno?: boolean;
    aguja?: number | null;
    llegada?: string;
    notas?: string;
    repostajeId?: string;
  },
) {
  return rpc(e.db, usuario, 'finalizar_viaje', {
    p_viaje_id: viaje,
    p_llegada_at: datos.llegada ?? '2026-09-10T15:00:00-04:00',
    p_km_llegada: datos.km,
    p_reposto: datos.reposto,
    p_repostaje_id: datos.repostajeId ?? (datos.reposto ? uuid() : null),
    p_litros: datos.litros ?? null,
    p_precio_id: datos.precio ?? null,
    p_tanque_lleno: datos.lleno ?? true,
    p_litros_aguja: datos.aguja ?? null,
    p_notas: datos.notas ?? null,
  });
}

export function repostar(
  e: Escenario,
  usuario: string,
  unidad: string,
  datos: { lectura: number | null; litros: number; precio: string; lleno?: boolean; fecha?: string; id?: string; omitida?: boolean; motivo?: string },
) {
  return rpc(e.db, usuario, 'registrar_repostaje', {
    p_id: datos.id ?? uuid(),
    p_unidad_id: unidad,
    p_fecha: datos.fecha ?? '2026-09-10T11:00:00-04:00',
    p_lectura: datos.lectura,
    p_litros: datos.litros,
    p_precio_id: datos.precio,
    p_tanque_lleno: datos.lleno ?? true,
    p_carga_previa_omitida: datos.omitida ?? false,
    p_motivo: datos.motivo ?? null,
  });
}
