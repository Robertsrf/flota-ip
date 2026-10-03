// Copia del motor de cálculo de Postgres (recalcular_viaje) SOLO para la vista
// previa de los formularios: "400 km y 80 L → 5,00 km/L, $ 48,00".
// La cifra oficial siempre viene de la base. Los casos T1–T10 se prueban
// aquí y en supabase/tests: deben dar lo mismo.

export type FuenteNivel = 'lleno' | 'aguja' | 'litros' | 'heredado';
export type Calidad = 'exacto' | 'estimado' | 'incompleto';

export interface CargaViaje {
  litros: number;
  precio: number;
  cierre?: boolean;
  lleno?: boolean;
}

export interface DatosViaje {
  capacidad: number;
  litrosSalida: number;
  fuenteSalida: FuenteNivel;
  kmSalida: number;
  kmLlegada: number | null;
  cargas: CargaViaje[];
  /** Nivel leído al llegar (sin carga o con carga parcial de cierre) */
  aguja: number | null;
  /** Precio de la última carga del camión, si el viaje no tuvo cargas */
  precioRespaldo?: number | null;
  rendimientoMin?: number;
  rendimientoMax?: number;
}

export interface ResultadoViaje {
  km: number | null;
  litros: number | null;
  rendimiento: number | null;
  litros100: number | null;
  precio: number | null;
  costo: number | null;
  costoKm: number | null;
  calidad: Calidad;
  motivos: string[];
  /** Mensaje si los datos son imposibles (el servidor también los rechaza) */
  error: string | null;
}

/** Redondeo "mitad lejos de cero", como round() de numeric en Postgres */
export function redondear(x: number, decimales: number): number {
  const f = 10 ** decimales;
  const v = Math.abs(x) * f;
  const r = Math.round(v + Number.EPSILON * v * 4) / f;
  return Math.sign(x) * r;
}

export function calcularViaje(d: DatosViaje): ResultadoViaje {
  const motivos: string[] = [];
  const base: ResultadoViaje = {
    km: null, litros: null, rendimiento: null, litros100: null, precio: null, costo: null, costoKm: null,
    calidad: 'incompleto', motivos, error: null,
  };
  if (d.kmLlegada === null || d.kmLlegada <= d.kmSalida) {
    return { ...base, error: d.kmLlegada === null ? null : 'El km de llegada debe ser mayor que el de salida.' };
  }
  const km = redondear(d.kmLlegada - d.kmSalida, 1);
  const litrosCargas = d.cargas.reduce((s, c) => s + c.litros, 0);
  const montoCargas = d.cargas.reduce((s, c) => s + redondear(c.litros * c.precio, 2), 0);
  const cierre = [...d.cargas].reverse().find((c) => c.cierre);

  let calidad: Calidad = d.fuenteSalida === 'lleno' || d.fuenteSalida === 'heredado' ? 'exacto' : 'estimado';
  let final: number | null;
  if (cierre && (cierre.lleno ?? true)) {
    final = d.capacidad;
  } else if (d.aguja !== null) {
    final = d.aguja;
    calidad = 'estimado';
  } else {
    final = null;
  }

  if (final !== null && final > d.capacidad) {
    return { ...base, km, error: `El nivel al llegar supera la capacidad del tanque (${d.capacidad} L).` };
  }

  let precio: number | null;
  if (litrosCargas > 0) {
    precio = montoCargas / litrosCargas;
  } else {
    precio = d.precioRespaldo ?? null;
    if (precio === null && calidad === 'exacto') calidad = 'estimado';
  }

  if (final === null) return { ...base, km, precio, calidad: 'incompleto' };

  const consumo = d.litrosSalida + litrosCargas - final;
  if (consumo <= 0) {
    return { ...base, km, precio, error: 'Con estos datos el consumo da 0 o negativo. Revisa el nivel al llegar y los litros cargados.' };
  }
  const litros = redondear(consumo, 2);
  const rendimiento = redondear(km / consumo, 2);
  const costo = precio === null ? null : redondear(consumo * precio, 2);
  if (d.rendimientoMin !== undefined && d.rendimientoMax !== undefined
      && (rendimiento < d.rendimientoMin || rendimiento > d.rendimientoMax)) {
    motivos.push('rendimiento_fuera_rango');
  }
  return {
    km,
    litros,
    rendimiento,
    litros100: redondear((consumo / km) * 100, 2),
    precio: precio === null ? null : redondear(precio, 4),
    costo,
    costoKm: costo === null ? null : redondear(costo / km, 4),
    calidad,
    motivos,
    error: null,
  };
}

export interface FilaAgregable {
  km: number | null;
  litros: number | null;
  costo: number | null;
  calidad: Calidad | null;
}

/** Agregado ponderado: Σ km ÷ Σ L (nunca el promedio de los ratios). */
export function agregar(filas: FilaAgregable[], soloExactos = false) {
  const validas = filas.filter((f) =>
    f.km !== null && f.litros !== null && (soloExactos ? f.calidad === 'exacto' : f.calidad === 'exacto' || f.calidad === 'estimado'));
  const km = validas.reduce((s, f) => s + (f.km ?? 0), 0);
  const litros = validas.reduce((s, f) => s + (f.litros ?? 0), 0);
  const costo = validas.reduce((s, f) => s + (f.costo ?? 0), 0);
  return {
    km,
    litros,
    costo: redondear(costo, 2),
    rendimiento: litros > 0 ? redondear(km / litros, 2) : null,
    litros100: km > 0 ? redondear((litros / km) * 100, 2) : null,
    costoKm: km > 0 ? redondear(costo / km, 4) : null,
  };
}

/** Litros de un cuarto de aguja: 3/4 de 200 L = 150 L */
export const cuartos = (capacidad: number, fraccion: 0.25 | 0.5 | 0.75 | 1) => redondear(capacidad * fraccion, 2);

export interface EventoCarga {
  lectura: number;
  litros: number;
  lleno: boolean;
  omitida?: boolean;
}

export interface Ciclo {
  inicio: number;
  fin: number;
  distancia: number;
  litros: number;
  rendimiento: number | null;
  invalido: boolean;
}

/**
 * Ciclos lleno a lleno (sección 8.6), igual que v_ciclos_combustible: entre dos
 * cargas llenas, litros = parciales + la llena que cierra (sin la que abre).
 * El primer evento puede ser el alta del camión con el tanque lleno (litros 0).
 */
export function calcularCiclos(eventos: EventoCarga[]): Ciclo[] {
  const orden = [...eventos].sort((a, b) => a.lectura - b.lectura);
  const ciclos: Ciclo[] = [];
  let abierto: { inicio: number; litros: number; invalido: boolean } | null = null;
  for (const ev of orden) {
    if (abierto) {
      abierto.litros += ev.litros;
      abierto.invalido ||= ev.omitida ?? false;
      if (ev.lleno) {
        const distancia = ev.lectura - abierto.inicio;
        ciclos.push({
          inicio: abierto.inicio,
          fin: ev.lectura,
          distancia,
          litros: redondear(abierto.litros, 2),
          rendimiento: distancia > 0 && abierto.litros > 0 ? redondear(distancia / abierto.litros, 2) : null,
          invalido: abierto.invalido,
        });
      }
    }
    if (ev.lleno) abierto = { inicio: ev.lectura, litros: 0, invalido: false };
  }
  return ciclos;
}
