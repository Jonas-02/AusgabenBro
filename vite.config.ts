import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages liefert das Repo unter /<Repo-Name>/ aus.
const BASE = '/AusgabenBro/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AusgabenBro',
        short_name: 'Budget',
        description: 'Budget mit täglich befüllten Pots',
        lang: 'de',
        start_url: BASE + '#/budget',
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1E1E1E',
        background_color: '#1E1E1E',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        // Startbilder holt iOS beim Installieren selbst; nicht offline cachen.
        globIgnores: ['**/splash/**'],
        navigateFallback: BASE + 'index.html'
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
