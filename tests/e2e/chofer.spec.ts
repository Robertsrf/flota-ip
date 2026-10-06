import { expect, test } from '@playwright/test';
import { camionLibre, elegir, entrarChoferLibre } from './ayudas';

// Flujo del chofer en el teléfono (sección 9.1): iniciar ruta, finalizar con repostaje.
test.describe.configure({ mode: 'serial' });

test('el chofer inicia una ruta y la finaliza llenando el tanque', async ({ page }) => {
  await entrarChoferLibre(page);
  await expect(page).toHaveURL(/\/cabina$/);

  // Camión libre: DEMO-002 (el DEMO-001 y el DEMO-003 están en ruta en la demo)
  await camionLibre(page);
  const iniciar = page.getByRole('button', { name: 'Iniciar ruta' });
  const t0 = Date.now();
  await iniciar.click();

  await expect(page.getByRole('heading', { name: 'Iniciar ruta' })).toBeVisible();
  await page.getByRole('button', { name: 'Elegir destino' }).click();
  await page.getByRole('button', { name: /^Trujillo/ }).click();
  const km = page.getByLabel('Km de salida');
  const kmSalida = Number((await km.inputValue()).replace(/\D/g, ''));
  expect(kmSalida).toBeGreaterThan(0);
  await elegir(page, 'Combustible al salir', /^Lleno/);
  await page.getByRole('button', { name: 'Iniciar ruta' }).click();

  await expect(page.getByRole('heading', { name: /^En ruta a/ })).toBeVisible();
  await expect(page.getByText('Trujillo', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Ruta iniciada' })).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(30_000); // criterio de aceptación: menos de 30 s

  // Finalizar con repostaje: 100 km y 25 L => 4,00 km/L
  await page.getByRole('link', { name: 'Finalizar ruta' }).click();
  await page.getByLabel('Km de llegada').fill(String(kmSalida + 100));
  await elegir(page, '¿Repostaste al llegar?', 'Sí');
  await page.getByLabel('Litros cargados').fill('25');
  await elegir(page, 'Precio por litro', /0,60/);
  await elegir(page, '¿Llenaste el tanque?', 'Sí');
  const resumen = page.getByRole('region', { name: 'Resumen antes de confirmar' });
  await expect(resumen).toContainText('4,00');
  await expect(resumen).toContainText('$ 15,00');
  await expect(resumen).toContainText('Exacto');
  await page.getByRole('button', { name: 'Finalizar ruta' }).click();

  await expect(page.getByText('Ruta finalizada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('4,00', { exact: true })).toBeVisible();
  await expect(page.getByText('$ 15,00')).toBeVisible();
  // Recién creada: el chofer todavía puede corregirla (ventana de 30 min)
  await expect(page.getByRole('link', { name: 'Corregir datos' })).toBeVisible();
  await page.getByRole('link', { name: 'Listo' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar ruta' })).toBeEnabled();
});

test('el km de llegada menor que el de salida se rechaza con los números', async ({ page }) => {
  await entrarChoferLibre(page);
  await camionLibre(page);
  await page.getByRole('button', { name: 'Iniciar ruta' }).click();
  await page.getByRole('button', { name: 'Elegir destino' }).click();
  await page.getByRole('button', { name: /^Boconó/ }).click();
  const kmSalida = Number((await page.getByLabel('Km de salida').inputValue()).replace(/\D/g, ''));
  await elegir(page, 'Combustible al salir', /^Lleno/);
  await page.getByRole('button', { name: 'Iniciar ruta' }).click();
  await expect(page.getByRole('heading', { name: /^En ruta a/ })).toBeVisible();

  await page.getByRole('link', { name: 'Finalizar ruta' }).click();
  await page.getByLabel('Km de llegada').fill(String(kmSalida - 10));
  await elegir(page, '¿Repostaste al llegar?', 'No');
  await elegir(page, 'Aguja al llegar', '3/4');
  await page.getByRole('button', { name: 'Finalizar ruta' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'es menor que el de salida' })).toBeVisible();

  // Deshacer el inicio desde el historial del chofer no aplica; se cierra bien para dejar el estado limpio
  await page.getByLabel('Km de llegada').fill(String(kmSalida + 40));
  await page.getByRole('button', { name: 'Finalizar ruta' }).click();
  await expect(page.getByText('Ruta finalizada', { exact: true }).first()).toBeVisible();
});

test('el chofer registra un gasto y queda pendiente de aprobación', async ({ page }) => {
  await entrarChoferLibre(page);
  await page.getByRole('link', { name: 'Gasto' }).click();
  await elegir(page, 'Categoría', 'Lavado');
  await elegir(page, 'Moneda', /Dólares/);
  await page.getByLabel('Monto').fill('12');
  await page.getByRole('button', { name: 'Enviar gasto a flota' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'flota lo aprueba' })).toBeVisible();
  await page.getByRole('button', { name: 'Menú' }).click();
  await page.getByRole('button', { name: 'Mis rutas y registros' }).click();
  await expect(page.getByText('Por aprobar').first()).toBeVisible();
});
