import { expect, test } from '@playwright/test';
import { entrar } from './ayudas';

test('gerencia (consulta) solo lee: sin revisión, catálogos ni botones de registro', async ({ page }) => {
  await entrar(page, 'demo.gerencia', 'demo1234');
  await expect(page).toHaveURL(/\/dashboard/);
  const nav = page.getByRole('navigation', { name: 'Principal' }).first();
  await expect(nav.getByRole('link', { name: /Revisión/ })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Catálogos' })).toHaveCount(0);
  await page.goto('/revision');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/mantenimiento');
  await expect(page.getByRole('heading', { name: 'Mantenimiento', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Registrar gasto' })).toHaveCount(0);
  await page.goto('/cabina');
  await expect(page).toHaveURL(/\/dashboard/);
});

test('el chofer no entra a catálogos ni a usuarios', async ({ page }) => {
  await entrar(page, 'demo.pedro', '123456');
  await page.goto('/catalogos');
  await expect(page).toHaveURL(/\/cabina/);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/cabina/);
});

test('usuario o PIN incorrectos muestran un error claro', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('Usuario', { exact: true }).fill('demo.pedro');
  await page.getByLabel('PIN o contraseña').fill('000000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Usuario o clave incorrectos.' })).toBeVisible();
});
