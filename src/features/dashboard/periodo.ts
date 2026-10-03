import { hoyIso, mesCorto } from '@/lib/formato';

export type ClavePeriodo = 'mes' | 'anterior' | '90d' | 'anio' | 'rango';

export interface Periodo {
  clave: ClavePeriodo;
  desde: string;
  hasta: string;
  /** Mismo largo, inmediatamente antes (para ▲/▼) */
  antesDesde: string;
  antesHasta: string;
  texto: string;
  comparacion: string;
}

const MS_DIA = 86_400_000;
const aFecha = (iso: string) => new Date(`${iso}T12:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);
const sumarDias = (iso: string, n: number) => aIso(new Date(aFecha(iso).getTime() + n * MS_DIA));
const diasEntre = (a: string, b: string) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / MS_DIA);

function inicioMes(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}
function finMes(iso: string) {
  const [a, m] = iso.split('-').map(Number);
  return aIso(new Date(Date.UTC(a, m, 0, 12)));
}
function mesAnterior(iso: string) {
  const [a, m] = iso.split('-').map(Number);
  return aIso(new Date(Date.UTC(a, m - 2, 1, 12)));
}

export const NOMBRES_PERIODO: Record<ClavePeriodo, string> = {
  mes: 'Este mes',
  anterior: 'Mes anterior',
  '90d': 'Últimos 90 días',
  anio: 'Este año',
  rango: 'Rango',
};

export function calcularPeriodo(clave: ClavePeriodo, desdeRango?: string | null, hastaRango?: string | null): Periodo {
  const hoy = hoyIso();
  if (clave === 'mes') {
    const desde = inicioMes(hoy);
    const antes = mesAnterior(hoy);
    // Comparación justa: mismos días del mes anterior
    const dias = diasEntre(desde, hoy);
    return {
      clave, desde, hasta: hoy, antesDesde: antes, antesHasta: [sumarDias(antes, dias), finMes(antes)].sort()[0],
      texto: `Este mes (${mesCorto(desde)})`, comparacion: 'vs. los mismos días del mes anterior',
    };
  }
  if (clave === 'anterior') {
    const desde = mesAnterior(hoy);
    const antes = mesAnterior(desde);
    return { clave, desde, hasta: finMes(desde), antesDesde: antes, antesHasta: finMes(antes), texto: `Mes anterior (${mesCorto(desde)})`, comparacion: `vs. ${mesCorto(antes)}` };
  }
  if (clave === 'anio') {
    const desde = `${hoy.slice(0, 4)}-01-01`;
    const antesDesde = `${Number(hoy.slice(0, 4)) - 1}-01-01`;
    return {
      clave, desde, hasta: hoy, antesDesde, antesHasta: `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`,
      texto: `Este año (${hoy.slice(0, 4)})`, comparacion: 'vs. el mismo tramo del año anterior',
    };
  }
  if (clave === 'rango' && desdeRango && hastaRango && desdeRango <= hastaRango) {
    const dias = diasEntre(desdeRango, hastaRango);
    return {
      clave, desde: desdeRango, hasta: hastaRango, antesDesde: sumarDias(desdeRango, -(dias + 1)), antesHasta: sumarDias(desdeRango, -1),
      texto: 'Rango elegido', comparacion: `vs. los ${dias + 1} días anteriores`,
    };
  }
  const desde = sumarDias(hoy, -89);
  return { clave: '90d', desde, hasta: hoy, antesDesde: sumarDias(desde, -90), antesHasta: sumarDias(desde, -1), texto: 'Últimos 90 días', comparacion: 'vs. los 90 días anteriores' };
}

/** Los últimos 12 meses (incluido el actual) como "YYYY-MM-01" */
export function ultimos12Meses(): string[] {
  const hoy = hoyIso();
  const [a, m] = hoy.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => aIso(new Date(Date.UTC(a, m - 12 + i, 1, 12))));
}

/** Meses ("YYYY-MM-01") que toca un rango de fechas */
export function mesesDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let actual = inicioMes(desde);
  while (actual <= hasta) {
    out.push(actual);
    const [a, m] = actual.split('-').map(Number);
    actual = aIso(new Date(Date.UTC(a, m, 1, 12)));
  }
  return out;
}
