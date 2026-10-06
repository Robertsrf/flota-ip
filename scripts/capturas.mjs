/* global document */
// Capturas de pantalla para revisar el diseño (360 y 1440 px).
// Uso: node scripts/capturas.mjs <url-base> <usuario> <clave> <salida> <ruta1> [ruta2...]
//   rutas con sufijo @movil o @escritorio para una sola anchura
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [base, usuario, clave, salida, ...rutas] = process.argv.slice(2);
mkdirSync(salida, { recursive: true });
const navegador = await chromium.launch({ channel: process.env.CANAL_NAVEGADOR ?? 'msedge' }).catch(() => chromium.launch());
const errores = [];
for (const [ancho, alto, nombre] of [[360, 780, 'movil'], [1440, 900, 'escritorio']]) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 1, locale: 'es-VE', timezoneId: 'America/Caracas' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errores.push(`[${nombre}] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('WebSocket') && !m.text().includes('realtime')) errores.push(`[${nombre}] consola: ${m.text().slice(0, 200)}`); });
  await p.goto(`${base}/entrar`);
  await p.getByLabel('Usuario', { exact: true }).fill(usuario);
  await p.getByLabel('PIN o contraseña').fill(clave);
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.waitForURL((u) => !u.pathname.endsWith('/entrar'), { timeout: 15000 });
  for (const r of rutas) {
    const [ruta, solo] = r.split('@');
    if (solo && solo !== nombre) continue;
    await p.goto(`${base}${ruta}`);
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(900);
    const archivo = `${salida}/${nombre}-${ruta.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'inicio'}.png`;
    await p.screenshot({ path: archivo, fullPage: true });
    const anchoPagina = await p.evaluate(() => document.documentElement.scrollWidth);
    if (anchoPagina > (nombre === 'movil' ? 360 : 1440)) errores.push(`[${nombre}] ${ruta}: desborde horizontal (${anchoPagina}px)`);
    console.log('captura', archivo);
  }
  await ctx.close();
}
await navegador.close();
console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'Sin errores de página.');
