module.exports = {
  // Use the default Jest configuration from Create React App
  preset: 'react-scripts',
  
  // Transform ES modules to CommonJS for testing
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|micromark|decode-named-character-reference|character-entities|property-information|hast-util-whitespace|space-separated-tokens|comma-separated-tokens)/)'
  ],
  
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^react-markdown$': '<rootDir>/src/__mocks__/react-markdown.js',
    '^remark-gfm$': '<rootDir>/src/__mocks__/remark-gfm.js'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts'
  ],
  
  // Test timeout
  testTimeout: 30000
};