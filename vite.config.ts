import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { cspPlugin } from './scripts/csp.mjs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE || '/';
  return {
    base,
    define: { __VERSION__: JSON.stringify(version) },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(env.VITE_SUPABASE_URL),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'iconos/apple-touch-icon.png'],
        manifest: {
          name: 'Flota IP',
          short_name: 'Flota IP',
          description: 'Rutas, combustible y mantenimiento de la flota de Distribuidora y Suministros IP',
          lang: 'es-VE',
          theme_color: '#0f5b3f',
          background_color: '#f4f5f3',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Gráficos y Excel solo los usa la oficina: no se precargan en el teléfono del chofer
          globIgnores: ['**/graficos-*.js', '**/xlsx-*.js'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /\/assets\/(graficos|xlsx)-.*\.js$/.test(url.pathname),
              handler: 'CacheFirst',
              options: { cacheName: 'flota-modulos-oficina', expiration: { maxEntries: 10 } },
            },
          ],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/(rest|auth|storage|functions|realtime)\//],
          maximumFileSizeToCacheInBytes: 3_000_000,
        },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, host: '127.0.0.1' },
    preview: { port: 4173, host: '127.0.0.1' },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
