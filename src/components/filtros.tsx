import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useEsAncho } from '@/lib/ganchos';
import { Boton } from './controles';
import { Hoja } from './hoja';

const COLUMNAS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
};

/**
 * Filtros de una lista. En escritorio van en línea. En el teléfono ocupaban una pantalla entera
 * antes de los números: ahí se resumen en un botón ("Este mes • DEMO-001") que abre una hoja.
 */
export function PanelFiltros({
  resumen, activos = 0, alLimpiar, columnas = 4, children,
}: {
  /** cómo se lee el filtro actual, de lo general a lo particular */
  resumen: string[];
  /** cuántos filtros se apartan del valor por defecto */
  activos?: number;
  alLimpiar?: () => void;
  columnas?: number;
  children: ReactNode;
}) {
  const ancho = useEsAncho();
  const [abierta, setAbierta] = useState(false);

  if (ancho) {
    return (
      <form
        aria-label="Filtros"
        onSubmit={(e) => e.preventDefault()}
        className={`grid gap-3 rounded-xl border-2 border-linea bg-superficie p-3 ${COLUMNAS[columnas] ?? 'lg:grid-cols-4'}`}
      >
        {children}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border-2 border-linea-fuerte bg-superficie px-3 text-left hover:bg-superficie-2"
      >
        <SlidersHorizontal aria-hidden className="size-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            Filtros{activos > 0 && <span className="cifra ml-1.5 rounded bg-tinta px-1.5 text-xs text-superficie">{activos}</span>}
          </span>
          <span className="block truncate text-sm text-tinta-2">{resumen.filter(Boolean).join(' • ')}</span>
        </span>
      </button>
      {activos > 0 && alLimpiar && (
        <Boton tamano="md" variante="fantasma" onClick={alLimpiar}>
          Limpiar
        </Boton>
      )}
      <Hoja
        abierta={abierta}
        alCerrar={() => setAbierta(false)}
        titulo="Filtros"
        pie={
          <>
            {activos > 0 && alLimpiar && <Boton onClick={alLimpiar}>Limpiar filtros</Boton>}
            <Boton variante="principal" onClick={() => setAbierta(false)}>
              Ver resultados
            </Boton>
          </>
        }
      >
        <form aria-label="Filtros" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
          {children}
        </form>
      </Hoja>
    </div>
  );
}
