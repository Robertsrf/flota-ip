import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { politica } from '../../scripts/csp.mjs';

const directivas = (csp: string) => new Map(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));

describe('política de seguridad de contenido del build', () => {
  const tema = "(function () { document.documentElement.classList.add('dark'); })();";
  const csp = directivas(politica('https://abcd.supabase.co', [tema]));

  it('solo deja ejecutar el código del sitio y el script del tema por su hash', () => {
    const hash = `'sha256-${createHash('sha256').update(tema).digest('base64')}'`;
    expect(csp.get('script-src')).toEqual(["'self'", hash]);
    expect([...csp.values()].flat()).not.toContain("'unsafe-eval'");
  });

  it('solo habla con el proyecto de Supabase (API y tiempo real)', () => {
    expect(csp.get('connect-src')).toEqual(["'self'", 'https://abcd.supabase.co', 'wss://abcd.supabase.co']);
    expect(csp.get('img-src')).toContain('https://abcd.supabase.co');
  });

  it('cierra objetos incrustados, base y formularios externos', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
  });

  it('en local usa el servidor de pruebas por http y ws', () => {
    const local = directivas(politica('http://127.0.0.1:54321'));
    expect(local.get('connect-src')).toEqual(["'self'", 'http://127.0.0.1:54321', 'ws://127.0.0.1:54321']);
    expect(local.get('script-src')).toEqual(["'self'"]);
  });
});
