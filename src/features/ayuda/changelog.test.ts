import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leerChangelog, trozos } from './changelog';

const ejemplo = `# Novedades

Introducción para quien mantiene el archivo.

## [Sin publicar]

## [1.2.0] - 2026-11-02 - Título de la versión

### Agregado

- Una cosa **nueva**.
- Otra con \`código\`.

### Corregido

- Un error.

## [1.1.0] - 2026-10-20

- Cambio sin tipo.
`;

describe('lectura del CHANGELOG', () => {
  it('saca versiones, fechas, títulos y grupos; omite las vacías', () => {
    const v = leerChangelog(ejemplo);
    expect(v.map((x) => x.numero)).toEqual(['1.2.0', '1.1.0']);
    expect(v[0]).toMatchObject({ fecha: '2026-11-02', titulo: 'Título de la versión' });
    expect(v[0].grupos).toEqual([
      { tipo: 'Agregado', cambios: ['Una cosa **nueva**.', 'Otra con `código`.'] },
      { tipo: 'Corregido', cambios: ['Un error.'] },
    ]);
    expect(v[1]).toMatchObject({ fecha: '2026-10-20', titulo: null, grupos: [{ tipo: 'Cambios', cambios: ['Cambio sin tipo.'] }] });
  });

  it('parte negritas y código sin interpretar HTML', () => {
    expect(trozos('Hola **mundo** y `x` <b>')).toEqual([
      { texto: 'Hola ', estilo: 'normal' },
      { texto: 'mundo', estilo: 'negrita' },
      { texto: ' y ', estilo: 'normal' },
      { texto: 'x', estilo: 'codigo' },
      { texto: ' <b>', estilo: 'normal' },
    ]);
  });

  it('el CHANGELOG del proyecto: la primera versión coincide con package.json y todas tienen fecha', () => {
    const versiones = leerChangelog(readFileSync('CHANGELOG.md', 'utf8'));
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const publicadas = versiones.filter((x) => x.numero !== 'Sin publicar');
    expect(publicadas[0].numero).toBe(version);
    for (const v of publicadas) expect(v.fecha, `la versión ${v.numero} necesita fecha`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const fechas = publicadas.map((x) => x.fecha!);
    expect([...fechas].sort().reverse()).toEqual(fechas);
  });
});
