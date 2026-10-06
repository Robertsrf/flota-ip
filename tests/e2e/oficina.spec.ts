import { expect, test } from '@playwright/test';
import { elegir, entrar } from './ayudas';

test('flota ve el dashboard con KPI, rutas en curso y alertas', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
  for (const kpi of ['Gasto total', 'Combustible', 'Mantenimiento', 'Km recorridos', 'Rendimiento', 'Costo por km']) {
    await expect(page.getByRole('term').filter({ hasText: new RegExp(`^${kpi}$`) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: /Ahora mismo: \d/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Alertas \(\d+\)/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Gasto mensual' })).toBeVisible();
});

test('flota aprueba un gasto del chofer desde la revisión', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await page.getByRole('link', { name: /Revisión/ }).first().click();
  const seccion = page.getByRole('region', { name: /Gastos por aprobar/ });
  await expect(seccion.getByRole('button', { name: 'Aprobar' }).first()).toBeVisible();
  const antes = await seccion.getByRole('button', { name: 'Aprobar' }).count();
  expect(antes).toBeGreaterThan(0);
  await seccion.getByRole('button', { name: 'Aprobar' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: /aprobado/ })).toBeVisible();
  await expect(seccion.getByRole('button', { name: 'Aprobar' })).toHaveCount(antes - 1);
});

test('flota registra un gasto en bolívares y ve su equivalente en dólares (T9)', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await page.goto('/mantenimiento');
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  const hoja = page.getByRole('dialog');
  await hoja.getByLabel('Unidad').selectOption({ label: 'DEMO-002, Camión 2' });
  await hoja.getByLabel('Categoría').selectOption({ label: 'Cauchos' });
  await elegir(page, 'Moneda', /Bolívares/);
  await hoja.getByLabel('Monto').fill('37900');
  await hoja.getByLabel('Tasa BCV (Bs por $)').fill('379');
  await expect(hoja.getByText('Equivale a $ 100,00')).toBeVisible();
  await hoja.getByRole('button', { name: 'Registrar gasto' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gasto registrado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bs 37.900,00' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '$ 100,00' }).first()).toBeVisible();
});

test('flota corrige el km de llegada de una ruta con motivo y queda en el historial', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await page.goto('/viajes');
  await page.getByLabel('Estado').selectOption('cerrado');
  await page.getByRole('row').nth(1).click();
  await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
  const kmAntes = Number((await page.getByText('Recorrido').locator('..').innerText()).replace(/\D/g, ''));
  await page.getByRole('button', { name: 'Corregir' }).first().click();
  const hoja = page.getByRole('dialog');
  const campo = hoja.getByLabel('Km de llegada');
  const llegada = Number((await campo.inputValue()).replace(/\D/g, ''));
  await campo.fill(String(llegada + 10));
  await hoja.getByLabel('Motivo de la corrección').fill('La foto del tablero marca 10 km más');
  await hoja.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Corrección guardada' })).toBeVisible();
  await expect(page.getByText(`${(kmAntes + 10).toLocaleString('es-VE', { useGrouping: 'always' } as Intl.NumberFormatOptions)} km`).first()).toBeVisible();
  await expect(page.getByText('Motivo: La foto del tablero marca 10 km más')).toBeVisible();
});
