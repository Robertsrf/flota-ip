import { expect, type Page } from '@playwright/test';

export async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto('/entrar');
  await page.getByLabel('Usuario', { exact: true }).fill(usuario);
  await page.getByLabel('PIN o contraseña').fill(clave);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

/** Elige una opción de un grupo de botones segmentados */
export async function elegir(page: Page, grupo: string, opcion: string | RegExp) {
  await page.getByRole('radiogroup', { name: grupo }).getByRole('radio', { name: opcion }).click();
}

/** En la cabina, deja elegido un camión libre (en la demo, DEMO-002) */
export async function camionLibre(page: Page) {
  const iniciar = page.getByRole('button', { name: 'Iniciar ruta' });
  await expect(iniciar).toBeVisible();
  if (await iniciar.isDisabled()) {
    await page.getByRole('button', { name: 'Cambiar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /DEMO-002/ }).click();
  }
  await expect(iniciar).toBeEnabled();
}

/** Entra con un chofer demo sin ruta abierta (uno de los dos tiene la ruta de hoy) */
export async function entrarChoferLibre(page: Page): Promise<string> {
  for (const usuario of ['demo.luis', 'demo.pedro']) {
    await entrar(page, usuario, '123456');
    const iniciar = page.getByRole('button', { name: 'Iniciar ruta' });
    const finalizar = page.getByRole('link', { name: 'Finalizar ruta' });
    await expect(iniciar.or(finalizar)).toBeVisible();
    if (await iniciar.isVisible()) return usuario;
    await page.evaluate(() => localStorage.clear());
  }
  throw new Error('Ningún chofer demo está libre');
}
