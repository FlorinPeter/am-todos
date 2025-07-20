import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for BACKEND_URL
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('githubService - Focused Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockLocation.hostname = 'localhost';
    mockLocation.port = '3000';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('listProjectFolders error handling', () => {
    it('should handle network errors and return default fallback', async () => {
      // Mock network error to trigger catch block (lines 463-465)
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should log the error and return default fallback
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing project folders:', expect.any(Error));
      expect(result).toEqual(['todos']);
    });

    it('should handle API errors and return default fallback', async () => {
      // Mock API error response to trigger catch block (lines 463-465)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server Error')
      });

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should log the error and return default fallback
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing project folders:', expect.any(Error));
      expect(result).toEqual(['todos']);
    });
  });

  describe('getFileAtCommit function', () => {
    it('should successfully fetch file at specific commit', async () => {
      // Mock successful response - covers lines 495-518
      const expectedData = {
        content: 'file content at commit',
        sha: 'abc123',
        path: 'test/file.md'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedData)
      });

      const { getFileAtCommit } = await import('../githubService');

      const result = await getFileAtCommit('testtoken', 'testowner', 'testrepo', 'test/file.md', 'abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/file-at-commit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'token testtoken',
          },
          body: JSON.stringify({
            path: 'test/file.md',
            sha: 'abc123',
            owner: 'testowner',
            repo: 'testrepo'
          })
        }
      );

      expect(result).toEqual(expectedData);
    });

    it('should handle API errors in getFileAtCommit', async () => {
      // Mock error response to test error handling (lines 510-513)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found at commit')
      });

      const { getFileAtCommit } = await import('../githubService');

      await expect(getFileAtCommit('testtoken', 'testowner', 'testrepo', 'test/file.md', 'abc123'))
        .rejects.toThrow('Failed to fetch file at commit: Not Found');

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch file at commit:', 'File not found at commit');
    });

    it('should handle network errors in getFileAtCommit', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { getFileAtCommit } = await import('../githubService');

      await expect(getFileAtCommit('testtoken', 'testowner', 'testrepo', 'test/file.md', 'abc123'))
        .rejects.toThrow('Network failure');
    });

    it('should work with different backend URLs', async () => {
      // Test with external IP to ensure BACKEND_URL logic works
      mockLocation.hostname = '159.65.120.9';
      
      const expectedData = { content: 'external content' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedData)
      });

      const { getFileAtCommit } = await import('../githubService');

      await getFileAtCommit('testtoken', 'testowner', 'testrepo', 'test/file.md', 'abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/file-at-commit',
        expect.any(Object)
      );
    });

    it('should handle malformed JSON response', async () => {
      // Mock response with invalid JSON
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const { getFileAtCommit } = await import('../githubService');

      await expect(getFileAtCommit('testtoken', 'testowner', 'testrepo', 'test/file.md', 'abc123'))
        .rejects.toThrow('Invalid JSON');
    });
  });

  describe('edge cases and environment variations', () => {
    it('should use relative URLs for all environments', async () => {
      const testCases = [
        { hostname: 'localhost', port: '3000' },
        { hostname: '127.0.0.1', port: '3000' },
        { hostname: 'production.example.com', port: '80' },
      ];

      for (const testCase of testCases) {
        vi.resetModules();
        vi.clearAllMocks();
        
        mockLocation.hostname = testCase.hostname;
        mockLocation.port = testCase.port;
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: 'test' })
        });

        const { getFileAtCommit } = await import('../githubService');
        
        await getFileAtCommit('token', 'owner', 'repo', 'path', 'sha');
        
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/file-at-commit',
          expect.any(Object)
        );
      }
    });
  });
});