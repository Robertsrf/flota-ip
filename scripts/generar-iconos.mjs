// Genera los íconos de la PWA desde un SVG (panel de señal verde con "IP").
// Provisional hasta tener el logo de Distribuidora y Suministros IP.
// Uso: npm run icons   (necesita Playwright con Edge o Chromium)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { RAIZ } from './pglite/db.mjs';

const svg = (relleno = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${relleno ? 96 : 0}" fill="#0f5b3f"/>
  <rect x="${relleno ? 40 : 88}" y="${relleno ? 40 : 88}" width="${relleno ? 432 : 336}" height="${relleno ? 432 : 336}" rx="${relleno ? 64 : 48}"
        fill="none" stroke="#ffffff" stroke-width="${relleno ? 18 : 14}"/>
  <text x="256" y="${relleno ? 330 : 320}" text-anchor="middle" font-family="Overpass, 'Arial Black', sans-serif"
        font-weight="900" font-size="${relleno ? 230 : 170}" fill="#ffffff" letter-spacing="-6">IP</text>
</svg>`;

const dir = join(RAIZ, 'public', 'iconos');
mkdirSync(dir, { recursive: true });
writeFileSync(join(RAIZ, 'public', 'favicon.svg'), svg(true));

const navegador = await chromium.launch({ channel: process.env.CANAL_NAVEGADOR ?? 'msedge' }).catch(() => chromium.launch());
const pagina = await navegador.newPage();
const fuente = join(RAIZ, 'node_modules', '@fontsource-variable', 'overpass', 'files', 'overpass-latin-wght-normal.woff2').replace(/\\/g, '/');
for (const [nombre, tam, relleno] of [
  ['icono-192.png', 192, true],
  ['icono-512.png', 512, true],
  ['icono-maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
]) {
  await pagina.setViewportSize({ width: tam, height: tam });
  await pagina.setContent(`<html><head><style>
    @font-face { font-family: Overpass; src: url("file:///${fuente}") format("woff2"); font-weight: 100 900; }
    html,body{margin:0;background:transparent} svg{width:${tam}px;height:${tam}px;display:block}
  </style></head><body>${svg(relleno)}</body></html>`);
  await pagina.waitForTimeout(300);
  writeFileSync(join(dir, nombre), await pagina.screenshot({ omitBackground: relleno, type: 'png' }));
  console.log('ícono', nombre);
}
await navegador.close();
