// Exportación de tablas (sección 10.4): columnas visibles y filtros aplicados;
// USD y Bs en columnas separadas y etiquetadas.
import { fecha, fechaHora } from './formato';

export type TipoColumna = 'texto' | 'entero' | 'decimal' | 'usd' | 'bs' | 'fecha' | 'fechaHora' | 'km' | 'litros' | 'kml' | 'usdKm';

export interface ColumnaExport<T> {
  titulo: string;
  valor: (fila: T) => unknown;
  tipo?: TipoColumna;
}

const DECIMALES: Partial<Record<TipoColumna, number>> = {
  entero: 0, km: 0, decimal: 2, usd: 2, bs: 2, litros: 2, kml: 2, usdKm: 4,
};

function titulo<T>(c: ColumnaExport<T>): string {
  const sufijo: Partial<Record<TipoColumna, string>> = {
    usd: ' (USD)', bs: ' (Bs)', km: ' (km)', litros: ' (L)', kml: ' (km/L)', usdKm: ' (USD/km)',
  };
  const s = sufijo[c.tipo ?? 'texto'] ?? '';
  return c.titulo.endsWith(s.trim().replace(/[()]/g, '')) ? c.titulo : c.titulo + s;
}

function celdaTexto<T>(c: ColumnaExport<T>, fila: T): string {
  const v = c.valor(fila);
  if (v === null || v === undefined || v === '') return '';
  const tipo = c.tipo ?? 'texto';
  if (tipo === 'fecha') return fecha(String(v));
  if (tipo === 'fechaHora') return fechaHora(String(v));
  if (tipo in DECIMALES) {
    const n = Number(v);
    if (Number.isFinite(n)) return n.toFixed(DECIMALES[tipo] ?? 2).replace('.', ',');
  }
  return String(v);
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV para Excel en español: separador ";" y coma decimal, con BOM UTF-8. */
export function exportarCsv<T>(nombre: string, columnas: ColumnaExport<T>[], filas: T[]): void {
  const esc = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lineas = [columnas.map((c) => esc(titulo(c))).join(';')];
  for (const f of filas) lineas.push(columnas.map((c) => esc(celdaTexto(c, f))).join(';'));
  descargar(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`);
}

/** Excel (.xlsx) con números reales y formato de miles y decimales. */
export async function exportarXlsx<T>(nombre: string, columnas: ColumnaExport<T>[], filas: T[]): Promise<void> {
  const XLSX = await import('xlsx');
  const encabezado = columnas.map((c) => titulo(c));
  const datos = filas.map((f) =>
    columnas.map((c) => {
      const v = c.valor(f);
      const tipo = c.tipo ?? 'texto';
      if (v === null || v === undefined || v === '') return null;
      if (tipo === 'fecha') return fecha(String(v));
      if (tipo === 'fechaHora') return fechaHora(String(v));
      if (tipo in DECIMALES) {
        const n = Number(v);
        return Number.isFinite(n) ? n : String(v);
      }
      return String(v);
    }),
  );
  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...datos]);
  columnas.forEach((c, i) => {
    const dec = DECIMALES[c.tipo ?? 'texto'];
    if (dec === undefined) return;
    const formatoNum = dec === 0 ? '#,##0' : `#,##0.${'0'.repeat(dec)}`;
    for (let r = 1; r <= datos.length; r++) {
      const celda = hoja[XLSX.utils.encode_cell({ r, c: i })];
      if (celda && typeof celda.v === 'number') celda.z = formatoNum;
    }
  });
  hoja['!cols'] = encabezado.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31));
  const salida = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });
  descargar(new Blob([salida], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombre}.xlsx`);
}
