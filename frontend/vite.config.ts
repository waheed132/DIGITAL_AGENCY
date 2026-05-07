import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-expect-error — plain .mjs helper (no types)
import { getPrimaryLanIPv4 } from './dev/lanIpv4.mjs'

const DEV_PORT = 5173
const lan = process.env.VITE_DEV_HMR_HOST?.trim() || getPrimaryLanIPv4()
const backendTarget = (process.env.VITE_BACKEND_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: DEV_PORT,
    strictPort: true,
    allowedHosts: true,
    hmr: lan
      ? { host: lan, port: DEV_PORT, clientPort: DEV_PORT, protocol: 'ws' }
      : { protocol: 'ws' },
    proxy: {
      '/api': backendTarget,
      '/sanctum': backendTarget,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('react-router')) {
            return 'router'
          }
          if (id.includes('lucide-react')) {
            return 'icons'
          }
          if (id.includes('jspdf')) {
            return 'jspdf'
          }
        },
      },
    },
  },
})
