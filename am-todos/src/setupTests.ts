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

// Mock fetch for all tests to avoid real API calls
global.fetch = jest.fn();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: jest.fn(() => true),
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  (fetch as jest.Mock).mockClear();
});
