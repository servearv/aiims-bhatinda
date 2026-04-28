import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['offline.html', 'icons/*.png'],

        // ── Web App Manifest ──────────────────────────────────────────
        manifest: {
          name: 'AIIMS Bathinda Health Screening Portal',
          short_name: 'AIIMS Camp',
          description:
            'Real-time medical camp management system for AIIMS Bathinda school health screening',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          background_color: '#020617',
          theme_color: '#06b6d4',
          categories: ['medical', 'health'],
          icons: [
            {
              src: '/icons/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icons/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'maskable',
            },
          ],
        },

        // ── Workbox Service Worker Configuration ──────────────────────
        workbox: {
          // Pre-cache Vite's generated JS/CSS chunks and HTML shell
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

          // Offline fallback: serve offline.html for failed navigations
          // EXCLUDE socket.io paths and API paths from fallback
          navigateFallback: '/offline.html',
          navigateFallbackDenylist: [
            /^\/socket\.io/,   // Socket.IO polling — never intercept
            /^\/api\//,        // API routes — must be network-only
          ],

          runtimeCaching: [
            // ── Static assets (JS chunks, CSS, fonts, images) → Cache First ──
            {
              urlPattern: ({ request }) =>
                ['style', 'script', 'font', 'image'].includes(request.destination),
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-assets-v1',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },

            // ── API calls → Network First (always fresh, 10s timeout) ──
            // NOTE: Caches only GET responses as a stale fallback.
            // POST/PUT/DELETE are never cached.
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache-v1',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 5 * 60, // 5 minutes max stale
                },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],

          // CRITICAL: Never intercept WebSocket upgrade requests or socket.io
          // Socket.IO WebSocket frames are not fetch requests and are safe,
          // but the polling fallback (/socket.io/?EIO=4&transport=polling)
          // IS a fetch — exclude it entirely from SW fetch handling.
          // The navigateFallbackDenylist above handles navigation;
          // runtimeCaching patterns above skip /api/ and /socket.io/
          // because they don't match the patterns defined.
        },

        // ── Dev Options (disable SW in dev to avoid caching dev server) ──
        devOptions: {
          enabled: false,
        },
      }),
    ],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    // ── Code Splitting: manually chunk heavy dashboard components ──
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor: React core
            'vendor-react': ['react', 'react-dom'],
            // Vendor: socket.io client
            'vendor-socket': ['socket.io-client'],
            // Vendor: utility libs
            'vendor-utils': ['date-fns', 'papaparse', 'clsx', 'tailwind-merge', 'lucide-react'],
          },
        },
      },
    },

    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
