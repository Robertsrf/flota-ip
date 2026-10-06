// admin-usuarios: crear usuarios, cambiar rol o estado y restablecer PIN/clave.
// Superusuario: todo. Flota: solo choferes (D10). Sin registro público.
// Contrato igual al de scripts/backend-local/funciones.mjs.
import { CORS, clienteServicio, perfilQueLlama, respuesta } from '../_compartido/http.ts';

const ROLES = ['superusuario', 'flota', 'chofer', 'consulta'] as const;
type Rol = (typeof ROLES)[number];
const RE_USUARIO = /^[a-z0-9._-]{3,32}$/;

function validarClave(rol: Rol, clave: unknown): string | null {
  const c = typeof clave === 'string' ? clave : '';
  if (rol === 'chofer') return /^\d{6}$/.test(c) ? null : 'El PIN del chofer debe tener 6 dígitos.';
  return c.length >= 8 ? null : 'La contraseña debe tener al menos 8 caracteres.';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return respuesta(405, { error: 'Método no permitido.' });

  const servicio = clienteServicio();
  const quien = await perfilQueLlama(req, servicio);
  if (!quien || (quien.rol !== 'superusuario' && quien.rol !== 'flota')) {
    return respuesta(403, { error: 'Solo el superusuario (o flota, para choferes) puede gestionar usuarios.' });
  }
  const esSuper = quien.rol === 'superusuario';
  const dominio = Deno.env.get('DOMINIO_USUARIOS') ?? 'usuarios.flota-ip.invalid';
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta(400, { error: 'Cuerpo no válido.' });
  }

  try {
    if (cuerpo.accion === 'crear') {
      const rol = (cuerpo.rol ?? 'chofer') as Rol;
      if (!ROLES.includes(rol)) return respuesta(400, { error: 'Rol no válido.' });
      if (!esSuper && rol !== 'chofer') return respuesta(403, { error: 'Flota solo puede crear choferes.' });
      const nombre = String(cuerpo.nombre ?? '').trim();
      if (!nombre) return respuesta(400, { error: 'Escribe el nombre.' });
      const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase() || null;
      if (usuario && !RE_USUARIO.test(usuario)) {
        return respuesta(400, { error: 'El usuario solo admite minúsculas, números, punto, guion y guion bajo (3 a 32).' });
      }
      const correo = String(cuerpo.correo ?? '').trim().toLowerCase() || (usuario ? `${usuario}@${dominio}` : '');
      if (!correo) return respuesta(400, { error: 'Indica un usuario o un correo.' });
      const errClave = validarClave(rol, cuerpo.clave);
      if (errClave) return respuesta(400, { error: errClave });
      if (usuario) {
        const { data: ya } = await servicio.from('perfiles').select('id').eq('usuario', usuario).maybeSingle();
        if (ya) return respuesta(409, { error: `El usuario "${usuario}" ya existe.` });
      }
      const { data, error } = await servicio.auth.admin.createUser({
        email: correo,
        password: String(cuerpo.clave),
        email_confirm: true,
        app_metadata: { rol },
        user_metadata: { nombre, usuario },
      });
      if (error || !data.user) {
        const ya = /already|registered|exists/i.test(error?.message ?? '');
        return respuesta(ya ? 409 : 400, { error: ya ? 'Ya hay un usuario con ese correo.' : `No se pudo crear: ${error?.message}` });
      }
      if (cuerpo.telefono) await servicio.from('perfiles').update({ telefono: String(cuerpo.telefono) }).eq('id', data.user.id);
      return respuesta(200, { id: data.user.id });
    }

    const { data: objetivo } = await servicio.from('perfiles').select('id, rol, activo').eq('id', String(cuerpo.id ?? '')).maybeSingle();
    if (!objetivo) return respuesta(404, { error: 'El usuario no existe.' });
    if (!esSuper && objetivo.rol !== 'chofer') return respuesta(403, { error: 'Flota solo puede gestionar choferes.' });

    if (cuerpo.accion === 'actualizar') {
      const cambios: Record<string, unknown> = {};
      if (typeof cuerpo.nombre === 'string' && cuerpo.nombre.trim()) cambios.nombre = cuerpo.nombre.trim();
      if ('telefono' in cuerpo) cambios.telefono = cuerpo.telefono ? String(cuerpo.telefono) : null;
      if (cuerpo.rol && cuerpo.rol !== objetivo.rol) {
        if (!esSuper) return respuesta(403, { error: 'Solo el superusuario cambia roles.' });
        if (objetivo.id === quien.id) return respuesta(400, { error: 'No puedes cambiar tu propio rol.' });
        if (!ROLES.includes(cuerpo.rol as Rol)) return respuesta(400, { error: 'Rol no válido.' });
        cambios.rol = cuerpo.rol;
      }
      if (typeof cuerpo.activo === 'boolean' && cuerpo.activo !== objetivo.activo) {
        if (objetivo.id === quien.id) return respuesta(400, { error: 'No puedes desactivar tu propio usuario.' });
        cambios.activo = cuerpo.activo;
      }
      if (Object.keys(cambios).length) {
        const { error } = await servicio.from('perfiles').update(cambios).eq('id', objetivo.id);
        if (error) return respuesta(400, { error: error.message });
      }
      const rolFinal = (cambios.rol as Rol | undefined) ?? objetivo.rol;
      const activoFinal = (cambios.activo as boolean | undefined) ?? objetivo.activo;
      await servicio.auth.admin.updateUserById(objetivo.id, {
        app_metadata: { rol: rolFinal },
        ban_duration: activoFinal ? 'none' : '876000h',
      });
      return respuesta(200, { id: objetivo.id });
    }

    if (cuerpo.accion === 'clave') {
      const errClave = validarClave(objetivo.rol as Rol, cuerpo.clave);
      if (errClave) return respuesta(400, { error: errClave });
      const { error } = await servicio.auth.admin.updateUserById(objetivo.id, { password: String(cuerpo.clave) });
      if (error) return respuesta(400, { error: error.message });
      return respuesta(200, { id: objetivo.id });
    }

    return respuesta(400, { error: 'Acción no válida.' });
  } catch (e) {
    return respuesta(500, { error: e instanceof Error ? e.message : 'Error inesperado.' });
  }
});
