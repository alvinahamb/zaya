import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 pour que le serveur soit joignable depuis l'hôte quand on tourne
    // dans un conteneur
    host: true,
    port: 5173,
    watch: {
      // Les bind mounts Docker sur Windows/macOS ne propagent pas les
      // évènements inotify : le polling est nécessaire pour le HMR
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      // Images de produits téléversées, servies par l'API
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
