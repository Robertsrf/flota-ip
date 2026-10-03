// Cola offline (D4, nivel 2): iniciar y finalizar ruta, repostar y registrar
// gastos funcionan sin señal. Cada registro lleva su id generado en el
// teléfono, así que reenviarlo no lo duplica (T12). Safari no tiene
// Background Sync: la cola se vacía al abrir la app, al volver la señal y al
// volver a la pestaña.
import Dexie, { liveQuery, type Table } from 'dexie';
import { useEffect, useState } from 'react';
import { rpc, type NombreRpc } from '../api';
import { traducirError } from '../errores';
import { rutaComprobante, subirArchivo } from '../fotos';
import { supabase } from '../supabase';

export type TipoPendiente = Extract<
  NombreRpc,
  'iniciar_viaje' | 'finalizar_viaje' | 'registrar_repostaje' | 'registrar_mantenimiento' | 'anular_registro'
>;

export interface FotoPendiente {
  /** argumento de la RPC donde va la ruta: p_foto, p_recibo, p_factura */
  campo: string;
  blob: Blob;
}

export interface Pendiente {
  id: string;
  tipo: TipoPendiente;
  args: Record<string, unknown>;
  fotos: FotoPendiente[];
  creado: number;
  intentos: number;
  estado: 'pendiente' | 'error';
  error?: string;
  ayuda?: string;
  usuario: string;
  /** Texto corto para mostrar en la cabina: "Iniciar ruta a Valera" */
  resumen: string;
  /** Datos para pintar el estado local mientras no se envía */
  extra?: Record<string, unknown>;
}

class BaseLocal extends Dexie {
  pendientes!: Table<Pendiente, string>;
  constructor() {
    super('flota-ip');
    this.version(1).stores({ pendientes: 'id, creado, estado, usuario' });
  }
}

export const baseLocal = new BaseLocal();

type Oyente = (enviados: Pendiente[]) => void;
const oyentes = new Set<Oyente>();
export function alSincronizar(fn: Oyente): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

let enCurso: Promise<number> | null = null;

/** Envía lo pendiente en orden. Devuelve cuántos registros siguen en la cola. */
export function sincronizar(): Promise<number> {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return baseLocal.pendientes.count();
    const enviados: Pendiente[] = [];
    const lista = await baseLocal.pendientes.where('usuario').equals(uid).sortBy('creado');
    for (const p of lista) {
      if (p.estado !== 'pendiente') continue;
      try {
        const args = { ...p.args };
        for (const f of p.fotos) {
          const ruta = rutaComprobante(uid, p.id, f.campo, f.blob.type);
          args[f.campo] = await subirArchivo('comprobantes', ruta, f.blob);
        }
        await rpc(p.tipo, args as never);
        await baseLocal.pendientes.delete(p.id);
        enviados.push(p);
      } catch (e) {
        const t = traducirError(e);
        if (t.deRed) {
          await baseLocal.pendientes.update(p.id, { intentos: p.intentos + 1 });
          break; // sin señal: se intenta más tarde, en el mismo orden
        }
        await baseLocal.pendientes.update(p.id, { estado: 'error', error: t.mensaje, ayuda: t.ayuda, intentos: p.intentos + 1 });
      }
    }
    if (enviados.length) oyentes.forEach((fn) => fn(enviados));
    return baseLocal.pendientes.count();
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

/** Guarda el registro en el teléfono e intenta enviarlo de una vez. */
export async function encolar(p: Omit<Pendiente, 'creado' | 'intentos' | 'estado'>): Promise<'enviado' | 'en_cola' | 'rechazado'> {
  await baseLocal.pendientes.put({ ...p, creado: Date.now(), intentos: 0, estado: 'pendiente' });
  await sincronizar();
  const quedo = await baseLocal.pendientes.get(p.id);
  if (!quedo) return 'enviado';
  return quedo.estado === 'error' ? 'rechazado' : 'en_cola';
}

export async function descartar(id: string): Promise<void> {
  await baseLocal.pendientes.delete(id);
}

export async function reintentar(id: string): Promise<void> {
  await baseLocal.pendientes.update(id, { estado: 'pendiente', error: undefined, ayuda: undefined });
  await sincronizar();
}

/** Lista en vivo de lo pendiente del usuario actual */
export function usePendientes(uid: string | null | undefined): Pendiente[] {
  const [lista, setLista] = useState<Pendiente[]>([]);
  useEffect(() => {
    if (!uid) return;
    const sub = liveQuery(() => baseLocal.pendientes.where('usuario').equals(uid).sortBy('creado')).subscribe({
      next: setLista,
      error: () => setLista([]),
    });
    return () => sub.unsubscribe();
  }, [uid]);
  return uid ? lista : [];
}

let instalado = false;
/** Engancha los disparadores de sincronización (una sola vez por pestaña). */
export function instalarSincronizacion(): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('online', () => void sincronizar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizar();
  });
  window.setInterval(() => {
    void baseLocal.pendientes.where('estado').equals('pendiente').count().then((n) => {
      if (n > 0) void sincronizar();
    });
  }, 30_000);
  void sincronizar();
}
