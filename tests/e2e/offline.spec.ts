import { expect, test } from '@playwright/test';
import { camionLibre, elegir, entrarChoferLibre } from './ayudas';

// D4 nivel 2: sin señal la ruta queda en el teléfono y se envía sola al volver.
test('iniciar ruta sin señal la guarda en el teléfono y la envía al volver la señal', async ({ page, context }) => {
  await entrarChoferLibre(page);
  await camionLibre(page);
  await page.getByRole('button', { name: 'Iniciar ruta' }).click();
  await page.getByRole('button', { name: 'Elegir destino' }).click();
  await page.getByRole('button', { name: /^Mérida/ }).click();
  await elegir(page, 'Combustible al salir', /^Lleno/);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Iniciar ruta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'guardada en el teléfono' })).toBeVisible();
  await expect(page.getByText('En ruta a')).toBeVisible();
  await expect(page.getByText('Pendiente de envío')).toBeVisible();
  await expect(page.getByText('1 registro esperando señal')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('1 registro esperando señal')).toBeHidden({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByText(/^V-\d{4}$/)).toBeVisible();
  await expect(page.getByText('Pendiente de envío')).toBeHidden();

  // Dejar el estado limpio: finalizar sin repostar
  await page.getByRole('link', { name: 'Finalizar ruta' }).click();
  const salida = await page.getByText(/salió en el km/).innerText();
  const km = Number(/km ([\d.]+)/.exec(salida)![1].replace(/\./g, ''));
  await page.getByLabel('Km de llegada').fill(String(km + 50));
  await elegir(page, '¿Repostaste al llegar?', 'No');
  await elegir(page, 'Aguja al llegar', '3/4');
  await page.getByRole('button', { name: 'Finalizar ruta' }).click();
  await expect(page.getByText('Ruta finalizada', { exact: true }).first()).toBeVisible();
});
