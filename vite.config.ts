import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' so the build works at https://<user>.github.io/<any-repo-name>/
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    {
      name: 'strip-gh-redirect',
      apply: 'build',
      transformIndexHtml: (html: string) => html.replace(/\s*<!--gh-pages-redirect-->[\s\S]*?<!--\/gh-pages-redirect-->/, ''),
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'favicon.png'],
      manifest: {
        name: 'BirdlyQuest',
        short_name: 'BirdlyQuest',
        description: 'Discover real birds with your camera. A pixel bird-finding quest.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0C0F',
        theme_color: '#0A0C0F',
        categories: ['games', 'education', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,webmanifest,mp3}'],
        globIgnores: ['**/music/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/music\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'music', rangeRequests: true, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 4 } }
          },
          {
            urlPattern: /^https:\/\/([abc]\.)?tile\.openstreetmap\.(org|fr)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 600, maxAgeSeconds: 30 * 864e2 } }
          },
          {
            urlPattern: /^https:\/\/api\.inaturalist\.org\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'inat-api', networkTimeoutSeconds: 8, cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 120, maxAgeSeconds: 7 * 864e2 } }
          },
          {
            // iNaturalist reference photos (opaque cross-origin images → status 0)
            urlPattern: /^https:\/\/(inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//,
            handler: 'CacheFirst',
            options: { cacheName: 'ref-photos', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 300, maxAgeSeconds: 60 * 864e2 } }
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 4, expiration: { maxEntries: 20, maxAgeSeconds: 86400 } }
          }
        ]
      }
    })
  ],
  build: { target: ['es2020', 'safari14', 'chrome87', 'firefox78'] },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
} as any);
