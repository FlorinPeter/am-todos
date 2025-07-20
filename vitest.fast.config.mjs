import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Use happy-dom for 2-3x faster DOM operations
    environment: 'happy-dom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    css: false,
    
    // Use default threading (optimized for single-core automatically)
    // No custom pool configuration - let Vitest decide
    
    // Keep test isolation for stability 
    isolate: true,
    
    // Faster timeouts
    testTimeout: 5000,  // 5 second timeout (vs 10 second default)
    hookTimeout: 5000,  // 5 second hook timeout
    
    // Minimal output for speed
    reporter: 'dot',
    
    // Exclude same files as main config
    exclude: [
      '**/node_modules/**',
      'server/**/__tests__/**',  // Exclude server tests from frontend test runs
    ],
    
    // Coverage configuration for fast runs (when --coverage is used)
    coverage: {
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
        'server/**',
        'scripts/**',
        'src/types/**',  // Exclude TypeScript interface files (no executable code)
      ],
    },
    
    // File watching optimizations (for dev mode)
    watchExclude: [
      '**/node_modules/**',
      '**/coverage/**',
      '**/build/**',
      '**/dist/**',
    ],
  },
})