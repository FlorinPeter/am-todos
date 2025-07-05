// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Global test configuration
global.console = {
  ...console,
  // Reduce noise in test output while keeping important logs
  warn: jest.fn(),
  error: jest.fn(),
  log: console.log, // Keep logs for debugging
};

// Mock environment variables for tests
process.env.REACT_APP_TEST_MODE = 'true';

// Increase timeout for integration tests
jest.setTimeout(60000);

// Mock fetch if needed for unit tests (integration tests use real fetch)
if (process.env.NODE_ENV === 'test' && !process.env.INTEGRATION_TEST) {
  global.fetch = jest.fn();
}
