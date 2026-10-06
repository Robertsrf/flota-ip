// Verifica que supabase/sql/limpiar_demo.sql deja la base sin datos demo
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearDb, RAIZ } from './db.mjs';
const db = await crearDb({ seed: true });
const antes = (await db.query(`select (select count(*) from public.viajes)::int v, (select count(*) from public.unidades)::int u, (select count(*) from auth.users)::int us`)).rows[0];
const res = await db.exec(readFileSync(join(RAIZ, 'supabase/sql/limpiar_demo.sql'), 'utf8'));
const despues = (await db.query(`select (select count(*) from public.viajes)::int v, (select count(*) from public.unidades)::int u, (select count(*) from auth.users)::int us,
  (select count(*) from public.ubicaciones where not es_sistema)::int ub, (select count(*) from public.tasas_bcv)::int t, (select count(*) from public.precios_combustible)::int p`)).rows[0];
console.log('antes', antes, 'después', despues, 'verificación', res.at(-1).rows[0]);
