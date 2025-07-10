import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['*.js', '!**/__tests__/**', '!**/node_modules/**'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '*.test.js',
        '*.config.js',
        '*.config.mjs'
      ]
    }
  }
})