import { describe, expect, it } from 'vitest';
import { bs, duracion, fecha, fechaHora, hoyIso, km, kml, leerNumero, litros, num, usd, usdKm } from './formato';

describe('formato es-VE', () => {
  it('números, km, litros y montos', () => {
    expect(km(10400)).toBe('10.400 km');
    expect(usd(48)).toBe('$ 48,00');
    expect(bs(1234.56)).toBe('Bs 1.234,56');
    expect(litros(80)).toBe('80,00 L');
    expect(kml(5.4545)).toBe('5,45 km/L');
    expect(usdKm(0.12)).toBe('$ 0,1200/km');
    expect(num(null)).toBe('—');
    expect(usd(undefined)).toBe('—');
    expect(num('37900', 2)).toBe('37.900,00');
  });

  it('fechas en hora de Caracas', () => {
    expect(fecha('2026-10-03T03:30:00Z')).toBe('02/10/2026');
    expect(fechaHora('2026-09-10T12:00:00Z')).toBe('10/09/2026 08:00');
    expect(fecha('2026-09-15')).toBe('15/09/2026');
    expect(hoyIso(new Date('2026-10-03T02:00:00Z'))).toBe('2026-10-02');
  });

  it('duración legible', () => {
    const ahora = new Date('2026-10-03T12:00:00Z');
    expect(duracion('2026-10-03T09:45:00Z', ahora)).toBe('2 h 15 min');
    expect(duracion('2026-10-03T11:50:00Z', ahora)).toBe('10 min');
    expect(duracion('2026-09-30T12:00:00Z', ahora)).toBe('3 d 0 h');
  });

  it('lee números escritos en el teléfono', () => {
    expect(leerNumero('10.400', 'entero')).toBe(10400);
    expect(leerNumero('10400')).toBe(10400);
    expect(leerNumero('80,5')).toBe(80.5);
    expect(leerNumero('80.5')).toBe(80.5);
    expect(leerNumero('1.234,56')).toBe(1234.56);
    expect(leerNumero('37.900')).toBe(37900);
    expect(leerNumero('abc')).toBeNull();
    expect(leerNumero('')).toBeNull();
  });
});
