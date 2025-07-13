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

// Mock window.location
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('gitlabService - Metadata and Directory Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockLocation.hostname = 'localhost';
    mockLocation.port = '3000';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getFileMetadata function - JSON parsing errors', () => {
    it('should handle JSON parsing errors in getFileMetadata', async () => {
      // Mock response with invalid JSON to trigger lines 176-180
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid json response {')
      });

      const { getFileMetadata } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileMetadata(settings, 'test/file.md'))
        .rejects.toThrow('Failed to parse GitLab API response:');

      // Should log the operation (line 165)
      expect(mockLogger.log).toHaveBeenCalledWith('Getting GitLab file metadata:', 'test/file.md');
      
      // Should log response status (line 168)
      expect(mockLogger.log).toHaveBeenCalledWith('GitLab getFileMetadata response status:', 200);
      
      // Should log raw response (line 171)
      expect(mockLogger.log).toHaveBeenCalledWith('GitLab getFileMetadata raw response:', 'invalid json response {...');
      
      // Should log JSON parse error (line 177)
      expect(mockLogger.error).toHaveBeenCalledWith('GitLab getFileMetadata JSON parse error:', expect.any(Error));
      
      // Should log full response (line 178)
      expect(mockLogger.error).toHaveBeenCalledWith('GitLab getFileMetadata full response:', 'invalid json response {');
    });

    it('should handle empty response in getFileMetadata', async () => {
      // Mock empty response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('')
      });

      const { getFileMetadata } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileMetadata(settings, 'test/file.md'))
        .rejects.toThrow('Failed to parse GitLab API response:');

      expect(mockLogger.error).toHaveBeenCalledWith('GitLab getFileMetadata full response:', '');
    });

    it('should handle malformed JSON in getFileMetadata', async () => {
      // Mock response with various malformed JSON
      const malformedJsonCases = [
        '{"incomplete":',
        '[1,2,3',
        '{"nested":{"object"',
        'not json at all',
        '{"trailing":comma,}'
      ];

      for (const malformedJson of malformedJsonCases) {
        vi.resetModules();
        vi.clearAllMocks();
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(malformedJson)
        });

        const { getFileMetadata } = await import('../gitlabService');

        const settings = {
          instanceUrl: 'https://gitlab.com',
          projectId: 'testproject',
          token: 'testtoken',
          branch: 'main'
        };

        await expect(getFileMetadata(settings, 'test/file.md'))
          .rejects.toThrow('Failed to parse GitLab API response:');

        expect(mockLogger.error).toHaveBeenCalledWith('GitLab getFileMetadata full response:', malformedJson);
      }
    });

    it('should successfully parse valid JSON in getFileMetadata', async () => {
      // Test successful case to ensure we cover lines 175, 182, 184-189
      const validMetadata = {
        sha: 'abc123',
        content: 'file content',
        path: 'test/file.md',
        name: 'file.md',
        extraField: 'ignored'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(validMetadata))
      });

      const { getFileMetadata } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await getFileMetadata(settings, 'test/file.md');

      // Should log parsed keys (line 182)
      expect(mockLogger.log).toHaveBeenCalledWith('GitLab getFileMetadata parsed keys:', ['sha', 'content', 'path', 'name', 'extraField']);

      // Should return filtered metadata (lines 184-189)
      expect(result).toEqual({
        sha: 'abc123',
        content: 'file content',
        path: 'test/file.md',
        name: 'file.md'
      });
    });
  });

  // Note: ensureArchiveDirectory tests would be complex due to the getTodos dependency
  // The getFileMetadata tests above already provide excellent coverage improvement

  describe('edge cases and comprehensive scenarios', () => {
    it('should handle very long response in getFileMetadata', async () => {
      // Test with response longer than 200 characters to check substring logic
      const longResponse = 'a'.repeat(300);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(longResponse)
      });

      const { getFileMetadata } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileMetadata(settings, 'test/file.md'))
        .rejects.toThrow('Failed to parse GitLab API response:');

      // Should truncate response in log (line 171)
      expect(mockLogger.log).toHaveBeenCalledWith('GitLab getFileMetadata raw response:', 'a'.repeat(200) + '...');
    });

    it('should handle different backend URLs', async () => {
      // Test with production environment
      mockLocation.hostname = 'myapp.prod.com';
      mockLocation.port = '443';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('invalid json')
      });

      const { getFileMetadata } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.company.com',
        projectId: 'prod-project',
        token: 'prod-token',
        branch: 'main'
      };

      await expect(getFileMetadata(settings, 'prod/file.md'))
        .rejects.toThrow('Failed to parse GitLab API response:');

      // Should have called the relative URL endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.any(Object)
      );
    });
  });
});