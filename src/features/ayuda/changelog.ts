// Lee CHANGELOG.md (formato Keep a Changelog) para mostrarlo en la pantalla de Novedades.

export interface Version {
  /** "0.6.0" o "Sin publicar" */
  numero: string;
  /** AAAA-MM-DD, o null si aún no se publica */
  fecha: string | null;
  titulo: string | null;
  grupos: { tipo: string; cambios: string[] }[];
}

const CABECERA = /^## \[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?(?:\s+-\s+(.+))?\s*$/;

export function leerChangelog(texto: string): Version[] {
  const versiones: Version[] = [];
  let actual: Version | null = null;
  for (const linea of texto.split(/\r?\n/)) {
    const v = CABECERA.exec(linea);
    if (v) {
      actual = { numero: v[1], fecha: v[2] ?? null, titulo: v[3]?.trim() ?? null, grupos: [] };
      versiones.push(actual);
      continue;
    }
    if (!actual) continue; // la introducción del archivo es para quien lo mantiene
    if (linea.startsWith('### ')) {
      actual.grupos.push({ tipo: linea.slice(4).trim(), cambios: [] });
    } else if (linea.startsWith('- ')) {
      if (!actual.grupos.length) actual.grupos.push({ tipo: 'Cambios', cambios: [] });
      actual.grupos[actual.grupos.length - 1].cambios.push(linea.slice(2).trim());
    } else if (/^\s{2,}\S/.test(linea) && actual.grupos.length) {
      // continuación de una viñeta larga partida en varias líneas
      const g = actual.grupos[actual.grupos.length - 1];
      if (g.cambios.length) g.cambios[g.cambios.length - 1] += ` ${linea.trim()}`;
    }
  }
  return versiones.filter((x) => x.grupos.some((g) => g.cambios.length > 0));
}

/** Parte un texto con **negritas** y `código` en trozos para pintarlos sin HTML crudo */
export function trozos(texto: string): { texto: string; estilo: 'normal' | 'negrita' | 'codigo' }[] {
  const out: { texto: string; estilo: 'normal' | 'negrita' | 'codigo' }[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) out.push({ texto: texto.slice(ultimo, m.index), estilo: 'normal' });
    out.push(m[1] !== undefined ? { texto: m[1], estilo: 'negrita' } : { texto: m[2], estilo: 'codigo' });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) out.push({ texto: texto.slice(ultimo), estilo: 'normal' });
  return out;
}
