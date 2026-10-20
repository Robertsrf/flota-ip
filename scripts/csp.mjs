// Política de seguridad de contenido (CSP) para el build.
// GitHub Pages no deja enviar cabeceras HTTP, así que va en un <meta>. Solo se permite
// cargar código del propio sitio y hablar con el proyecto de Supabase. En el VPS, además,
// las cabeceras del servidor (docs/MIGRACION_VPS.md) agregan frame-ancestors y HSTS.
import { createHash } from 'node:crypto';

const hash = (codigo) => `'sha256-${createHash('sha256').update(codigo).digest('base64')}'`;

/** Construye la política; los scripts en línea del HTML (el del tema) se permiten por su hash. */
export function politica(supabaseUrl, scriptsEnLinea = []) {
  const origen = new URL(supabaseUrl).origin;
  const socket = origen.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptsEnLinea.map(hash).join(' ')}`.trim(),
    // ECharts (SVG) y React escriben estilos en línea
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origen}`,
    "font-src 'self'",
    `connect-src 'self' ${origen} ${socket}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Plugin de Vite: inserta la CSP solo al compilar (en desarrollo Vite usa scripts en línea) */
export function cspPlugin(supabaseUrl) {
  return {
    name: 'flota-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!supabaseUrl) throw new Error('Falta VITE_SUPABASE_URL para armar la CSP del build.');
        const enLinea = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
        const meta = `<meta http-equiv="Content-Security-Policy" content="${politica(supabaseUrl, enLinea)}" />`;
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`);
      },
    },
  };
}
