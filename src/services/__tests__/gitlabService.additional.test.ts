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

// Helper function to create proper Response mock objects
const createMockResponse = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
  headers?: Map<string, string> | Headers;
  url?: string;
}) => {
  const mockResponse = {
    ok: options.ok,
    status: options.status || (options.ok ? 200 : 500),
    statusText: options.statusText || (options.ok ? 'OK' : 'Error'),
    json: options.json || (async () => ({})),
    text: options.text || (async () => ''),
    headers: options.headers || new Headers(),
    url: options.url || 'test-url',
    clone: () => createMockResponse(options) // Add clone method
  };
  return mockResponse;
};

// Mock location for BACKEND_URL (will be set in beforeEach)
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};

describe('gitlabService - Additional Functions Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockLocation.hostname = 'localhost';
    mockLocation.port = '3000';
    
    // Mock window.location for environment detection - PROVEN PATTERN
    Object.defineProperty(global, 'window', {
      value: {
        location: mockLocation
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getFileHistory function', () => {
    it('should successfully get file history', async () => {
      // Mock successful response - covers lines 277-286
      const expectedCommits = [
        { sha: 'abc123', message: 'Initial commit', date: '2023-01-01' },
        { sha: 'def456', message: 'Update file', date: '2023-01-02' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(expectedCommits)
      }));

      const { getFileHistory } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await getFileHistory(settings, 'test/file.md');

      // Should log the operation (line 280)
      expect(mockLogger.log).toHaveBeenCalledWith('Getting GitLab file history:', 'test/file.md');

      // Should make the correct API call (line 282)
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getFileHistory',
            instanceUrl: 'https://gitlab.com',
            projectId: 'testproject',
            token: 'testtoken',
            branch: 'main',
            filePath: 'test/file.md'
          })
        }
      );

      expect(result).toEqual(expectedCommits);
    });

    it('should handle API errors in getFileHistory', async () => {
      // Test error handling
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found')
      }));

      const { getFileHistory } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(getFileHistory(settings, 'test/file.md'))
        .rejects.toThrow('GitLab API proxy error: Not Found - File not found');
    });
  });

  describe('moveTaskFromArchive function', () => {
    it('should successfully move task from archive', async () => {
      // Mock successful responses for createOrUpdateTodo and deleteFile - covers lines 236-257
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File deleted' })
        }));

      const { moveTaskFromArchive } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await moveTaskFromArchive(
        settings,
        'todos/archive/task.md',
        '# Task Content',
        'Unarchive task',
        'todos'
      );

      // Should log the operation (line 242)
      expect(mockLogger.log).toHaveBeenCalledWith('Moving GitLab task from archive:', 'todos/archive/task.md');
      
      // Should log creating unarchived file (line 249)
      expect(mockLogger.log).toHaveBeenCalledWith('Creating unarchived file at:', 'todos/task.md');
      
      // Should log deleting archived file (line 253)
      expect(mockLogger.log).toHaveBeenCalledWith('Deleting archived file at:', 'todos/archive/task.md');

      // Should return the new active path (line 256)
      expect(result).toBe('todos/task.md');

      // Should have made two API calls: create and delete
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // First call: create file in active folder
      expect(mockFetch).toHaveBeenNthCalledWith(1,
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"action":"createOrUpdateFile"')
        })
      );

      // Second call: delete file from archive
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"action":"deleteFile"')
        })
      );
    });

    it('should handle createOrUpdateTodo failure in moveTaskFromArchive', async () => {
      // Mock failure for createOrUpdateTodo
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      }));

      const { moveTaskFromArchive } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(moveTaskFromArchive(
        settings,
        'todos/archive/task.md',
        '# Task Content',
        'Unarchive task',
        'todos'
      )).rejects.toThrow('GitLab API proxy error: Internal Server Error - Server error');
    });

    it('should handle deleteFile failure in moveTaskFromArchive', async () => {
      // Mock success for createOrUpdateTodo but failure for deleteFile
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: () => Promise.resolve('Access denied')
        }));

      const { moveTaskFromArchive } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      await expect(moveTaskFromArchive(
        settings,
        'todos/archive/task.md',
        '# Task Content',
        'Unarchive task',
        'todos'
      )).rejects.toThrow('GitLab API proxy error: Forbidden - Access denied');
    });

    it('should handle different folder names in moveTaskFromArchive', async () => {
      // Test with custom folder name
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File deleted' })
        }));

      const { moveTaskFromArchive } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await moveTaskFromArchive(
        settings,
        'work-tasks/archive/important-task.md',
        '# Important Task',
        'Unarchive important task',
        'work-tasks'
      );

      expect(result).toBe('work-tasks/important-task.md');
      expect(mockLogger.log).toHaveBeenCalledWith('Creating unarchived file at:', 'work-tasks/important-task.md');
    });
  });

  describe('edge cases and path handling', () => {
    it('should handle complex file paths in moveTaskFromArchive', async () => {
      // Test path parsing logic (line 245)
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ message: 'File deleted' })
        }));

      const { moveTaskFromArchive } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      };

      const result = await moveTaskFromArchive(
        settings,
        'deep/nested/archive/complex-file-name.md',
        '# Complex Task',
        'Unarchive complex task',
        'deep/nested'
      );

      // Should extract just the filename and use it in the new path
      expect(result).toBe('deep/nested/complex-file-name.md');
    });

    it('should work with different backend URLs', async () => {
      // Test with external IP
      mockLocation.hostname = '192.168.1.100';
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([])
      }));

      const { getFileHistory } = await import('../gitlabService');

      const settings = {
        instanceUrl: 'https://gitlab.internal.com',
        projectId: 'internal-project',
        token: 'internal-token',
        branch: 'develop'
      };

      await getFileHistory(settings, 'internal/file.md');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.any(Object)
      );
    });
  });
});