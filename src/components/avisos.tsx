import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'error' | 'info';
  accion?: { texto: string; alHacer: () => void };
  duracion: number;
}

interface ApiAvisos {
  mostrar: (texto: string, opciones?: Partial<Omit<Aviso, 'id' | 'texto'>>) => void;
  ok: (texto: string, accion?: Aviso['accion'], duracion?: number) => void;
  error: (texto: string) => void;
}

const Contexto = createContext<ApiAvisos | null>(null);

/** Avisos breves al pie ("Ruta iniciada · Deshacer"). Se anuncian a lectores de pantalla. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const siguiente = useRef(1);

  const quitar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);

  const mostrar = useCallback<ApiAvisos['mostrar']>(
    (texto, op = {}) => {
      const id = siguiente.current++;
      const aviso: Aviso = { id, texto, tipo: op.tipo ?? 'info', accion: op.accion, duracion: op.duracion ?? (op.accion ? 10_000 : 4_000) };
      setAvisos((a) => [...a.slice(-2), aviso]);
      window.setTimeout(() => quitar(id), aviso.duracion);
    },
    [quitar],
  );

  const api = useMemo<ApiAvisos>(
    () => ({
      mostrar,
      ok: (texto, accion, duracion) => mostrar(texto, { tipo: 'ok', accion, duracion }),
      error: (texto) => mostrar(texto, { tipo: 'error', duracion: 7_000 }),
    }),
    [mostrar],
  );

  return (
    <Contexto.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border-2 px-4 py-3 shadow-panel
              ${a.tipo === 'error' ? 'border-peligro bg-peligro text-peligro-tinta' : 'border-tinta bg-tinta text-superficie'}`}
          >
            {a.tipo === 'error' ? <CircleAlert aria-hidden className="size-5 shrink-0" /> : <CircleCheck aria-hidden className="size-5 shrink-0" />}
            <p className="flex-1 text-base font-semibold">{a.texto}</p>
            {a.accion && (
              <button
                type="button"
                onClick={() => {
                  a.accion?.alHacer();
                  quitar(a.id);
                }}
                className="min-h-11 rounded-lg border-2 border-current px-3 font-bold"
              >
                {a.accion.texto}
              </button>
            )}
            <button type="button" onClick={() => quitar(a.id)} aria-label="Cerrar aviso" className="grid size-11 place-items-center rounded-lg">
              <X aria-hidden className="size-5" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos(): ApiAvisos {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAvisos fuera de ProveedorAvisos');
  return c;
}
