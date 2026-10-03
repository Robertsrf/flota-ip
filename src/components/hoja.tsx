import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AreaTexto, Boton, Campo } from './controles';
import { MensajeError } from './datos';
import { traducirError } from '@/lib/errores';

interface PropsHoja {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: 'normal' | 'ancho';
}

/** Hoja: sube desde abajo en el teléfono; ventana centrada en escritorio. Usa <dialog> nativo. */
export function Hoja({ abierta, alCerrar, titulo, descripcion, children, pie, ancho = 'normal' }: PropsHoja) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      onCancel={(e) => {
        e.preventDefault();
        alCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) alCerrar();
      }}
      aria-labelledby="hoja-titulo"
      className={`fixed m-0 max-h-[92dvh] w-full max-w-none overflow-hidden bg-transparent p-0 text-tinta backdrop:bg-black/50
        inset-x-0 bottom-0 top-auto md:inset-0 md:m-auto md:h-fit ${ancho === 'ancho' ? 'md:max-w-3xl' : 'md:max-w-lg'}`}
    >
      <div className="flex max-h-[92dvh] flex-col rounded-t-2xl border-2 border-linea bg-superficie md:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-linea px-5 pb-3 pt-4">
          <div>
            <h2 id="hoja-titulo" className="text-xl font-extrabold">
              {titulo}
            </h2>
            {descripcion && <p className="mt-1 text-sm text-tinta-2">{descripcion}</p>}
          </div>
          <button type="button" onClick={alCerrar} aria-label="Cerrar" className="-mr-2 grid size-12 place-items-center rounded-lg hover:bg-superficie-2">
            <X aria-hidden className="size-6" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="zona-segura-abajo flex flex-wrap justify-end gap-2 border-t border-linea px-5 pt-3">{pie}</div>}
      </div>
    </dialog>
  );
}

interface PropsConfirmar {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: ReactNode;
  textoAccion: string;
  peligro?: boolean;
  pedirMotivo?: boolean;
  etiquetaMotivo?: string;
  alConfirmar: (motivo: string) => Promise<void>;
}

/** Confirmación con motivo obligatorio (anular, rechazar, corregir) */
export function ConfirmarConMotivo({
  abierta, alCerrar, titulo, descripcion, textoAccion, peligro, pedirMotivo = true, etiquetaMotivo = 'Motivo', alConfirmar,
}: PropsConfirmar) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [falta, setFalta] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    setMotivo('');
    setError(null);
    setFalta(false);
    alCerrar();
  };

  const confirmar = async () => {
    if (pedirMotivo && !motivo.trim()) {
      setFalta(true);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await alConfirmar(motivo.trim());
      cerrar();
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Hoja
      abierta={abierta}
      alCerrar={cerrar}
      titulo={titulo}
      descripcion={descripcion}
      pie={
        <>
          <Boton onClick={cerrar}>Cancelar</Boton>
          <Boton variante={peligro ? 'peligro' : 'principal'} onClick={confirmar} cargando={enviando}>
            {textoAccion}
          </Boton>
        </>
      }
    >
      {pedirMotivo && (
        <Campo etiqueta={etiquetaMotivo} error={falta ? 'Escribe el motivo: queda en la auditoría.' : null}>
          {(p) => <AreaTexto {...p} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />}
        </Campo>
      )}
      {error !== null && <MensajeError error={traducirError(error)} className="mt-3" />}
    </Hoja>
  );
}
