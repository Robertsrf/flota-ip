import { useEffect, useState, useSyncExternalStore } from 'react';

function suscribirRed(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** true si el navegador cree que hay conexión */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirRed, () => navigator.onLine, () => true);
}

/** Fecha actual que se refresca cada `ms` (para "hace 2 h 15 min") */
export function useAhora(ms = 30_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return ahora;
}

export type Tema = 'sistema' | 'claro' | 'oscuro';
const CLAVE_TEMA = 'flota-tema';

function aplicarTema(t: Tema) {
  const oscuro = t === 'oscuro' || (t === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', oscuro);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#121518' : '#0f5b3f');
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      return (localStorage.getItem(CLAVE_TEMA) as Tema | null) ?? 'sistema';
    } catch {
      return 'sistema';
    }
  });
  useEffect(() => {
    aplicarTema(tema);
    if (tema !== 'sistema') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const cb = () => aplicarTema('sistema');
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, [tema]);
  const cambiar = (t: Tema) => {
    setTema(t);
    try {
      localStorage.setItem(CLAVE_TEMA, t);
    } catch {
      /* sin almacenamiento: el tema dura la sesión */
    }
  };
  return [tema, cambiar];
}

/** true si el tema oscuro está aplicado (para los gráficos) */
export function useEsOscuro(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => obs.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

/** Estado sincronizado con un parámetro de la URL (pestañas, filtros) */
export function usePreferenciaLocal<T extends string>(clave: string, inicial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(clave) as T | null) ?? inicial;
    } catch {
      return inicial;
    }
  });
  const cambiar = (n: T) => {
    setV(n);
    try {
      localStorage.setItem(clave, n);
    } catch {
      /* preferencia solo en memoria */
    }
  };
  return [v, cambiar];
}
