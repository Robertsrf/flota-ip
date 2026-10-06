import { defineConfig, devices } from '@playwright/test';

// Pruebas de punta a punta contra el servidor local (PGlite + migraciones reales + seed demo).
// Una sola base para todas las pruebas: corren en serie y en orden.
const PUERTO_VITE = 5179;
const PUERTO_BACKEND = 54329;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO_VITE}`,
    locale: 'es-VE',
    timezoneId: 'America/Caracas',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'telefono',
      use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'msedge' },
      testMatch: /chofer|offline/,
    },
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: process.env.CI ? undefined : 'msedge' },
      testMatch: /oficina|permisos/,
    },
  ],
  webServer: {
    command: 'node scripts/backend-local/server.mjs --with-vite --reset',
    url: `http://127.0.0.1:${PUERTO_VITE}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PUERTO_BACKEND: String(PUERTO_BACKEND),
      PUERTO_VITE: String(PUERTO_VITE),
      DIR_DB_LOCAL: '.local-db-e2e',
    },
  },
});
