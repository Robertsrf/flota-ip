import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && llave);

/** Cliente único. Solo lleva la llave pública: los permisos los pone la RLS. */
export const supabase = createClient<Database>(url ?? 'http://127.0.0.1:54321', llave ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'flota-ip-sesion' },
  realtime: { params: { eventsPerSecond: 5 } },
});

/** Dominio del correo sintético para entrar con usuario + PIN (nunca recibe correos). */
export const DOMINIO_USUARIOS = (import.meta.env.VITE_DOMINIO_USUARIOS as string | undefined) ?? 'usuarios.flota-ip.invalid';

/** true cuando la app corre contra el servidor local sin Realtime */
export const MODO_LOCAL = import.meta.env.VITE_LOCAL === '1';

export function correoDeUsuario(entrada: string): string {
  const t = entrada.trim().toLowerCase();
  return t.includes('@') ? t : `${t}@${DOMINIO_USUARIOS}`;
}

export function esCorreoSintetico(correo: string | null | undefined): boolean {
  return Boolean(correo?.endsWith(`@${DOMINIO_USUARIOS}`));
}
