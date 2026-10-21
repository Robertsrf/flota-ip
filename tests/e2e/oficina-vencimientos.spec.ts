import { expect, test } from '@playwright/test';
import { entrar } from './ayudas';

test('flota marca hecho un servicio vencido y deja de ser alerta', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await page.getByRole('link', { name: 'Vencimientos' }).first().click();
  await expect(page.getByRole('heading', { name: 'Vencimientos', level: 1 })).toBeVisible();
  // En la demo, el cambio de aceite del Camión 3 se pasó por 200 km
  const fila = page.getByRole('listitem').filter({ hasText: 'Camión 3 (DEMO-003)' }).filter({ hasText: 'Cambio de aceite' });
  await expect(fila.getByText('Vencido')).toBeVisible();
  await expect(fila.getByText(/Se pasó por 200\skm/)).toBeVisible();
  await fila.getByRole('button', { name: 'Marcar hecho' }).click();
  const hoja = page.getByRole('dialog');
  await expect(hoja.getByLabel('Km del tablero ese día')).not.toHaveValue('');
  await hoja.getByLabel('Nota').fill('Hecho en el taller de la sede');
  await hoja.getByRole('button', { name: 'Marcar hecho' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cambio de aceite: hecho' })).toBeVisible();
  await expect(fila.getByText('Al día')).toBeVisible();
  await expect(fila.getByText(/Faltan 5\.000\skm/)).toBeVisible();
});

test('flota renueva una póliza por vencer y el anterior queda en el historial', async ({ page }) => {
  await entrar(page, 'demo.flota', 'demo1234');
  await page.goto('/vencimientos?pestana=documentos');
  const fila = page.getByRole('listitem').filter({ hasText: 'Póliza RCV' }).filter({ hasText: 'Camión 1 (DEMO-001)' });
  await expect(fila.getByText('Por vencer')).toBeVisible();
  await fila.getByRole('button', { name: 'Renovar' }).click();
  const hoja = page.getByRole('dialog');
  const anio = new Date().getFullYear() + 1;
  await hoja.getByLabel('Nuevo vencimiento').fill(`${anio}-10-29`);
  await hoja.getByLabel('Número').fill('RCV-DEMO-001-B');
  await hoja.getByRole('button', { name: 'Renovar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Póliza RCV renovado' })).toBeVisible();
  const nueva = page.getByRole('listitem').filter({ hasText: 'N.º RCV-DEMO-001-B' });
  await expect(nueva.getByText('Al día')).toBeVisible();
  await page.getByLabel('Mostrar los renovados y archivados').check();
  await expect(page.getByRole('listitem').filter({ hasText: 'N.º RCV-DEMO-001 •' }).getByText('Archivado', { exact: true })).toBeVisible();
});

test.describe('oficina desde el teléfono', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('los filtros van en una hoja y el resumen dice qué se está viendo', async ({ page }) => {
    await entrar(page, 'demo.flota', 'demo1234');
    await page.goto('/viajes');
    const filtros = page.getByRole('button', { name: /Filtros/ });
    await expect(filtros).toContainText('Este mes');
    await filtros.click();
    const hoja = page.getByRole('dialog', { name: 'Filtros' });
    await hoja.getByLabel('Estado').selectOption('en_curso');
    await hoja.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(filtros).toContainText('En ruta');
    await expect(page.getByRole('heading', { name: /^\d+ viajes?$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Limpiar' })).toBeVisible();
  });

  test('se edita un destino y se da un PIN nuevo tocando la fila', async ({ page }) => {
    await entrar(page, 'demo.flota', 'demo1234');
    await page.goto('/catalogos');
    await page.getByRole('button', { name: /^Boconó/ }).click();
    const hoja = page.getByRole('dialog', { name: 'Editar ubicación' });
    await expect(hoja.getByRole('button', { name: 'Eliminar' })).toBeVisible();
    await hoja.getByRole('button', { name: 'Cancelar' }).click();

    await page.goto('/usuarios');
    await page.getByRole('button', { name: /^Luis Mora/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Nuevo PIN' }).click();
    const pin = page.getByRole('dialog', { name: /Nuevo PIN para Luis Mora/ });
    await expect(pin.getByLabel('PIN de 6 dígitos')).toHaveValue(/^\d{6}$/);
  });
});
