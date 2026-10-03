// Servidor local que imita a Supabase (REST, Auth, Storage y Functions) sobre
// PGlite con las migraciones reales. Sirve para desarrollar y para las pruebas
// de Playwright sin Docker. NO es para producción.
//
//   node scripts/backend-local/server.mjs              → http://127.0.0.1:54321
//   node scripts/backend-local/server.mjs --with-vite  → además levanta la app
//   node scripts/backend-local/server.mjs --reset      → base nueva con el seed demo
//   node scripts/backend-local/server.mjs --sin-seed   → base nueva sin datos demo
import http from 'node:http';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { crearDb, llamarRpc, listarMigraciones, RAIZ } from '../pglite/db.mjs';
import { adminUsuarios, tasaBcv } from './funciones.mjs';

const args = new Set(process.argv.slice(2));
const PUERTO = Number(process.env.PUERTO_BACKEND ?? 54321);
const SECRETO = 'secreto-local-flota-ip';
const DIR_DB = process.env.DIR_DB_LOCAL ?? join(RAIZ, '.local-db');
const DIR_ARCHIVOS = join(RAIZ, '.local-storage');
const conSeed = !args.has('--sin-seed');

// ----- Base de datos ----------------------------------------------------------
function huellaMigraciones() {
  const h = createHash('sha256');
  for (const f of listarMigraciones()) h.update(readFileSync(join(RAIZ, 'supabase', 'migrations', f)));
  if (conSeed) h.update(readFileSync(join(RAIZ, 'supabase', 'seed.sql')));
  h.update(readFileSync(join(RAIZ, 'scripts', 'pglite', 'shim-supabase.sql')));
  return h.digest('hex');
}

const huella = huellaMigraciones();
const archivoHuella = join(DIR_DB, '..', '.local-db.huella');
const huellaAnterior = existsSync(archivoHuella) ? readFileSync(archivoHuella, 'utf8') : null;
if (args.has('--reset') || args.has('--sin-seed') || huellaAnterior !== huella) {
  rmSync(DIR_DB, { recursive: true, force: true });
  if (huellaAnterior && huellaAnterior !== huella) console.log('Las migraciones cambiaron: se recrea la base local.');
}
console.log('Preparando la base local (PGlite)…');
const db = await crearDb({ seed: conSeed, dataDir: DIR_DB });
writeFileSync(archivoHuella, huella);

// Las peticiones se atienden de a una (PGlite tiene una sola conexión)
let cola = Promise.resolve();
const enSerie = (fn) => {
  const p = cola.then(fn, fn);
  cola = p.catch(() => {});
  return p;
};

// ----- JWT HS256 ------------------------------------------------------------------
const b64url = (b) => Buffer.from(b).toString('base64url');
export function firmarJwt(payload) {
  const cab = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify(payload));
  const firma = createHmac('sha256', SECRETO).update(`${cab}.${cuerpo}`).digest('base64url');
  return `${cab}.${cuerpo}.${firma}`;
}
function leerJwt(token) {
  if (!token) return null;
  const [cab, cuerpo, firma] = token.split('.');
  if (!firma) return null;
  const esperada = createHmac('sha256', SECRETO).update(`${cab}.${cuerpo}`).digest('base64url');
  if (esperada !== firma) return null;
  const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
  if (p.exp && p.exp < Date.now() / 1000) return null;
  return p;
}

const refrescos = new Map(); // refresh_token -> user id

async function usuarioPorId(id) {
  const r = await db.query(`select * from auth.users where id = $1`, [id]);
  return r.rows[0] ?? null;
}

function usuarioPublico(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    app_metadata: u.raw_app_meta_data ?? {},
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_sign_in_at: u.last_sign_in_at,
  };
}

function sesion(u) {
  const ahora = Math.floor(Date.now() / 1000);
  const expira = ahora + 3600;
  const access = firmarJwt({
    sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email,
    app_metadata: u.raw_app_meta_data, user_metadata: u.raw_user_meta_data, iat: ahora, exp: expira,
    session_id: randomUUID(),
  });
  const refresh = randomUUID().replace(/-/g, '');
  refrescos.set(refresh, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: expira, refresh_token: refresh, user: usuarioPublico(u) };
}

// ----- Respuestas -------------------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, prefer, range, x-client-info, accept-profile, content-profile, x-upsert, accept, cache-control, x-supabase-api-version',
  'Access-Control-Expose-Headers': 'content-range, content-type, x-supabase-api-version',
};

function enviar(res, estado, cuerpo, cabeceras = {}) {
  const esTexto = typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo);
  res.writeHead(estado, { ...CORS, ...(esTexto ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...cabeceras });
  if (cuerpo === undefined || cuerpo === null) return res.end();
  res.end(esTexto ? cuerpo : JSON.stringify(cuerpo));
}

function errorPg(res, e, autenticado) {
  const code = e.code ?? 'XX000';
  let estado = 400;
  if (code === '42501') estado = autenticado ? 403 : 401;
  else if (code === '23505' || code === '23503') estado = 409;
  else if (code === 'PGRST116') estado = 406;
  else if (code === 'PGRST202' || code === '42P01' || code === '42883') estado = 404;
  else if (code.startsWith('22') || code.startsWith('23') || code === 'P0001') estado = 400;
  enviar(res, estado, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

async function leerCuerpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  return Buffer.concat(partes);
}

// ----- Contexto de rol (como PostgREST) ------------------------------------------------
function claimsDe(req) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const p = leerJwt(token);
  if (p?.sub && p.role === 'authenticated') return { rol: 'authenticated', claims: p };
  if (p?.role === 'service_role') return { rol: 'service_role', claims: p };
  return { rol: 'anon', claims: { role: 'anon' } };
}

function comoRol(ctx, fn) {
  return enSerie(() => db.transaction(async (tx) => {
    await tx.exec(`set local role ${ctx.rol}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(ctx.claims)]);
    return fn(tx);
  }));
}

// ----- PostgREST mínimo ---------------------------------------------------------------------
const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw Object.assign(new Error(`Identificador no válido: ${s}`), { code: 'PGRST100' });
  return `"${s}"`;
};

function separarLista(txt) {
  // "a,b,(c,d)" respetando paréntesis y comillas
  const out = [];
  let prof = 0;
  let actual = '';
  let comillas = false;
  for (const ch of txt) {
    if (ch === '"') comillas = !comillas;
    if (!comillas && ch === '(') prof++;
    if (!comillas && ch === ')') prof--;
    if (!comillas && ch === ',' && prof === 0) {
      out.push(actual);
      actual = '';
    } else actual += ch;
  }
  if (actual) out.push(actual);
  return out;
}

function valoresIn(txt) {
  const interior = txt.replace(/^\(/, '').replace(/\)$/, '');
  return separarLista(interior).map((v) => v.replace(/^"(.*)"$/, '$1'));
}

function condicion(col, expr, params) {
  let negar = false;
  let e = expr;
  if (e.startsWith('not.')) {
    negar = true;
    e = e.slice(4);
  }
  const punto = e.indexOf('.');
  const op = e.slice(0, punto);
  const valor = e.slice(punto + 1);
  const c = ident(col);
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  let sql;
  switch (op) {
    case 'eq': sql = `${c} = ${p(valor)}`; break;
    case 'neq': sql = `${c} <> ${p(valor)}`; break;
    case 'gt': sql = `${c} > ${p(valor)}`; break;
    case 'gte': sql = `${c} >= ${p(valor)}`; break;
    case 'lt': sql = `${c} < ${p(valor)}`; break;
    case 'lte': sql = `${c} <= ${p(valor)}`; break;
    case 'like': sql = `${c}::text like ${p(valor.replace(/\*/g, '%'))}`; break;
    case 'ilike': sql = `${c}::text ilike ${p(valor.replace(/\*/g, '%'))}`; break;
    case 'is':
      if (!['null', 'true', 'false', 'unknown'].includes(valor)) throw Object.assign(new Error('is no válido'), { code: 'PGRST100' });
      sql = `${c} is ${valor}`;
      break;
    case 'in': {
      const vals = valoresIn(valor);
      sql = vals.length ? `${c}::text in (${vals.map((v) => p(v)).join(', ')})` : 'false';
      break;
    }
    case 'cs': sql = `${c} @> ${p(valor)}`; break;
    case 'ov': sql = `${c} && ${p(valor)}`; break;
    default:
      throw Object.assign(new Error(`Operador no soportado: ${op}`), { code: 'PGRST100' });
  }
  return negar ? `not (${sql})` : sql;
}

function condicionOr(txt, params, unir = ' or ') {
  const interior = txt.replace(/^\(/, '').replace(/\)$/, '');
  const partes = separarLista(interior).map((parte) => {
    if (parte.startsWith('and(')) return `(${condicionOr(parte.slice(3), params, ' and ')})`;
    if (parte.startsWith('or(')) return `(${condicionOr(parte.slice(2), params, ' or ')})`;
    const i = parte.indexOf('.');
    return condicion(parte.slice(0, i), parte.slice(i + 1), params);
  });
  return partes.join(unir);
}

const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function armarWhere(sp, params) {
  const conds = [];
  for (const [k, v] of sp.entries()) {
    if (RESERVADOS.has(k)) continue;
    if (k === 'or') conds.push(`(${condicionOr(v, params)})`);
    else if (k === 'and') conds.push(`(${condicionOr(v, params, ' and ')})`);
    else conds.push(condicion(k, v, params));
  }
  return conds.length ? ` where ${conds.join(' and ')}` : '';
}

function armarSelect(sp) {
  const s = sp.get('select') ?? '*';
  if (s.trim() === '*') return '*';
  return separarLista(s)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      if (c.includes('(')) throw Object.assign(new Error('Recursos anidados no soportados en el servidor local'), { code: 'PGRST100' });
      const [nombre, alias] = c.split(':').reverse();
      return alias ? `${ident(alias)} as ${ident(nombre)}` : ident(nombre);
    })
    .join(', ');
}

function armarOrden(sp) {
  const o = sp.get('order');
  if (!o) return '';
  return ' order by ' + o.split(',').map((parte) => {
    const [col, ...mods] = parte.split('.');
    let sql = ident(col);
    if (mods.includes('desc')) sql += ' desc';
    if (mods.includes('nullsfirst')) sql += ' nulls first';
    if (mods.includes('nullslast')) sql += ' nulls last';
    return sql;
  }).join(', ');
}

async function rest(req, res, url, ctx) {
  const tabla = url.pathname.replace('/rest/v1/', '');
  const sp = url.searchParams;
  const prefer = req.headers.prefer ?? '';
  const quiereObjeto = (req.headers.accept ?? '').includes('vnd.pgrst.object');
  const autenticado = ctx.rol !== 'anon';

  try {
    // RPC
    if (tabla.startsWith('rpc/')) {
      const nombre = tabla.slice(4);
      let argumentos = {};
      if (req.method === 'POST') {
        const cuerpo = (await leerCuerpo(req)).toString();
        argumentos = cuerpo ? JSON.parse(cuerpo) : {};
      } else {
        for (const [k, v] of sp.entries()) argumentos[k] = v;
      }
      const datos = await comoRol(ctx, (tx) => llamarRpc(tx, nombre, argumentos));
      return enviar(res, 200, datos);
    }

    const rel = ident(tabla);
    if (req.method === 'GET' || req.method === 'HEAD') {
      const params = [];
      const where = armarWhere(sp, params);
      const columnas = armarSelect(sp);
      const limite = sp.get('limit') ? ` limit ${Number(sp.get('limit'))}` : '';
      const desde = sp.get('offset') ? ` offset ${Number(sp.get('offset'))}` : '';
      const { filas, total } = await comoRol(ctx, async (tx) => {
        const r = await tx.query(
          `select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) as filas from (select ${columnas} from public.${rel}${where}${armarOrden(sp)}${limite}${desde}) t`,
          params,
        );
        let total = null;
        if (prefer.includes('count=')) {
          const c = await tx.query(`select count(*)::int as n from public.${rel}${where}`, params);
          total = c.rows[0].n;
        }
        return { filas: r.rows[0].filas, total };
      });
      const cab = {};
      if (total !== null) {
        const inicio = Number(sp.get('offset') ?? 0);
        cab['Content-Range'] = filas.length ? `${inicio}-${inicio + filas.length - 1}/${total}` : `*/${total}`;
      }
      if (req.method === 'HEAD') return enviar(res, 200, null, cab);
      if (quiereObjeto) {
        if (filas.length !== 1) {
          return enviar(res, 406, {
            code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${filas.length} rows`, hint: null,
          });
        }
        return enviar(res, 200, filas[0], cab);
      }
      return enviar(res, 200, filas, cab);
    }

    const devolver = prefer.includes('return=representation');
    if (req.method === 'POST') {
      const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '[]');
      const filas = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
      const resultado = await comoRol(ctx, async (tx) => {
        const salida = [];
        for (const fila of filas) {
          const cols = Object.keys(fila);
          const params = cols.map((c) => {
            const v = fila[c];
            return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
          });
          let conflicto = '';
          if (prefer.includes('resolution=merge-duplicates')) {
            const sobre = (sp.get('on_conflict') ?? 'id').split(',').map(ident).join(', ');
            conflicto = ` on conflict (${sobre}) do update set ${cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`;
          } else if (prefer.includes('resolution=ignore-duplicates')) {
            conflicto = ' on conflict do nothing';
          }
          const r = await tx.query(
            `insert into public.${rel} (${cols.map(ident).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})${conflicto} returning to_jsonb(${rel}.*) as fila`,
            params,
          );
          if (r.rows[0]) salida.push(r.rows[0].fila);
        }
        return salida;
      });
      if (!devolver) return enviar(res, 201, null);
      return enviar(res, 201, quiereObjeto ? resultado[0] : resultado);
    }

    if (req.method === 'PATCH') {
      const cambios = JSON.parse((await leerCuerpo(req)).toString() || '{}');
      const cols = Object.keys(cambios);
      const params = cols.map((c) => {
        const v = cambios[c];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
      });
      const where = armarWhere(sp, params);
      const resultado = await comoRol(ctx, async (tx) => {
        const r = await tx.query(
          `update public.${rel} set ${cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ')}${where} returning to_jsonb(${rel}.*) as fila`,
          params,
        );
        return r.rows.map((x) => x.fila);
      });
      if (!devolver) return enviar(res, 204, null);
      return enviar(res, 200, quiereObjeto ? resultado[0] ?? null : resultado);
    }

    if (req.method === 'DELETE') {
      const params = [];
      const where = armarWhere(sp, params);
      const resultado = await comoRol(ctx, async (tx) => {
        const r = await tx.query(`delete from public.${rel}${where} returning to_jsonb(${rel}.*) as fila`, params);
        return r.rows.map((x) => x.fila);
      });
      if (!devolver) return enviar(res, 204, null);
      return enviar(res, 200, resultado);
    }
    return enviar(res, 405, { message: 'Método no soportado' });
  } catch (e) {
    return errorPg(res, e, autenticado);
  }
}

// ----- Auth --------------------------------------------------------------------------------------
async function auth(req, res, url) {
  const ruta = url.pathname.replace('/auth/v1', '');
  try {
    if (ruta === '/token' && req.method === 'POST') {
      const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '{}');
      const tipo = url.searchParams.get('grant_type');
      if (tipo === 'password') {
        const r = await enSerie(() => db.query(
          `select * from auth.users where lower(email) = lower($1)
             and encrypted_password = extensions.crypt($2, encrypted_password)
             and (banned_until is null or banned_until < now())`,
          [cuerpo.email ?? '', cuerpo.password ?? ''],
        ));
        const u = r.rows[0];
        if (!u) return enviar(res, 400, { code: 'invalid_credentials', error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
        await enSerie(() => db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [u.id]));
        return enviar(res, 200, sesion(u));
      }
      if (tipo === 'refresh_token') {
        const id = refrescos.get(cuerpo.refresh_token);
        if (!id) return enviar(res, 400, { code: 'refresh_token_not_found', error: 'invalid_grant', error_description: 'Invalid Refresh Token', msg: 'Invalid Refresh Token' });
        refrescos.delete(cuerpo.refresh_token);
        const u = await enSerie(() => usuarioPorId(id));
        return enviar(res, 200, sesion(u));
      }
      return enviar(res, 400, { error: 'unsupported_grant_type' });
    }
    if (ruta === '/user') {
      const p = leerJwt((req.headers.authorization ?? '').replace('Bearer ', ''));
      if (!p?.sub) return enviar(res, 401, { code: 'no_authorization', msg: 'This endpoint requires a valid Bearer token' });
      if (req.method === 'PUT') {
        const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '{}');
        if (cuerpo.password) {
          await enSerie(() => db.query(
            `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4)), updated_at = now() where id = $1`,
            [p.sub, cuerpo.password],
          ));
        }
      }
      const u = await enSerie(() => usuarioPorId(p.sub));
      return enviar(res, 200, usuarioPublico(u));
    }
    if (ruta === '/logout') return enviar(res, 204, null);
    if (ruta === '/settings') return enviar(res, 200, { external: { email: true }, disable_signup: true });
    return enviar(res, 404, { msg: 'No disponible en el servidor local' });
  } catch (e) {
    return enviar(res, 500, { msg: e.message });
  }
}

// ----- Storage -----------------------------------------------------------------------------------------
const tokensFirmados = new Map();

/** Extrae el archivo de un cuerpo multipart/form-data (lo que envía storage-js con un Blob). */
function archivoDeMultipart(cuerpo, tipoContenido) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(tipoContenido);
  if (!m) return { datos: cuerpo, tipo: 'application/octet-stream' };
  const limite = Buffer.from('--' + (m[1] ?? m[2]));
  let inicio = cuerpo.indexOf(limite);
  while (inicio !== -1) {
    const siguiente = cuerpo.indexOf(limite, inicio + limite.length);
    if (siguiente === -1) break;
    const parte = cuerpo.subarray(inicio + limite.length + 2, siguiente - 2);
    const finCab = parte.indexOf('\r\n\r\n');
    const cab = parte.subarray(0, finCab).toString();
    if (/filename=/i.test(cab)) {
      const tipo = /content-type:\s*([^\r\n]+)/i.exec(cab)?.[1] ?? 'application/octet-stream';
      return { datos: parte.subarray(finCab + 4), tipo };
    }
    inicio = siguiente;
  }
  return { datos: cuerpo, tipo: 'application/octet-stream' };
}

function rutaSegura(bucket, ruta) {
  const completa = normalize(join(DIR_ARCHIVOS, bucket, ruta));
  if (!completa.startsWith(normalize(DIR_ARCHIVOS))) throw new Error('Ruta no válida');
  return completa;
}

async function storage(req, res, url, ctx) {
  const ruta = decodeURIComponent(url.pathname.replace('/storage/v1', ''));
  try {
    let m = ruta.match(/^\/object\/sign\/([^/]+)$/);
    if (m && req.method === 'POST') {
      const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '{}');
      const salida = (cuerpo.paths ?? []).map((p) => {
        const token = randomUUID();
        tokensFirmados.set(token, { bucket: m[1], ruta: p });
        return { path: p, signedURL: `/object/sign/${m[1]}/${p}?token=${token}`, error: null };
      });
      return enviar(res, 200, salida);
    }
    m = ruta.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
    if (m && req.method === 'POST') {
      if (ctx.rol === 'anon') return enviar(res, 401, { message: 'No autorizado' });
      const token = randomUUID();
      tokensFirmados.set(token, { bucket: m[1], ruta: m[2] });
      return enviar(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=${token}` });
    }
    if (m && req.method === 'GET') {
      const t = tokensFirmados.get(url.searchParams.get('token'));
      if (!t) return enviar(res, 400, { message: 'Token no válido' });
      const archivo = rutaSegura(t.bucket, t.ruta);
      if (!existsSync(archivo)) return enviar(res, 404, { message: 'No existe' });
      const meta = existsSync(archivo + '.tipo') ? readFileSync(archivo + '.tipo', 'utf8') : 'application/octet-stream';
      return enviar(res, 200, readFileSync(archivo), { 'Content-Type': meta, 'Cache-Control': 'max-age=3600' });
    }
    m = ruta.match(/^\/object\/([^/]+)\/(.+)$/);
    if (m && (req.method === 'POST' || req.method === 'PUT')) {
      if (ctx.rol === 'anon') return enviar(res, 401, { message: 'No autorizado' });
      const archivo = rutaSegura(m[1], m[2]);
      if (existsSync(archivo) && req.headers['x-upsert'] !== 'true' && req.method === 'POST') {
        return enviar(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      }
      mkdirSync(dirname(archivo), { recursive: true });
      const crudo = await leerCuerpo(req);
      const tipoCab = req.headers['content-type'] ?? 'application/octet-stream';
      const { datos, tipo } = tipoCab.startsWith('multipart/form-data')
        ? archivoDeMultipart(crudo, tipoCab)
        : { datos: crudo, tipo: tipoCab };
      writeFileSync(archivo, datos);
      writeFileSync(archivo + '.tipo', tipo);
      return enviar(res, 200, { Key: `${m[1]}/${m[2]}`, Id: randomUUID() });
    }
    m = ruta.match(/^\/object\/([^/]+)$/);
    if (m && req.method === 'DELETE') {
      const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '{}');
      for (const p of cuerpo.prefixes ?? []) rmSync(rutaSegura(m[1], p), { force: true });
      return enviar(res, 200, []);
    }
    return enviar(res, 404, { message: 'No disponible en el servidor local' });
  } catch (e) {
    return enviar(res, 500, { message: e.message });
  }
}

// ----- Funciones --------------------------------------------------------------------------------------------
async function funciones(req, res, url, ctx) {
  const nombre = url.pathname.replace('/functions/v1/', '');
  const cuerpo = JSON.parse((await leerCuerpo(req)).toString() || '{}');
  try {
    let r;
    if (nombre === 'admin-usuarios') r = await enSerie(() => adminUsuarios(db, ctx, cuerpo));
    else if (nombre === 'tasa-bcv') r = await enSerie(() => tasaBcv(db, ctx, cuerpo));
    else return enviar(res, 404, { error: 'Función no encontrada' });
    return enviar(res, r.estado ?? 200, r.cuerpo);
  } catch (e) {
    return enviar(res, 500, { error: e.message });
  }
}

// ----- Servidor ---------------------------------------------------------------------------------------------------
const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return enviar(res, 204, null);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const ctx = claimsDe(req);
  if (url.pathname.startsWith('/rest/v1/')) return rest(req, res, url, ctx);
  if (url.pathname.startsWith('/auth/v1/')) return auth(req, res, url);
  if (url.pathname.startsWith('/storage/v1/')) return storage(req, res, url, ctx);
  if (url.pathname.startsWith('/functions/v1/')) return funciones(req, res, url, ctx);
  if (url.pathname === '/salud') return enviar(res, 200, { ok: true });
  return enviar(res, 404, { message: 'Ruta no disponible en el servidor local' });
});

// Realtime no está disponible: se rechaza el websocket y la app consulta cada 30 s
servidor.on('upgrade', (_req, socket) => socket.destroy());

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Servidor local de Flota IP en http://127.0.0.1:${PUERTO}`);
  if (conSeed) console.log('Usuarios demo: demo.super / demo1234 · demo.flota / demo1234 · demo.gerencia / demo1234 · demo.pedro / 123456');
  if (args.has('--with-vite')) {
    const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--host', '127.0.0.1'], {
      cwd: RAIZ,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: `http://127.0.0.1:${PUERTO}`,
        VITE_SUPABASE_ANON_KEY: 'llave-local-de-prueba',
        VITE_DOMINIO_USUARIOS: 'usuarios.flota-ip.invalid',
        VITE_LOCAL: '1',
      },
    });
    const cerrar = () => {
      vite.kill();
      process.exit(0);
    };
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
  }
});

