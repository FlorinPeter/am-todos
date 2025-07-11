import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

// Simple Vite configuration for CI compatibility - updated for ESM
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tsconfigPaths(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      open: true,
      ...(mode === 'development' && {
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
            secure: false,
          },
        },
      }),
    },
    build: {
      outDir: 'build',
      sourcemap: false,
    },
    base: '',
    resolve: {
      alias: [{ find: /^~([^/])/, replacement: '$1' }],
    },
  }
})