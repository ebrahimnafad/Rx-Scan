import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'RxScan',
        short_name: 'RxScan',
        description: 'Pharmacy prescription scanning and management',
        theme_color: '#1862F5',
        background_color: '#E8EDF2',
        display: 'standalone',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/docs\.google\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sheets-cache',
              expiration: { maxEntries: 10 },
            },
          },
        ],
        // Import the promote-scheduled module
        importScripts: ['/sw-promote-scheduled.js'],
      },
    }),
  ],
});
