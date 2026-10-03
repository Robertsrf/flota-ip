// Base de datos local con las migraciones reales sobre PGlite.
// La usan las pruebas SQL (Vitest) y el servidor local (scripts/backend-local).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (ruta) => readFileSync(join(RAIZ, ruta), 'utf8');

export function listarMigraciones() {
  return readdirSync(join(RAIZ, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Crea una base nueva (en memoria o en disco) con el shim de Supabase,
 * todas las migraciones y, opcionalmente, el seed de demostración.
 */
export async function crearDb({ seed = false, dataDir } = {}) {
  const yaExiste = dataDir && existsSync(join(dataDir, 'PG_VERSION'));
  const db = await PGlite.create({ dataDir, extensions: { pgcrypto } });
  if (yaExiste) return db;
  await db.exec(leer('scripts/pglite/shim-supabase.sql'));
  for (const archivo of listarMigraciones()) {
    try {
      await db.exec(leer(join('supabase', 'migrations', archivo)));
    } catch (e) {
      e.message = `[${archivo}] ${e.message}`;
      throw e;
    }
  }
  if (seed) await db.exec(leer('supabase/seed.sql'));
  return db;
}

/** Ejecuta fn como un usuario autenticado (RLS activa), igual que PostgREST. */
export async function comoUsuario(db, uid, fn, rol = 'authenticated') {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${rol === 'anon' ? 'anon' : rol === 'service_role' ? 'service_role' : 'authenticated'}`);
    const claims = uid ? { sub: uid, role: rol } : { role: rol };
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    return fn(tx);
  });
}

/** Crea un usuario de Auth (el trigger crea su perfil). */
export async function crearUsuario(db, { email, password = 'clave123', nombre, usuario = null, rol = 'chofer' }) {
  const r = await db.query(
    `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
     values ($1, extensions.crypt($2, extensions.gen_salt('bf', 4)), now(), $3, $4)
     returning id`,
    [email, password, JSON.stringify({ provider: 'email', providers: ['email'], rol }), JSON.stringify({ nombre, usuario })],
  );
  return r.rows[0].id;
}

/** Convierte un valor JS en el texto que Postgres entiende como parámetro. */
export function aParametro(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    return '{' + v.map((x) => (x === null ? 'NULL' : '"' + String(x).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"')).join(',') + '}';
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const cacheFirmas = new Map();

/** Datos de la función (tipo de retorno) para devolver lo mismo que PostgREST. */
async function firmaFuncion(tx, nombre) {
  if (cacheFirmas.has(nombre)) return cacheFirmas.get(nombre);
  const r = await tx.query(
    `select p.proretset as conjunto, t.typtype as tipo, t.typname as nombre_tipo
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       join pg_type t on t.oid = p.prorettype
      where n.nspname = 'public' and p.proname = $1
      limit 1`,
    [nombre],
  );
  if (!r.rows.length) {
    const e = new Error(`Could not find the function public.${nombre}`);
    e.code = 'PGRST202';
    throw e;
  }
  cacheFirmas.set(nombre, r.rows[0]);
  return r.rows[0];
}

/**
 * Llama una función de public con argumentos con nombre y devuelve el
 * resultado con la misma forma que PostgREST: objeto (compuesto), arreglo
 * (setof / table), valor (escalar) o null (void).
 */
export async function llamarRpc(tx, nombre, args = {}) {
  if (!/^[a-z_][a-z0-9_]*$/.test(nombre)) throw new Error('Nombre de función no válido');
  const firma = await firmaFuncion(tx, nombre);
  const claves = Object.keys(args).filter((k) => args[k] !== undefined);
  for (const k of claves) if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error('Argumento no válido: ' + k);
  const lista = claves.map((k, i) => `${k} => $${i + 1}`).join(', ');
  const valores = claves.map((k) => aParametro(args[k]));
  const llamada = `public.${nombre}(${lista})`;

  if (firma.nombre_tipo === 'void') {
    await tx.query(`select ${llamada}`, valores);
    return null;
  }
  if (firma.conjunto || firma.tipo === 'c') {
    const r = await tx.query(`select to_jsonb(t) as r from ${llamada} t`, valores);
    const filas = r.rows.map((x) => x.r);
    if (firma.conjunto) return filas;
    const unica = filas[0] ?? null;
    // Un compuesto nulo (función que devolvió null) llega con todos los campos en null
    if (unica && Object.values(unica).every((x) => x === null)) return null;
    return unica;
  }
  const r = await tx.query(`select to_jsonb(${llamada}) as r`, valores);
  return r.rows[0]?.r ?? null;
}
