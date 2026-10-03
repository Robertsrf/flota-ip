import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

/** Avisa cuando hay una versión nueva de la app instalada (PWA). */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (registro) window.setInterval(() => void registro.update(), 60 * 60 * 1000);
    },
  });
  if (!hayNueva) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-tinta px-4 py-2 text-superficie">
      <p className="text-sm font-semibold">Hay una versión nueva de Flota IP.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setHayNueva(false)} className="min-h-10 rounded-lg px-3 text-sm font-bold">
          Después
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 border-current px-3 text-sm font-bold"
        >
          <RefreshCw aria-hidden className="size-4" /> Actualizar
        </button>
      </div>
    </div>
  );
}
