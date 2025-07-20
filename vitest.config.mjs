import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: false,
    // Performance optimizations
    pool: 'forks',  // Use fork pool for better isolation and performance
    poolOptions: {
      forks: {
        singleFork: true,  // Use single fork on single-core systems
      }
    },
    // Keep test isolation for stability
    isolate: true,
    // Optimize file watching
    watchExclude: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/build/**',
      '**/dist/**',
    ],
    exclude: [
      '**/node_modules/**',
      'server/**/__tests__/**',  // Exclude server tests from frontend test runs
    ],
    // Faster test execution
    testTimeout: 10000,  // 10 second timeout
    hookTimeout: 10000,  // 10 second hook timeout
    coverage: {
      provider: 'v8',  // Explicitly set faster v8 provider
      reporter: ['text', 'json', 'html'],  // Reduce reporters for speed
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
        '.github/**',
        'server/**',  // Exclude server files from coverage
        'scripts/**',  // Exclude scripts folder from coverage
      ],
    },
  },
})