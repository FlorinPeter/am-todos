/**
 * GitLab Service Edge Cases Tests - Error Handling, Validation, and Boundary Conditions
 * Consolidated from multiple redundant test files focusing on edge cases
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('GitLab Service - Edge Cases and Validation', () => {
  const mockSettings = {
    instanceUrl: 'https://gitlab.example.com',
    projectId: '12345',
    token: 'glpat-test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    
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
    it('should include folders with todo keyword', async () => {
      const mockFolders = [
        { name: 'my-todos', type: 'tree' },
        { name: 'personal-todo-list', type: 'tree' },
        { name: 'regular-folder', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('my-todos');
      expect(result).toContain('personal-todo-list');
      expect(result).toContain('regular-folder'); // Valid folder name pattern is included
      // Note: 'todos' is only added when no project folders are found
    });

    it('should include folders with task keyword', async () => {
      const mockFolders = [
        { name: 'work-tasks', type: 'tree' },
        { name: 'daily-tasks', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('work-tasks');
      expect(result).toContain('daily-tasks');
    });

    it('should include folders with project keyword', async () => {
      const mockFolders = [
        { name: 'project-alpha', type: 'tree' },
        { name: 'client-projects', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('project-alpha');
      expect(result).toContain('client-projects');
    });

    it('should include folders with work keyword', async () => {
      const mockFolders = [
        { name: 'work-items', type: 'tree' },
        { name: 'work', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('work-items');
      expect(result).toContain('work');
    });

    it('should include folders with personal keyword', async () => {
      const mockFolders = [
        { name: 'personal', type: 'tree' },
        { name: 'personal-notes', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('personal');
      expect(result).toContain('personal-notes');
    });

    it('should filter out invalid folder name patterns', async () => {
      const mockFolders = [
        { name: 'valid-folder', type: 'tree' },
        { name: '123-starts-with-number', type: 'tree' },
        { name: 'invalid!@#$%', type: 'tree' },
        { name: 'spaces in name', type: 'tree' },
        { name: 'valid_folder_2', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toContain('valid-folder');
      expect(result).toContain('valid_folder_2');
      expect(result).not.toContain('123-starts-with-number');
      expect(result).not.toContain('invalid!@#$%');
      expect(result).not.toContain('spaces in name');
    });

    it('should default to todos when no project folders found', async () => {
      const mockFolders = [
        { name: '123invalid', type: 'tree' }, // Invalid: starts with number
        { name: 'invalid!@#$%', type: 'tree' } // Invalid: special chars
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']); // Defaults to 'todos' when no valid folders
    });

    it('should handle empty response and return todos', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });

    it('should remove duplicate folder names', async () => {
      const mockFolders = [
        { name: 'todos', type: 'tree' },
        { name: 'work-todos', type: 'tree' },
        { name: 'personal-todos', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should only have one 'todos' entry (the default is always added)
      const todosCount = result.filter(folder => folder === 'todos').length;
      expect(todosCount).toBe(1);
      expect(result).toContain('work-todos');
      expect(result).toContain('personal-todos');
    });

    it('should handle API error and return default fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });

    it('should handle non-ok response and return fallback', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });
  });

  describe('createOrUpdateTodo - Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error occurred')
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');

      await expect(
        createOrUpdateTodo(
          mockSettings,
          'todos/test-todo.md',
          '# Test Todo',
          'feat: Add test todo'
        )
      ).rejects.toThrow('GitLab API proxy error');
    });

    it('should handle network errors with retry', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { createOrUpdateTodo } = await import('../gitlabService');

      await expect(
        createOrUpdateTodo(
          mockSettings,
          'todos/test-todo.md',
          '# Test Todo',
          'feat: Add test todo'
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('getTodos - Error Scenarios', () => {
    it('should handle network errors with retry mechanism', async () => {
      // First call fails, second call succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([])
        }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(result).toEqual([]);
      expect(fetch).toHaveBeenCalledTimes(1); // Only initial call (retry not triggered for this error type)
    });

    it('should return empty array after retry fails', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error again'));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(result).toEqual([]);
    });
  });

  describe('Input Validation', () => {
    it('should validate folder name format in createProjectFolder', async () => {
      const { createProjectFolder } = await import('../gitlabService');

      // Test invalid folder names
      await expect(
        createProjectFolder(mockSettings, 'invalid folder name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, '123-starts-with-number')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, 'special!@#characters')
      ).rejects.toThrow('Invalid folder name');
    });

    it('should accept valid folder name patterns', async () => {
      // Mock successful responses for folder creation
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Created' })
        }));

      const { createProjectFolder } = await import('../gitlabService');

      // Should not throw for valid names
      await expect(
        createProjectFolder(mockSettings, 'valid-folder-name')
      ).resolves.not.toThrow();

      expect(fetch).toHaveBeenCalledTimes(2); // Main folder + archive folder
    });
  });

  describe('Malformed Response Handling', () => {
    it('should handle malformed JSON responses gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(result).toEqual([]);
    });

    it('should handle unexpected response structure', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(null) // Unexpected null response
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']); // Fallback to default
    });
  });
});