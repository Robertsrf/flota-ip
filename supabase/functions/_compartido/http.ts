// Utilidades comunes de las Edge Functions de Flota IP
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Orígenes que pueden llamar a las funciones desde el navegador, separados por coma
// (p. ej. "https://usuario.github.io,https://flota.dominio.com"). Sin configurar, cualquiera:
// no es un riesgo de CSRF porque la sesión viaja en el encabezado Authorization, no en cookies.
const ORIGENES = (Deno.env.get('ORIGENES_APP') ?? '').split(',').map((o) => o.trim()).filter(Boolean);

export function cors(req: Request): Record<string, string> {
  const origen = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.length === 0 ? '*' : ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function respuesta(req: Request, estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Error inesperado: el detalle queda en los logs de la función, al cliente le llega un mensaje genérico */
export function errorInterno(req: Request, e: unknown): Response {
  console.error(e);
  return respuesta(req, 500, { error: 'Error inesperado en el servidor. Intenta de nuevo; si sigue, avisa al superusuario.' });
}

/** Compara secretos sin filtrar por tiempo cuántos caracteres coinciden */
export function mismoSecreto(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferencia === 0;
}

export function variable(nombre: string): string {
  const v = Deno.env.get(nombre);
  if (!v) throw new Error(`Falta la variable ${nombre}`);
  return v;
}

/** Cliente con la llave de servicio: solo vive aquí, nunca en el navegador */
export function clienteServicio(): SupabaseClient {
  const llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? variable('SUPABASE_SECRET_KEY');
  return createClient(variable('SUPABASE_URL'), llave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface Perfil {
  id: string;
  nombre: string;
  rol: 'superusuario' | 'flota' | 'chofer' | 'consulta';
  activo: boolean;
}

/** Perfil activo de quien llama (a partir de su JWT), o null */
export async function perfilQueLlama(req: Request, servicio: SupabaseClient): Promise<Perfil | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await servicio.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await servicio.from('perfiles').select('id, nombre, rol, activo').eq('id', data.user.id).eq('activo', true).maybeSingle();
  return (perfil as Perfil | null) ?? null;
}
