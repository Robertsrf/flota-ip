// Genera src/lib/database.types.ts desde las migraciones (vía PGlite), con el mismo
// formato que `supabase gen types typescript`. Cuando el proyecto de Supabase
// exista, puede usarse `npm run gen:types:remote` y el resultado es compatible.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearDb, RAIZ } from './pglite/db.mjs';

const db = await crearDb();
const q = async (sql, params = []) => (await db.query(sql, params)).rows;

const enums = await q(`
  select t.typname as nombre, array_agg(e.enumlabel order by e.enumsortorder) as valores
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' group by t.typname order by t.typname`);
const nombresEnum = new Set(enums.map((e) => e.nombre));

const tablasDeFila = new Map(); // oid de tipo compuesto -> nombre de tabla/vista

function tipoTs(nombreTipo, esArreglo = false) {
  const base = nombreTipo.replace(/^_/, '');
  let ts;
  if (nombresEnum.has(base)) ts = `Database["public"]["Enums"]["${base}"]`;
  else if (['uuid', 'text', 'varchar', 'bpchar', 'date', 'timestamptz', 'timestamp', 'time', 'interval', 'name'].includes(base)) ts = 'string';
  else if (['numeric', 'int2', 'int4', 'int8', 'float4', 'float8'].includes(base)) ts = 'number';
  else if (base === 'bool') ts = 'boolean';
  else if (['json', 'jsonb'].includes(base)) ts = 'Json';
  else if (base === 'void') ts = 'undefined';
  else if (base === 'record') ts = 'Record<string, unknown>';
  else ts = 'unknown';
  return esArreglo || nombreTipo.startsWith('_') ? `${ts}[]` : ts;
}

const relaciones = await q(`
  select c.relname as tabla, c.relkind as tipo, c.reltype as tipo_fila
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v') order by c.relname`);
for (const r of relaciones) tablasDeFila.set(r.tipo_fila, r.tabla);

const columnas = await q(`
  select c.relname as tabla, a.attname as columna, t.typname as tipo, a.attnotnull as no_nulo,
         a.atthasdef as con_default, a.attidentity as identidad, a.attgenerated as generada, a.attnum
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped
  order by c.relname, a.attnum`);

const fks = await q(`
  select con.conname as nombre, c.relname as tabla, cf.relname as referida,
         array(select a.attname from unnest(con.conkey) k join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k) as cols,
         array(select a.attname from unnest(con.confkey) k join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k) as refcols,
         exists (select 1 from pg_index i where i.indrelid = con.conrelid and i.indisunique
                   and i.indkey::int2[] @> con.conkey and cardinality(i.indkey::int2[]) = cardinality(con.conkey)) as uno_a_uno
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_class cf on cf.oid = con.confrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and cf.relnamespace = n.oid
  order by c.relname, con.conname`);

const funciones = await q(`
  select p.proname as nombre, p.proretset as conjunto, rt.typname as tipo_ret, p.prorettype as oid_ret,
         rt.typtype as clase_ret, p.pronargdefaults as n_defaults, p.pronargs as n_args,
         coalesce(p.proargnames, '{}') as nombres, coalesce(p.proargmodes::text[], '{}') as modos,
         array(select t.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u (o, i) join pg_type t on t.oid = u.o order by u.i) as tipos
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
    and rt.typname <> 'trigger'
  order by p.proname`);

const id = (s) => (/^[a-z_][a-z0-9_]*$/i.test(s) ? s : JSON.stringify(s));
const pad = (n) => ' '.repeat(n);

function bloqueTabla(nombre, esVista) {
  const cols = columnas.filter((c) => c.tabla === nombre);
  const row = cols.map((c) => `${pad(10)}${id(c.columna)}: ${tipoTs(c.tipo)}${esVista || !c.no_nulo ? ' | null' : ''}`);
  let out = `${pad(6)}${id(nombre)}: {\n${pad(8)}Row: {\n${row.join('\n')}\n${pad(8)}}\n`;
  if (!esVista) {
    const ins = cols.map((c) => {
      if (c.generada === 's' || c.identidad === 'a') return `${pad(10)}${id(c.columna)}?: never`;
      const opcional = !c.no_nulo || c.con_default || c.identidad === 'd';
      return `${pad(10)}${id(c.columna)}${opcional ? '?' : ''}: ${tipoTs(c.tipo)}${!c.no_nulo ? ' | null' : ''}`;
    });
    const upd = cols.map((c) => {
      if (c.generada === 's' || c.identidad === 'a') return `${pad(10)}${id(c.columna)}?: never`;
      return `${pad(10)}${id(c.columna)}?: ${tipoTs(c.tipo)}${!c.no_nulo ? ' | null' : ''}`;
    });
    out += `${pad(8)}Insert: {\n${ins.join('\n')}\n${pad(8)}}\n${pad(8)}Update: {\n${upd.join('\n')}\n${pad(8)}}\n`;
  }
  const rels = esVista ? [] : fks.filter((f) => f.tabla === nombre);
  const relTxt = rels.map((f) => `${pad(10)}{\n${pad(12)}foreignKeyName: "${f.nombre}"\n${pad(12)}columns: ${JSON.stringify(f.cols)}\n${pad(12)}isOneToOne: ${f.uno_a_uno}\n${pad(12)}referencedRelation: "${f.referida}"\n${pad(12)}referencedColumns: ${JSON.stringify(f.refcols)}\n${pad(10)}},`);
  out += `${pad(8)}Relationships: [${relTxt.length ? `\n${relTxt.join('\n')}\n${pad(8)}` : ''}]\n${pad(6)}}`;
  return out;
}

function bloqueFuncion(f) {
  const entradas = f.nombres
    .map((nombre, i) => ({ nombre, tipo: f.tipos[i], modo: f.modos[i] ?? 'i' }))
    .filter((a) => a.modo === 'i' || a.modo === 'b');
  const salidas = f.nombres
    .map((nombre, i) => ({ nombre, tipo: f.tipos[i], modo: f.modos[i] ?? 'i' }))
    .filter((a) => a.modo === 't' || a.modo === 'o');
  const primeraConDefault = entradas.length - f.n_defaults;
  const args = entradas.map((a, i) => `${pad(10)}${id(a.nombre)}${i >= primeraConDefault ? '?' : ''}: ${tipoTs(a.tipo)}`);
  let ret;
  if (salidas.length) {
    ret = `{\n${salidas.map((s) => `${pad(12)}${id(s.nombre)}: ${tipoTs(s.tipo)} | null`).join('\n')}\n${pad(10)}}[]`;
  } else if (f.clase_ret === 'c' && tablasDeFila.has(f.oid_ret)) {
    const t = tablasDeFila.get(f.oid_ret);
    const seccion = relaciones.find((r) => r.tabla === t)?.tipo === 'v' ? 'Views' : 'Tables';
    ret = `Database["public"]["${seccion}"]["${t}"]["Row"]${f.conjunto ? '[]' : ''}`;
  } else {
    ret = `${tipoTs(f.tipo_ret)}${f.conjunto ? '[]' : ''}`;
  }
  const argsTxt = args.length ? `{\n${args.join('\n')}\n${pad(8)}}` : 'never';
  return `${pad(6)}${id(f.nombre)}: {\n${pad(8)}Args: ${argsTxt}\n${pad(8)}Returns: ${ret}\n${pad(6)}}`;
}

const tablas = relaciones.filter((r) => r.tipo === 'r').map((r) => bloqueTabla(r.tabla, false));
const vistas = relaciones.filter((r) => r.tipo === 'v').map((r) => bloqueTabla(r.tabla, true));
const fnBloques = funciones.map(bloqueFuncion);
const enumBloques = enums.map((e) => `${pad(6)}${e.nombre}: ${e.valores.map((v) => JSON.stringify(v)).join(' | ')}`);
const enumConst = enums.map((e) => `${pad(6)}${e.nombre}: [${e.valores.map((v) => JSON.stringify(v)).join(', ')}],`);

const salida = `// Generado por scripts/gen-types.mjs desde supabase/migrations. No editar a mano.
// Regenerar: npm run gen:types (local) o npm run gen:types:remote (proyecto Supabase).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
${tablas.join('\n')}
    }
    Views: {
${vistas.join('\n')}
    }
    Functions: {
${fnBloques.join('\n')}
    }
    Enums: {
${enumBloques.join('\n')}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"] | keyof PublicSchema["Views"]> =
  T extends keyof PublicSchema["Tables"] ? PublicSchema["Tables"][T]["Row"]
  : T extends keyof PublicSchema["Views"] ? PublicSchema["Views"][T]["Row"] : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
${enumConst.join('\n')}
    },
  },
} as const
`;

writeFileSync(join(RAIZ, 'src', 'lib', 'database.types.ts'), salida);
console.log(`database.types.ts: ${tablas.length} tablas, ${vistas.length} vistas, ${fnBloques.length} funciones, ${enums.length} enums`);
await db.close();
