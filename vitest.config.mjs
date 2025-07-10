import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: false,
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/**/*.test.*',
        'src/**/__tests__/**',
        'src/__mocks__/**',
        'src/reportWebVitals.ts',
        'src/index.tsx',
        'src/react-app-env.d.ts',
        'vite.config.mjs',
        'vitest.config.mjs',
        'postcss.config.js',
        'tailwind.config.js',
      ],
    },
  },
})