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

// Mock JSDOM DOM Range methods that CodeMirror needs but JSDOM doesn't fully support
if (typeof Range !== 'undefined' && Range.prototype) {
  Range.prototype.getClientRects = vi.fn(() => ({
    length: 1,
    0: { top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20 },
    item: () => ({ top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20 })
  }));
  
  Range.prototype.getBoundingClientRect = vi.fn(() => ({
    top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20,
    x: 0, y: 0
  }));
}

// Mock document.createRange if needed
if (global.document && !global.document.createRange) {
  global.document.createRange = () => {
    return {
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getClientRects: vi.fn(() => ({
        length: 1,
        0: { top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20 }
      })),
      getBoundingClientRect: vi.fn(() => ({
        top: 0, left: 0, bottom: 20, right: 100, width: 100, height: 20,
        x: 0, y: 0
      }))
    } as unknown as Range;
  };
}

// Mock requestAnimationFrame for CodeMirror animations
if (!global.requestAnimationFrame) {
  global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
}
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = vi.fn(clearTimeout);
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
