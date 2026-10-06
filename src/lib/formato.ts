// Formato venezolano (es-VE) en un solo lugar: 10.400 km · $ 48,00 · Bs 1.234,56 · dd/mm/aaaa.
// useGrouping 'always': en español el separador de miles se omite en números de 4 cifras;
// el handoff pide "1.234", así que se fuerza.

export const ZONA = 'America/Caracas';

type Num = number | string | null | undefined;

const cacheFormatos = new Map<string, Intl.NumberFormat>();

function formato(min: number, max: number): Intl.NumberFormat {
  const clave = `${min}-${max}`;
  let f = cacheFormatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      useGrouping: 'always',
    });
    cacheFormatos.set(clave, f);
  }
  return f;
}

export function aNumero(v: Num): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Número con decimales fijos; "—" si no hay dato. */
export function num(v: Num, decimales = 0, vacio = '—'): string {
  const n = aNumero(v);
  if (n === null) return vacio;
  return formato(decimales, decimales).format(n);
}

// Cifra y unidad van unidas con espacio de no separación: "$ 0,1057/km" nunca se parte en dos líneas
export const NB = '\u00a0';
export const km = (v: Num) => (aNumero(v) === null ? '—' : `${num(v, 0)}${NB}km`);
export const litros = (v: Num, decimales = 2) => (aNumero(v) === null ? '—' : `${num(v, decimales)}${NB}L`);
export const usd = (v: Num, decimales = 2) => (aNumero(v) === null ? '—' : `$${NB}${num(v, decimales)}`);
export const bs = (v: Num) => (aNumero(v) === null ? '—' : `Bs${NB}${num(v, 2)}`);
export const kml = (v: Num) => (aNumero(v) === null ? '—' : `${num(v, 2)}${NB}km/L`);
export const l100 = (v: Num) => (aNumero(v) === null ? '—' : `${num(v, 2)}${NB}L/100${NB}km`);
export const usdKm = (v: Num) => (aNumero(v) === null ? '—' : `$${NB}${num(v, 4)}/km`);
export const tasa = (v: Num) => (aNumero(v) === null ? '—' : `${num(v, 2)}${NB}Bs/$`);
export const precioLitro = (v: Num) => (aNumero(v) === null ? '—' : `$${NB}${num(v, 2)}/L`);

export function variacion(actual: Num, anterior: Num, comparable = true): number | null {
  const a = aNumero(actual);
  const b = aNumero(anterior);
  if (!comparable || a === null || b === null || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

export const pct = (v: Num, decimales = 1) => (aNumero(v) === null ? '—' : `${num(v, decimales)}${NB}%`);

// ----- Fechas -------------------------------------------------------------
const fFecha = new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });
const fHora = new Intl.DateTimeFormat('es-VE', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fPartes = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function aFecha(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  // "YYYY-MM-DD" se interpreta como fecha local de Caracas a mediodía para no cambiar de día
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00-04:00`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** dd/mm/aaaa en hora de Caracas */
export function fecha(v: string | Date | null | undefined): string {
  const d = aFecha(v);
  return d ? fFecha.format(d) : '—';
}

export function hora(v: string | Date | null | undefined): string {
  const d = aFecha(v);
  return d ? fHora.format(d) : '—';
}

export function fechaHora(v: string | Date | null | undefined): string {
  const d = aFecha(v);
  return d ? `${fFecha.format(d)} ${fHora.format(d)}` : '—';
}

/** Partes de una fecha en Caracas: { anio, mes, dia, hora, minuto } */
export function partesCaracas(v: Date = new Date()) {
  const p = Object.fromEntries(fPartes.formatToParts(v).map((x) => [x.type, x.value]));
  return { anio: Number(p.year), mes: Number(p.month), dia: Number(p.day), hora: Number(p.hour), minuto: Number(p.minute) };
}

/** "YYYY-MM-DD" de hoy en Caracas */
export function hoyIso(d: Date = new Date()): string {
  const p = partesCaracas(d);
  return `${p.anio}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
}

/** Valor para <input type="datetime-local"> en hora de Caracas */
export function aDatetimeLocal(d: Date = new Date()): string {
  const p = partesCaracas(d);
  return `${hoyIso(d)}T${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`;
}

/** De <input type="datetime-local"> (hora de Caracas) a ISO con zona */
export function desdeDatetimeLocal(v: string): string {
  return new Date(`${v}:00-04:00`).toISOString();
}

/** "septiembre de 2026" a partir de "2026-09-01" */
export function mesLargo(isoMes: string): string {
  const [a, m] = isoMes.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** "sep 2026" */
export function mesCorto(isoMes: string): string {
  const [a, m] = isoMes.split('-').map(Number);
  return `${MESES_CORTOS[m - 1]} ${a}`;
}

/** "2 h 15 min" */
export function duracion(desde: string | Date, hasta: Date = new Date()): string {
  const a = aFecha(desde);
  if (!a) return '—';
  const minutos = Math.max(0, Math.round((hasta.getTime() - a.getTime()) / 60000));
  const dias = Math.floor(minutos / 1440);
  const h = Math.floor((minutos % 1440) / 60);
  const m = minutos % 60;
  if (dias > 0) return `${dias} d ${h} h`;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m} min`;
}

// ----- Entrada de números ---------------------------------------------------
/**
 * Lee lo que escribe el usuario en un campo numérico.
 * - Con coma: la coma es decimal y los puntos son miles ("1.234,5" → 1234.5).
 * - Solo puntos con grupos de 3 ("10.400") → miles cuando tipo = 'entero' o el patrón es claro.
 * - "80.5" → 80.5 (decimal).
 */
export function leerNumero(texto: string, tipo: 'entero' | 'decimal' = 'decimal'): number | null {
  const t = texto.trim().replace(/\s/g, '');
  if (t === '') return null;
  let normal: string;
  if (t.includes(',')) {
    normal = t.replace(/\./g, '').replace(',', '.');
  } else if (tipo === 'entero' || /^\d{1,3}(\.\d{3})+$/.test(t)) {
    normal = t.replace(/\./g, '');
  } else {
    normal = t;
  }
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}
