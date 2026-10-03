import { describe, expect, it } from 'vitest';
import { agregar, calcularCiclos, calcularViaje, redondear } from './consumo';

// Mismos casos que supabase/tests/motor.test.ts (sección 12 del handoff)
describe('vista previa del consumo (consumo.ts)', () => {
  it('T1 · 400 km, 80 L a $0,60', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'lleno', kmSalida: 10000, kmLlegada: 10400,
      cargas: [{ litros: 80, precio: 0.6, cierre: true, lleno: true }], aguja: null,
    });
    expect(r).toMatchObject({ km: 400, litros: 80, rendimiento: 5, litros100: 20, costo: 48, costoKm: 0.12, calidad: 'exacto' });
  });

  it('T2 · sale a medio tanque y llena con 180 L a $0,50', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 100, fuenteSalida: 'aguja', kmSalida: 10000, kmLlegada: 10400,
      cargas: [{ litros: 180, precio: 0.5, cierre: true, lleno: true }], aguja: null,
    });
    expect(r).toMatchObject({ litros: 80, rendimiento: 5, costo: 40, calidad: 'estimado' });
  });

  it('T3 · parcial en el camino', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'lleno', kmSalida: 10000, kmLlegada: 10600,
      cargas: [{ litros: 40, precio: 0.5, lleno: false }, { litros: 70, precio: 0.6, cierre: true, lleno: true }],
      aguja: null,
    });
    expect(r).toMatchObject({ km: 600, litros: 110, rendimiento: 5.45, costo: 62, costoKm: 0.1033, calidad: 'exacto' });
  });

  it('T4 · sin repostar, aguja 3/4 y precio de la última carga', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'heredado', kmSalida: 10000, kmLlegada: 10300,
      cargas: [], aguja: 150, precioRespaldo: 0.6,
    });
    expect(r).toMatchObject({ litros: 50, rendimiento: 6, costo: 30, calidad: 'estimado' });
  });

  it('T5 · km de llegada menor que el de salida', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'lleno', kmSalida: 10000, kmLlegada: 9990, cargas: [], aguja: 150,
    });
    expect(r.error).toBe('El km de llegada debe ser mayor que el de salida.');
  });

  it('sin carga ni aguja queda incompleto', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'lleno', kmSalida: 10000, kmLlegada: 10200, cargas: [], aguja: null,
    });
    expect(r.calidad).toBe('incompleto');
    expect(r.litros).toBeNull();
  });

  it('rendimiento fuera de rango marca revisar', () => {
    const r = calcularViaje({
      capacidad: 200, litrosSalida: 200, fuenteSalida: 'lleno', kmSalida: 10000, kmLlegada: 10100,
      cargas: [{ litros: 80, precio: 0.5, cierre: true }], aguja: null, rendimientoMin: 3, rendimientoMax: 8,
    });
    expect(r.motivos).toContain('rendimiento_fuera_rango');
  });

  it('T7 · ciclo lleno a lleno: 700 km, 120 L, 5,83 km/L', () => {
    const ciclos = calcularCiclos([
      { lectura: 10000, litros: 0, lleno: true },
      { lectura: 10300, litros: 30, lleno: false },
      { lectura: 10700, litros: 90, lleno: true },
    ]);
    expect(ciclos).toEqual([{ inicio: 10000, fin: 10700, distancia: 700, litros: 120, rendimiento: 5.83, invalido: false }]);
  });

  it('T10 · agregado ponderado de T1 + T3: 5,26 km/L, no 5,23', () => {
    const a = agregar([
      { km: 400, litros: 80, costo: 48, calidad: 'exacto' },
      { km: 600, litros: 110, costo: 62, calidad: 'exacto' },
    ]);
    expect(a).toMatchObject({ km: 1000, litros: 190, rendimiento: 5.26, costo: 110, costoKm: 0.11 });
    expect(redondear((5 + 5.45) / 2, 2)).toBe(5.23);
  });

  it('redondea como Postgres (mitad lejos de cero)', () => {
    expect(redondear(0.125, 2)).toBe(0.13);
    expect(redondear(-0.125, 2)).toBe(-0.13);
    expect(redondear(1.005, 2)).toBe(1.01);
  });
});
