import { useState } from 'react';
import { CloudUpload, RefreshCw, Trash2 } from 'lucide-react';
import { descartar, reintentar, sincronizar, usePendientes } from '@/lib/offline/cola';
import { useSesion } from '@/lib/sesion';
import { MensajeError } from '@/components/datos';

/** Lo que espera en el teléfono y lo que la base rechazó, siempre a la vista */
export function AvisosCola() {
  const { sesion } = useSesion();
  const pendientes = usePendientes(sesion?.user.id);
  const [enviando, setEnviando] = useState(false);
  const enEspera = pendientes.filter((p) => p.estado === 'pendiente');
  const rechazados = pendientes.filter((p) => p.estado === 'error');
  if (!enEspera.length && !rechazados.length) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      {enEspera.length > 0 && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border-2 border-linea-fuerte bg-superficie-2 px-4 py-2">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CloudUpload aria-hidden className="size-5 shrink-0" />
            {enEspera.length === 1 ? '1 registro esperando señal' : `${enEspera.length} registros esperando señal`}
          </p>
          <button
            type="button"
            onClick={async () => {
              setEnviando(true);
              await sincronizar();
              setEnviando(false);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-tinta px-3 text-sm font-bold"
          >
            <RefreshCw aria-hidden className={`size-4 ${enviando ? 'animate-spin' : ''}`} /> Enviar ahora
          </button>
        </div>
      )}
      {rechazados.map((p) => (
        <div key={p.id} className="flex flex-col gap-2">
          <MensajeError error={{ mensaje: `No se registró: ${p.resumen}.`, ayuda: [p.error, p.ayuda].filter(Boolean).join(' '), deRed: false, rechazado: true }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => void reintentar(p.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-tinta px-3 text-sm font-bold">
              <RefreshCw aria-hidden className="size-4" /> Reintentar
            </button>
            <button type="button" onClick={() => void descartar(p.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-peligro px-3 text-sm font-bold text-peligro">
              <Trash2 aria-hidden className="size-4" /> Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
