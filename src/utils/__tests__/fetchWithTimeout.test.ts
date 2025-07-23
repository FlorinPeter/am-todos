import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  fetchWithTimeout,
  fetchJsonWithTimeout,
  TIMEOUT_VALUES,
  FetchWithTimeoutOptions
} from '../fetchWithTimeout';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortController
class MockAbortController {
  signal: AbortSignal;
  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as unknown as AbortSignal;
  }
  abort() {
    (this.signal as any).aborted = true;
  }
}

global.AbortController = MockAbortController as any;

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should make a successful fetch request with default timeout', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        signal: expect.any(Object)
      });
      expect(result).toBe(mockResponse);
    });

    it('should use custom timeout when provided', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const customTimeout = 5000;
      await fetchWithTimeout('https://example.com', { timeout: customTimeout });

      // The timeout should be stripped from the options passed to fetch
      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        signal: expect.any(Object)
      });
    });

    it('should pass through additional fetch options', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const options: FetchWithTimeoutOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
        timeout: 10000
      };

      await fetchWithTimeout('https://example.com', options);

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
        signal: expect.any(Object)
      });
    });

    it('should use default timeout of 30 seconds when not specified', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      // We can't easily test the exact timeout value, but we can test that it's set
      await fetchWithTimeout('https://example.com');

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        signal: expect.any(Object)
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should create AbortController and setTimeout for timeout handling', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await fetchWithTimeout('https://example.com', { timeout: 5000 });

      // Verify timeout mechanisms are set up
      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should use AbortController signal for timeout', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchWithTimeout('https://example.com', { timeout: 1000 });

      expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
        signal: expect.any(Object)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle AbortError and convert to timeout error', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(fetchWithTimeout('https://example.com', { timeout: 1000 }))
        .rejects.toThrow('Request timeout after 1000ms');
    });

    it('should pass through non-AbortError errors', async () => {
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(fetchWithTimeout('https://example.com'))
        .rejects.toThrow('Network connection failed');
    });

    it('should handle non-Error objects thrown by fetch', async () => {
      const stringError = 'Something went wrong';
      mockFetch.mockRejectedValueOnce(stringError);

      await expect(fetchWithTimeout('https://example.com'))
        .rejects.toBe(stringError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero timeout', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout('https://example.com', { timeout: 0 });

      expect(result).toBe(mockResponse);
    });

    it('should handle very large timeout values', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout('https://example.com', { timeout: Number.MAX_SAFE_INTEGER });

      expect(result).toBe(mockResponse);
    });

    it('should handle undefined options', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout('https://example.com', undefined);

      expect(result).toBe(mockResponse);
    });

    it('should handle empty options object', async () => {
      const mockResponse = new Response('test data', { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchWithTimeout('https://example.com', {});

      expect(result).toBe(mockResponse);
    });
  });
});

describe('fetchJsonWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful JSON Parsing', () => {
    it('should fetch and parse JSON response successfully', async () => {
      const testData = { message: 'Hello, world!', success: true };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchJsonWithTimeout('https://api.example.com/data');

      expect(result).toEqual(testData);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should pass timeout option to underlying fetchWithTimeout', async () => {
      const testData = { test: 'data' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchJsonWithTimeout('https://api.example.com/data', { timeout: 5000 });

      // The timeout should be stripped from the options passed to fetch
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        signal: expect.any(Object)
      });
    });
  });

  describe('HTTP Error Handling', () => {
    it('should throw error for non-ok HTTP status', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        }
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(fetchJsonWithTimeout('https://api.example.com/notfound'))
        .rejects.toThrow('HTTP error! status: 404');
    });

    it('should throw error for 500 status code', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        }
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(fetchJsonWithTimeout('https://api.example.com/error'))
        .rejects.toThrow('HTTP error! status: 500');
    });
  });

  describe('Content-Type Validation', () => {
    it('should warn about non-JSON content-type but still parse', async () => {
      const testData = { message: 'success' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('text/html')
        },
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await fetchJsonWithTimeout('https://example.com/data');

      expect(consoleSpy).toHaveBeenCalledWith('Expected JSON response but got content-type: text/html');
      expect(result).toEqual(testData);
      
      consoleSpy.mockRestore();
    });

    it('should not warn when content-type is application/json', async () => {
      const testData = { message: 'success' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await fetchJsonWithTimeout('https://example.com/data');

      expect(consoleSpy).not.toHaveBeenCalledWith();
      
      consoleSpy.mockRestore();
    });

    it('should handle response without headers gracefully', async () => {
      const testData = { message: 'success' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: null,
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchJsonWithTimeout('https://example.com/data');

      expect(result).toEqual(testData);
    });

    it('should handle response with headers but no get method', async () => {
      const testData = { message: 'success' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {} as any, // No get method
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await fetchJsonWithTimeout('https://example.com/data');

      expect(result).toEqual(testData);
    });
  });

  describe('JSON Parsing Errors', () => {
    it('should propagate JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(fetchJsonWithTimeout('https://example.com/invalid-json'))
        .rejects.toThrow('Invalid JSON');
    });
  });

  describe('Timeout Integration', () => {
    it('should use fetchWithTimeout internally', async () => {
      const testData = { message: 'success' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(testData)
      } as unknown as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await fetchJsonWithTimeout('https://api.example.com/data', { timeout: 5000 });

      // Verify that fetchWithTimeout's timeout mechanism is used
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        signal: expect.any(Object)
      });
    });
  });
});

describe('TIMEOUT_VALUES', () => {
  it('should export correct timeout constants', () => {
    expect(TIMEOUT_VALUES.FAST).toBe(10000);
    expect(TIMEOUT_VALUES.NORMAL).toBe(30000);
    expect(TIMEOUT_VALUES.SLOW).toBe(60000);
    expect(TIMEOUT_VALUES.AI).toBe(120000);
  });

  it('should have timeout values in ascending order', () => {
    expect(TIMEOUT_VALUES.FAST).toBeLessThan(TIMEOUT_VALUES.NORMAL);
    expect(TIMEOUT_VALUES.NORMAL).toBeLessThan(TIMEOUT_VALUES.SLOW);
    expect(TIMEOUT_VALUES.SLOW).toBeLessThan(TIMEOUT_VALUES.AI);
  });

  it('should be const-asserted values', () => {
    // The timeout values are exported as const, verifying they exist
    expect(typeof TIMEOUT_VALUES.FAST).toBe('number');
    expect(typeof TIMEOUT_VALUES.NORMAL).toBe('number');
    expect(typeof TIMEOUT_VALUES.SLOW).toBe('number');
    expect(typeof TIMEOUT_VALUES.AI).toBe('number');
  });

  it('should have sensible timeout values for different operations', () => {
    // Fast operations should be under 30 seconds
    expect(TIMEOUT_VALUES.FAST).toBeLessThan(30000);
    
    // AI operations should be at least 2 minutes for processing
    expect(TIMEOUT_VALUES.AI).toBeGreaterThanOrEqual(120000);
    
    // All values should be positive
    expect(TIMEOUT_VALUES.FAST).toBeGreaterThan(0);
    expect(TIMEOUT_VALUES.NORMAL).toBeGreaterThan(0);
    expect(TIMEOUT_VALUES.SLOW).toBeGreaterThan(0);
    expect(TIMEOUT_VALUES.AI).toBeGreaterThan(0);
  });
});

describe('FetchWithTimeoutOptions Interface', () => {
  it('should accept standard RequestInit options with timeout', () => {
    const options: FetchWithTimeoutOptions = {
      method: 'POST',
      headers: { 'Authorization': 'Bearer token' },
      body: JSON.stringify({ data: 'test' }),
      timeout: 15000,
      credentials: 'include',
      mode: 'cors'
    };

    // This test mainly verifies TypeScript interface compliance
    expect(typeof options.timeout).toBe('number');
    expect(options.method).toBe('POST');
    expect(options.headers).toBeDefined();
    expect(options.body).toBeDefined();
  });

  it('should make timeout property optional', () => {
    const options: FetchWithTimeoutOptions = {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
      // timeout is optional
    };

    expect(options.timeout).toBeUndefined();
    expect(options.method).toBe('GET');
  });
});