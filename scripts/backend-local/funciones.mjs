// Emulación local de las Edge Functions (mismo contrato que supabase/functions/*).
const DOMINIO = process.env.VITE_DOMINIO_USUARIOS ?? 'usuarios.flota-ip.invalid';
const RE_USUARIO = /^[a-z0-9._-]{3,32}$/;

function rechazo(estado, error) {
  return { estado, cuerpo: { error } };
}

async function perfilQueLlama(db, ctx) {
  if (ctx.rol !== 'authenticated') return null;
  const r = await db.query(`select * from public.perfiles where id = $1 and activo`, [ctx.claims.sub]);
  return r.rows[0] ?? null;
}

function validarClave(rol, clave) {
  if (rol === 'chofer') {
    if (!/^\d{6}$/.test(clave ?? '')) return 'El PIN del chofer debe tener 6 dígitos.';
  } else if ((clave ?? '').length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  return null;
}

export async function adminUsuarios(db, ctx, cuerpo) {
  const quien = await perfilQueLlama(db, ctx);
  if (!quien || !['superusuario', 'flota'].includes(quien.rol)) {
    return rechazo(403, 'Solo el superusuario (o flota, para choferes) puede gestionar usuarios.');
  }
  const esSuper = quien.rol === 'superusuario';

  if (cuerpo.accion === 'crear') {
    const rol = cuerpo.rol ?? 'chofer';
    if (!['superusuario', 'flota', 'chofer', 'consulta'].includes(rol)) return rechazo(400, 'Rol no válido.');
    if (!esSuper && rol !== 'chofer') return rechazo(403, 'Flota solo puede crear choferes.');
    const nombre = (cuerpo.nombre ?? '').trim();
    if (!nombre) return rechazo(400, 'Escribe el nombre.');
    const usuario = (cuerpo.usuario ?? '').trim().toLowerCase() || null;
    if (usuario && !RE_USUARIO.test(usuario)) return rechazo(400, 'El usuario solo admite minúsculas, números, punto, guion y guion bajo (3 a 32).');
    const correo = (cuerpo.correo ?? '').trim().toLowerCase() || (usuario ? `${usuario}@${DOMINIO}` : null);
    if (!correo) return rechazo(400, 'Indica un usuario o un correo.');
    const errClave = validarClave(rol, cuerpo.clave);
    if (errClave) return rechazo(400, errClave);
    if (usuario) {
      const ya = await db.query(`select 1 from public.perfiles where usuario = $1`, [usuario]);
      if (ya.rows.length) return rechazo(409, `El usuario "${usuario}" ya existe.`);
    }
    const yaCorreo = await db.query(`select 1 from auth.users where lower(email) = $1`, [correo]);
    if (yaCorreo.rows.length) return rechazo(409, 'Ya hay un usuario con ese correo.');
    const r = await db.query(
      `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
       values ($1, extensions.crypt($2, extensions.gen_salt('bf', 4)), now(), $3, $4) returning id`,
      [correo, cuerpo.clave, JSON.stringify({ provider: 'email', providers: ['email'], rol }), JSON.stringify({ nombre, usuario })],
    );
    const id = r.rows[0].id;
    if (cuerpo.telefono) await db.query(`update public.perfiles set telefono = $2 where id = $1`, [id, cuerpo.telefono]);
    return { estado: 200, cuerpo: { id } };
  }

  const objetivo = cuerpo.id
    ? (await db.query(`select * from public.perfiles where id = $1`, [cuerpo.id])).rows[0]
    : null;
  if (!objetivo) return rechazo(404, 'El usuario no existe.');
  if (!esSuper && objetivo.rol !== 'chofer') return rechazo(403, 'Flota solo puede gestionar choferes.');

  if (cuerpo.accion === 'actualizar') {
    if (cuerpo.rol && cuerpo.rol !== objetivo.rol) {
      if (!esSuper) return rechazo(403, 'Solo el superusuario cambia roles.');
      if (objetivo.id === quien.id) return rechazo(400, 'No puedes cambiar tu propio rol.');
    }
    if (cuerpo.activo === false && objetivo.id === quien.id) return rechazo(400, 'No puedes desactivar tu propio usuario.');
    await db.query(
      `update public.perfiles set nombre = coalesce($2, nombre), telefono = coalesce($3, telefono),
              rol = coalesce($4::public.rol_usuario, rol), activo = coalesce($5, activo) where id = $1`,
      [objetivo.id, cuerpo.nombre?.trim() || null, cuerpo.telefono ?? null, cuerpo.rol ?? null, cuerpo.activo ?? null],
    );
    await db.query(
      `update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('rol', (select rol from public.perfiles where id = $1)),
              banned_until = case when (select activo from public.perfiles where id = $1) then null else 'infinity'::timestamptz end
        where id = $1`,
      [objetivo.id],
    );
    return { estado: 200, cuerpo: { id: objetivo.id } };
  }

  if (cuerpo.accion === 'clave') {
    const errClave = validarClave(objetivo.rol, cuerpo.clave);
    if (errClave) return rechazo(400, errClave);
    await db.query(
      `update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf', 4)), updated_at = now() where id = $1`,
      [objetivo.id, cuerpo.clave],
    );
    return { estado: 200, cuerpo: { id: objetivo.id } };
  }
  return rechazo(400, 'Acción no válida.');
}

/** Igual que la Edge Function: consulta ve.dolarapi.com o guarda una tasa manual. */
export async function tasaBcv(db, ctx, cuerpo) {
  const quien = await perfilQueLlama(db, ctx);
  if (!quien || !['superusuario', 'flota'].includes(quien.rol)) return rechazo(403, 'Solo flota puede actualizar la tasa.');
  if (cuerpo.manual) {
    const valor = Number(cuerpo.manual);
    if (!(valor > 0) || !cuerpo.fecha) return rechazo(400, 'Indica la fecha y una tasa mayor que cero.');
    await db.query(
      `insert into public.tasas_bcv (fecha, bs_por_usd, fuente, manual, created_by) values ($1, $2, 'manual', true, $3)
       on conflict (fecha) do update set bs_por_usd = excluded.bs_por_usd, fuente = 'manual', manual = true, capturada_at = now()`,
      [cuerpo.fecha, valor, quien.id],
    );
    return { estado: 200, cuerpo: { fecha: cuerpo.fecha, bs_por_usd: valor, fuente: 'manual' } };
  }
  try {
    const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`La API respondió ${r.status}`);
    const datos = await r.json();
    const valor = Number(datos.promedio);
    if (!(valor > 0)) throw new Error('La API no trajo el promedio.');
    const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date(datos.fechaActualizacion));
    await db.query(
      `insert into public.tasas_bcv (fecha, bs_por_usd, fuente, manual) values ($1, $2, 've.dolarapi.com', false)
       on conflict (fecha) do update set bs_por_usd = excluded.bs_por_usd, fuente = excluded.fuente, manual = false, capturada_at = now()`,
      [fecha, valor],
    );
    return { estado: 200, cuerpo: { fecha, bs_por_usd: valor, fuente: 've.dolarapi.com' } };
  } catch (e) {
    return rechazo(502, `No se pudo consultar la tasa BCV (${e.message}). Escríbela a mano.`);
  }
}
