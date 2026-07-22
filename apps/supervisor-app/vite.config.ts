import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'GoMax Batch QC — Supervisor',
        short_name: 'GoMax QC',
        description: 'Batch verification checklist for plant supervisors',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache the app shell so it opens offline-tolerant on shaky
        // factory wifi; API calls to Supabase always go to the network
        // (batch data must never be served stale/offline — see
        // NetworkOnly runtime rule below).
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Worker/product photos live under public/ and match the glob above
        // (they're .png/.jpg), but they're content, not app shell, can be
        // large (uploaded straight from a phone, no resizing), and keep
        // growing as more get added — precaching them at service-worker
        // install time is what broke the build (a single 2MB+ photo fails
        // Workbox's default precache size limit). Regular HTTP caching
        // handles them fine on demand instead.
        globIgnores: ['products/**', 'avatars/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/products/') || url.pathname.startsWith('/avatars/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'content-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        // A new deployment should take over immediately instead of the
        // previously installed service worker continuing to serve a
        // stale cached build until every open tab is closed.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
