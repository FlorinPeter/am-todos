import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVersionInfo } from '../versionService';

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('versionService - Targeted Coverage (lines 21-23)', () => {
  let mockLogger: { error: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked logger
    const logger = await import('../../utils/logger');
    mockLogger = vi.mocked(logger.default);
  });

  it('should handle HTTP error responses (line 21)', async () => {
    // Test line 21: throw new Error(`HTTP error! status: ${response.status}`);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: vi.fn()
    });

    const result = await getVersionInfo();

    // Should fall back to environment variables when HTTP error occurs
    expect(result).toEqual({
      version: '0.1.0', // default fallback
      gitSha: 'development', // default fallback  
      gitTag: null,
      buildDate: null,
      nodeEnv: 'test' // vitest sets NODE_ENV=test
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to fetch version info:',
      expect.any(Error)
    );
  });

  it('should handle HTTP 500 server error (line 21)', async () => {
    // Test line 21 with different status code
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn()
    });

    const result = await getVersionInfo();

    expect(result.version).toBe('0.1.0');
    expect(result.gitSha).toBe('development');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to fetch version info:',
      expect.objectContaining({
        message: 'HTTP error! status: 500'
      })
    );
  });

  it('should handle JSON parsing errors (line 23)', async () => {
    // Test line 23: return await response.json(); - when json() throws
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    });

    const result = await getVersionInfo();

    // Should fall back to environment variables when JSON parsing fails
    expect(result).toEqual({
      version: '0.1.0',
      gitSha: 'development',
      gitTag: null,
      buildDate: null,
      nodeEnv: 'test'
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to fetch version info:',
      expect.objectContaining({
        message: 'Invalid JSON'
      })
    );
  });

  it('should handle successful response and JSON parsing', async () => {
    // Test successful path to ensure we cover the happy path too
    const mockVersionData = {
      version: '1.2.3',
      gitSha: 'abc123def456',
      gitTag: 'v1.2.3',
      buildDate: '2023-12-25T10:30:00Z',
      nodeEnv: 'production'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockVersionData)
    });

    const result = await getVersionInfo();

    expect(result).toEqual(mockVersionData);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should handle network errors during fetch', async () => {
    // Test network error (different from HTTP error)
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await getVersionInfo();

    expect(result).toEqual({
      version: '0.1.0',
      gitSha: 'development', 
      gitTag: null,
      buildDate: null,
      nodeEnv: 'test'
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to fetch version info:',
      expect.objectContaining({
        message: 'Network error'
      })
    );
  });

  it('should use environment variables as fallback values', async () => {
    // Test fallback logic with custom environment variables
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      REACT_APP_VERSION: '2.0.0',
      REACT_APP_GIT_SHA: 'custom-sha',
      REACT_APP_GIT_TAG: 'v2.0.0',
      REACT_APP_BUILD_DATE: '2023-12-31T23:59:59Z',
      NODE_ENV: 'development'
    };

    mockFetch.mockRejectedValue(new Error('Fetch failed'));

    const result = await getVersionInfo();

    expect(result).toEqual({
      version: '2.0.0',
      gitSha: 'custom-sha',
      gitTag: 'v2.0.0', 
      buildDate: '2023-12-31T23:59:59Z',
      nodeEnv: 'development'
    });

    // Restore environment
    process.env = originalEnv;
  });
});