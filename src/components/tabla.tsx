import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { exportarCsv, exportarXlsx, type ColumnaExport } from '@/lib/exportar';
import { Boton } from './controles';
import { Esqueleto } from './datos';

export interface Columna<T> {
  id: string;
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** valor para ordenar; sin él la columna no se ordena */
  orden?: (fila: T) => number | string | null | undefined;
  alinear?: 'izq' | 'der';
  /** definición para CSV/Excel; si falta, la columna no se exporta */
  exportar?: Omit<ColumnaExport<T>, 'titulo'> & { titulo?: string };
  /** en móvil: 'principal' va en negrita arriba; 'oculta' no se muestra */
  movil?: 'principal' | 'secundaria' | 'oculta';
  ancho?: string;
}

interface PropsTabla<T> {
  filas: T[];
  columnas: Columna<T>[];
  clave: (fila: T) => string;
  titulo?: string;
  cargando?: boolean;
  vacio?: ReactNode;
  alElegir?: (fila: T) => void;
  nombreExport?: string;
  ordenInicial?: { id: string; dir: 'asc' | 'desc' };
  pie?: ReactNode;
  acciones?: ReactNode;
}

export function Tabla<T>({ filas, columnas, clave, titulo, cargando, vacio, alElegir, nombreExport, ordenInicial, pie, acciones }: PropsTabla<T>) {
  const [orden, setOrden] = useState(ordenInicial ?? null);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.id === orden.id);
    if (!col?.orden) return filas;
    const f = col.orden;
    return [...filas].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return orden.dir === 'asc' ? r : -r;
    });
  }, [filas, columnas, orden]);

  const alternar = (id: string) =>
    setOrden((o) => (o?.id === id ? { id, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { id, dir: 'desc' }));

  const colsExport: ColumnaExport<T>[] = columnas
    .filter((c) => c.exportar)
    .map((c) => ({ titulo: c.exportar!.titulo ?? c.titulo, valor: c.exportar!.valor, tipo: c.exportar!.tipo }));

  const principal = columnas.find((c) => c.movil === 'principal') ?? columnas[0];
  const secundarias = columnas.filter((c) => c !== principal && c.movil !== 'oculta');

  return (
    <section className="flex flex-col gap-3" aria-label={titulo}>
      {(titulo || nombreExport || acciones) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {titulo && <h2 className="text-lg font-extrabold">{titulo}</h2>}
          <div className="flex flex-wrap gap-2">
            {acciones}
            {nombreExport && colsExport.length > 0 && filas.length > 0 && (
              <>
                <Boton tamano="sm" icono={<Download aria-hidden className="size-4" />} onClick={() => exportarCsv(nombreExport, colsExport, ordenadas)}>
                  CSV
                </Boton>
                <Boton tamano="sm" icono={<Download aria-hidden className="size-4" />} onClick={() => void exportarXlsx(nombreExport, colsExport, ordenadas)}>
                  Excel
                </Boton>
              </>
            )}
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex flex-col gap-2" role="status">
          <span className="sr-only">Cargando…</span>
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} alto="h-12" />
          ))}
        </div>
      ) : ordenadas.length === 0 ? (
        vacio
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-xl border-2 border-linea bg-superficie md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-superficie-2">
                <tr>
                  {columnas.map((c) => {
                    const activo = orden?.id === c.id;
                    return (
                      <th
                        key={c.id}
                        scope="col"
                        aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : c.orden ? 'none' : undefined}
                        className={`whitespace-nowrap border-b-2 border-linea px-3 py-2 font-bold text-tinta ${c.alinear === 'der' ? 'text-right' : ''}`}
                        style={c.ancho ? { width: c.ancho } : undefined}
                      >
                        {c.orden ? (
                          <button
                            type="button"
                            onClick={() => alternar(c.id)}
                            className={`inline-flex min-h-9 items-center gap-1 rounded hover:underline ${c.alinear === 'der' ? 'flex-row-reverse' : ''}`}
                          >
                            {c.titulo}
                            {activo ? (
                              orden.dir === 'asc' ? <ArrowUp aria-hidden className="size-4" /> : <ArrowDown aria-hidden className="size-4" />
                            ) : (
                              <ArrowUpDown aria-hidden className="size-4 opacity-40" />
                            )}
                          </button>
                        ) : (
                          c.titulo
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => (
                  <tr
                    key={clave(f)}
                    onClick={alElegir ? () => alElegir(f) : undefined}
                    onKeyDown={alElegir ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), alElegir(f)) : undefined}
                    tabIndex={alElegir ? 0 : undefined}
                    className={`border-b border-linea last:border-b-0 ${alElegir ? 'cursor-pointer hover:bg-superficie-2 focus-visible:bg-superficie-2' : ''}`}
                  >
                    {columnas.map((c) => (
                      <td key={c.id} className={`px-3 py-2.5 align-middle ${c.alinear === 'der' ? 'cifra text-right' : ''}`}>
                        {c.celda(f)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {pie && <tfoot className="border-t-2 border-linea bg-superficie-2 font-bold">{pie}</tfoot>}
            </table>
          </div>

          {/* Teléfono: filas de dos líneas */}
          <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-xl border-2 border-linea bg-superficie md:hidden">
            {ordenadas.map((f) => {
              const contenido = (
                <>
                  <div className="text-base font-bold">{principal.celda(f)}</div>
                  <dl className="mt-1 grid grid-cols-1 gap-y-0.5 text-sm sm:grid-cols-2 sm:gap-x-6">
                    {secundarias.map((c) => (
                      <div key={c.id} className="flex min-w-0 justify-between gap-2">
                        <dt className="text-tinta-2">{c.titulo}</dt>
                        <dd className="cifra truncate text-right font-semibold">{c.celda(f)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              );
              return (
                <li key={clave(f)}>
                  {alElegir ? (
                    <button type="button" onClick={() => alElegir(f)} className="block w-full px-4 py-3 text-left hover:bg-superficie-2">
                      {contenido}
                    </button>
                  ) : (
                    <div className="px-4 py-3">{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
