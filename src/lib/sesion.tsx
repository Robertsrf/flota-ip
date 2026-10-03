import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { correoDeUsuario, supabase } from './supabase';
import type { Tables } from './database.types';

export type Perfil = Tables<'perfiles'>;
export type Rol = Perfil['rol'];

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  rol: Rol | null;
  esOficina: boolean;
  esSuper: boolean;
  esChofer: boolean;
  puedeEscribir: boolean;
  entrar: (usuario: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const Contexto = createContext<EstadoSesion | null>(null);

const CLAVE_INTENTOS = 'flota-intentos';
const MAX_INTENTOS = 5;
const ESPERA_MS = 30_000;

function leerIntentos(): { n: number; hasta: number } {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_INTENTOS) ?? 'null') as { n: number; hasta: number } | null;
    return v ?? { n: 0, hasta: 0 };
  } catch {
    return { n: 0, hasta: 0 };
  }
}

function guardarIntentos(v: { n: number; hasta: number }) {
  try {
    localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(v));
  } catch {
    /* sin almacenamiento: solo queda el límite del servidor */
  }
}

/** Segundos de espera tras varios intentos fallidos (además del límite del servidor) */
export function esperaRestante(): number {
  const { hasta } = leerIntentos();
  return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const qc = useQueryClient();

  const cargarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase.from('perfiles').select('*').eq('id', s.user.id).maybeSingle();
    setPerfil(data ?? null);
  }, []);

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return;
      setSesion(data.session);
      await cargarPerfil(data.session);
      if (activo) setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s);
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') void cargarPerfil(s);
      if (evento === 'SIGNED_OUT') {
        setPerfil(null);
        qc.clear();
      }
    });
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil, qc]);

  const entrar = useCallback(
    async (usuario: string, clave: string) => {
      const espera = esperaRestante();
      if (espera > 0) throw new Error(`Demasiados intentos. Espera ${espera} s y vuelve a intentar.`);
      const { data, error } = await supabase.auth.signInWithPassword({ email: correoDeUsuario(usuario), password: clave });
      if (error) {
        const n = leerIntentos().n + 1;
        guardarIntentos(n >= MAX_INTENTOS ? { n: 0, hasta: Date.now() + ESPERA_MS } : { n, hasta: 0 });
        throw error;
      }
      guardarIntentos({ n: 0, hasta: 0 });
      setSesion(data.session);
      await cargarPerfil(data.session);
    },
    [cargarPerfil],
  );

  const salir = useCallback(async () => {
    await supabase.auth.signOut();
    setSesion(null);
    setPerfil(null);
    qc.clear();
  }, [qc]);

  const valor = useMemo<EstadoSesion>(() => {
    const rol = perfil?.activo ? perfil.rol : null;
    return {
      cargando,
      sesion,
      perfil,
      rol,
      esOficina: rol === 'superusuario' || rol === 'flota',
      esSuper: rol === 'superusuario',
      esChofer: rol === 'chofer',
      puedeEscribir: rol === 'superusuario' || rol === 'flota' || rol === 'chofer',
      entrar,
      salir,
      recargarPerfil: () => cargarPerfil(sesion),
    };
  }, [cargando, sesion, perfil, entrar, salir, cargarPerfil]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error('useSesion fuera de ProveedorSesion');
  return c;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  superusuario: 'Superusuario',
  flota: 'Flota',
  chofer: 'Chofer',
  consulta: 'Consulta',
};
