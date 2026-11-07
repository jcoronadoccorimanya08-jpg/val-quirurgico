import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

// GitHub Pages publica el sitio en /val-quirurgico/. Para servirlo en la raíz: BASE_PATH=/ npm run build
const base = process.env.BASE_PATH ?? '/val-quirurgico/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Val quirúrgico',
        short_name: 'Val Q',
        description: 'Ciclo de 90 días: 3 rachas núcleo y un premio por cada semana cumplida.',
        lang: 'es-BO',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0E13',
        theme_color: '#0B0E13',
        categories: ['health', 'productivity', 'lifestyle'],
        // Permite que la página detecte si la app ya está instalada (navigator.getInstalledRelatedApps).
        related_applications: [{ platform: 'webapp', url: `https://jcoronadoccorimanya08-jpg.github.io${base}manifest.webmanifest` }],
        prefer_related_applications: false,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
