import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'Felt',
        short_name: 'Felt',
        description: 'Anchor weather forecasts in recent observations.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
