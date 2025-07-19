// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Global test configuration
global.console = {
  ...console,
  // Reduce noise in test output while keeping important logs
  warn: vi.fn(),
  error: vi.fn(),
  log: console.log, // Keep logs for debugging
};

// Mock fetch for all tests to avoid real API calls
global.fetch = vi.fn();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: vi.fn(() => true),
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
