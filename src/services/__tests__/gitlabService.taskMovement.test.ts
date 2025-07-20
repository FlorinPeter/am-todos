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

// Mock other gitlabService functions that are called internally
const mockCreateOrUpdateTodo = vi.fn();
const mockDeleteFile = vi.fn();

// We need to mock these before importing the module
vi.mock('../gitlabService', async () => {
  const actual = await vi.importActual('../gitlabService');
  return {
    ...actual,
    createOrUpdateTodo: mockCreateOrUpdateTodo,
    deleteFile: mockDeleteFile,
  };
});

// Mock window.location for BACKEND_URL
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('gitlabService - Focused Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockLocation.hostname = 'localhost';
    mockLocation.port = '3000';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getFileAtCommit function', () => {
    it('should successfully get file at specific commit', async () => {
      // Mock successful response - covers lines 289-299
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

      const { getFileAtCommit } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await getFileAtCommit(settings, 'test/file.md', 'abc123');

      // Should log the operation (line 293)
      expect(mockLogger.log).toHaveBeenCalledWith('Getting GitLab file at commit:', 'test/file.md', 'abc123');

      // Should make the correct API call (line 295)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getFileAtCommit',
            instanceUrl: 'https://gitlab.com',
            projectId: 'testproject',
            token: 'testtoken',
            branch: 'main',
            filePath: 'test/file.md',
            sha: 'abc123'
          })
        }
      );

      expect(result).toEqual(expectedData);
    });

    it('should handle API errors in getFileAtCommit', async () => {
      // Test error handling
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found at commit')
      });

      const { getFileAtCommit } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileAtCommit(settings, 'test/file.md', 'abc123'))
        .rejects.toThrow('GitLab API proxy error: Not Found - File not found at commit');
    });

    it('should handle network errors in getFileAtCommit', async () => {
      // Test network error handling
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const { getFileAtCommit } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileAtCommit(settings, 'test/file.md', 'abc123'))
        .rejects.toThrow('Network failure');
    });
  });

  describe('getProject function', () => {
    it('should successfully get project information', async () => {
      // Mock successful response - covers lines 302-308
      const expectedProject = {
        id: 'testproject',
        name: 'Test Project',
        description: 'A test project',
        web_url: 'https://gitlab.com/testowner/testproject'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedProject)
      });

      const { getProject } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await getProject(settings);

      // Should log the operation (line 302)
      expect(mockLogger.log).toHaveBeenCalledWith('Getting GitLab project info');

      // Should make the correct API call (line 304)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getProject',
            instanceUrl: 'https://gitlab.com',
            projectId: 'testproject',
            token: 'testtoken',
            branch: 'main'
          })
        }
      );

      expect(result).toEqual(expectedProject);
    });

    it('should handle API errors in getProject', async () => {
      // Test error handling
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied')
      });

      const { getProject } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getProject(settings))
        .rejects.toThrow('GitLab API proxy error: Forbidden - Access denied');
    });

    it('should handle network errors in getProject', async () => {
      // Test network error handling
      mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

      const { getProject } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getProject(settings))
        .rejects.toThrow('Connection timeout');
    });
  });

  describe('edge cases and environment variations', () => {
    it('should handle malformed JSON responses', async () => {
      // Test JSON parsing errors
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const { getProject } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getProject(settings))
        .rejects.toThrow('Invalid JSON');
    });

    it('should handle different GitLab instance URLs', async () => {
      // Test with self-hosted GitLab instance
      const expectedData = { content: 'self-hosted content' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedData)
      });

      const { getFileAtCommit } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.mycompany.com',
        projectId: 'internal-project',
        token: 'company-token',
        branch: 'develop'
      };

      const result = await getFileAtCommit(settings, 'internal/file.md', 'commit-sha');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"instanceUrl":"https://gitlab.mycompany.com"')
        })
      );

      expect(result).toEqual(expectedData);
    });
  });
});