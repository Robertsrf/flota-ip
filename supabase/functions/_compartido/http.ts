// Utilidades comunes de las Edge Functions de Flota IP
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function respuesta(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
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
