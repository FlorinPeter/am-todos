import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: false,
    exclude: [
      '**/node_modules/**',
      'server/**/__tests__/**',  // Exclude server tests from frontend test runs
    ],
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
        'vitest.fast.config.mjs',
        '.github/**',
        'server/**',  // Exclude server files from coverage
        'scripts/**',  // Exclude scripts folder from coverage
      ],
    },
  },
})