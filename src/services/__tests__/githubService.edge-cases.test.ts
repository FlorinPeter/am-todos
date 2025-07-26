/**
 * GitHub Service Edge Cases Tests - Error Handling, Validation, and Boundary Conditions  
 * Consolidated from multiple redundant test files focusing on edge cases
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the fetchWithTimeout module entirely
vi.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
  TIMEOUT_VALUES: {
    NORMAL: 10000,
    LONG: 30000
  }
}));

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
const mockFetchWithTimeout = vi.mocked(fetchWithTimeout);

// Shared helper function (consolidated from multiple files)
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
    clone: () => createMockResponse(options)
  };
  return mockResponse;
};

// Mock external dependencies
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../utils/rateLimitHandler', () => ({
  parseRateLimitError: vi.fn(() => ({ isRateLimited: false })),
  showRateLimitNotification: vi.fn()
}));

describe('GitHub Service - Edge Cases and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithTimeout.mockReset();
    
    // Mock window.location for environment detection
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          port: '3000',
          origin: 'http://localhost:3000',
          pathname: '/'
        }
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('listProjectFolders - Folder Filtering Logic', () => {
    it('should include folders matching project patterns', async () => {
      const mockContents = [
        { name: 'project-alpha', type: 'dir' },
        { name: 'work-tasks', type: 'dir' },
        { name: 'personal-notes', type: 'dir' },
        { name: 'todos', type: 'dir' },
        { name: 'random-folder', type: 'dir' },
        { name: 'README.md', type: 'file' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      // Should include project pattern matches
      expect(result).toContain('project-alpha');
      expect(result).toContain('work-tasks'); 
      expect(result).toContain('personal-notes');
      expect(result).toContain('todos');
      expect(result).toContain('random-folder'); // Valid folder name pattern
      
      // Should exclude files
      expect(result).not.toContain('README.md');
    });

    it('should add todos as default when not present in results', async () => {
      const mockContents = [
        { name: 'other-folder', type: 'dir' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toContain('todos'); // Always includes default
      expect(result).toContain('other-folder');
    });

    it('should not duplicate todos when already present', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-todos', type: 'dir' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      // Should only have one 'todos' entry
      const todosCount = result.filter(folder => folder === 'todos').length;
      expect(todosCount).toBe(1);
      expect(result).toContain('work-todos');
    });

    it('should exclude invalid folder names that do not match regex', async () => {
      const mockContents = [
        { name: 'valid-folder', type: 'dir' },
        { name: '123-starts-with-number', type: 'dir' },
        { name: 'invalid!@#$%', type: 'dir' },
        { name: 'spaces in name', type: 'dir' },
        { name: 'valid_folder_2', type: 'dir' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toContain('valid-folder');
      expect(result).toContain('valid_folder_2');
      expect(result).not.toContain('123-starts-with-number');
      expect(result).not.toContain('invalid!@#$%');
      expect(result).not.toContain('spaces in name');
    });
  });

  describe('Error Handling - Network and API Failures', () => {
    it('should handle network errors and return default fallback', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network connection failed'));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toEqual(['todos']); // Default fallback
    });

    it('should handle API errors and return default fallback', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toEqual(['todos']); // Default fallback
    });

    it('should handle malformed JSON response gracefully', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      expect(result).toEqual([]); // Empty array on JSON parse error
    });

    it('should handle network errors with retry mechanism', async () => {
      // First call fails with TypeError (triggers retry), second call succeeds
      mockFetchWithTimeout
        .mockRejectedValueOnce(new TypeError('Network error: fetch failed'))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([])
        }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      expect(result).toEqual([]);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2); // Initial call + retry
    });
  });

  describe('createOrUpdateTodo - Error Scenarios', () => {
    it('should handle API errors gracefully', async () => {
      // First call: getFileMetadata (fails - file doesn't exist)  
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: actual file creation (fails with API error)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('Validation failed')
      }));

      const { createOrUpdateTodo } = await import('../githubService');

      await expect(
        createOrUpdateTodo(
          'fake-token',
          'test-owner',
          'test-repo',
          'todos/test.md',
          '# Test',
          'feat: Test'
        )
      ).rejects.toThrow('GitHub API proxy error');
    });

    it('should handle rate limit errors with proper notification', async () => {
      // First call: getFileMetadata (fails - file doesn't exist)  
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: actual file creation (fails with rate limit)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        statusText: 'Rate limit exceeded',
        text: () => Promise.resolve('API rate limit exceeded')
      }));

      const { createOrUpdateTodo } = await import('../githubService');

      await expect(
        createOrUpdateTodo(
          'fake-token',
          'test-owner',
          'test-repo',
          'todos/test.md',
          '# Test',
          'feat: Test'
        )
      ).rejects.toThrow('GitHub API proxy error');
    });
  });

  describe('Input Validation', () => {
    it('should validate folder name format in createProjectFolder', async () => {
      const { createProjectFolder } = await import('../githubService');

      // Test invalid folder names
      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', 'invalid folder name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', '123-starts-with-number')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', 'special!@#characters')
      ).rejects.toThrow('Invalid folder name');
    });

    it('should accept valid folder name patterns', async () => {
      // Mock 4 calls total: 2 getFileMetadata failures + 2 actual file creations
      mockFetchWithTimeout
        // First file creation sequence (main folder)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ content: { path: 'valid-folder/.gitkeep' } })
        }))
        // Second file creation sequence (archive folder)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ content: { path: 'valid-folder/archive/.gitkeep' } })
        }));

      const { createProjectFolder } = await import('../githubService');

      // Should not throw for valid names
      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', 'valid-folder-name')
      ).resolves.not.toThrow();

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(4); // 2 getFileMetadata calls + 2 file creations
    });
  });

  describe('File Operations - Edge Cases', () => {
    it('should handle file not found errors', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { getFileContent } = await import('../githubService');

      await expect(
        getFileContent('fake-token', 'test-owner', 'test-repo', 'nonexistent/file.md')
      ).rejects.toThrow('GitHub API proxy error');
    });

    it('should handle empty file content', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        text: () => Promise.resolve('')
      }));

      const { getFileContent } = await import('../githubService');
      const result = await getFileContent('fake-token', 'test-owner', 'test-repo', 'empty-file.md');

      expect(result).toBe('');
    });

    it('should handle very large file content', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB of content
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        text: () => Promise.resolve(largeContent)
      }));

      const { getFileContent } = await import('../githubService');
      const result = await getFileContent('fake-token', 'test-owner', 'test-repo', 'large-file.md');

      expect(result).toBe(largeContent);
      expect(result.length).toBe(100000);
    });
  });

  describe('Archive Operations - Edge Cases', () => {
    it('should handle archive directory creation failure', async () => {
      // First call: check if archive directory exists (fails - doesn't exist)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: attempt to create .gitkeep file (fails)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Failed to create archive directory')
      }));

      const { ensureArchiveDirectory } = await import('../githubService');

      await expect(
        ensureArchiveDirectory('fake-token', 'test-owner', 'test-repo', 'todos')
      ).rejects.toThrow('GitHub API proxy error');
    });

    it('should handle missing file during archive operation', async () => {
      // First call: ensureArchiveDirectory check (succeeds - directory exists)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([]) // Directory exists
      }));
      
      // Second call: getFileMetadata for current file (fails - file doesn't exist)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { moveTaskToArchive } = await import('../githubService');

      await expect(
        moveTaskToArchive(
          'fake-token',
          'test-owner', 
          'test-repo',
          'todos/nonexistent.md',
          '# Content',
          'Archive task',
          'todos'
        )
      ).rejects.toThrow('GitHub API proxy error');
    });
  });

  describe('Environment Detection - Edge Cases', () => {
    it('should work with different backend URLs', async () => {
      // Mock different window location
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hostname: 'production.example.com',
            port: '443',
            origin: 'https://production.example.com',
            pathname: '/app'
          }
        },
        writable: true
      });

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { getTodos } = await import('../githubService');
      await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/github', expect.any(Object));
    });

    it('should use relative URLs for all environments', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { getTodos } = await import('../githubService');
      await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      // Should always use relative URL regardless of environment
      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });
});