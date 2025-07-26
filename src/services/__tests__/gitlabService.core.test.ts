/**
 * GitLab Service Core Tests - Main CRUD Operations and Happy Path Scenarios
 * Consolidated from multiple redundant test files to eliminate duplication
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Shared helper function (previously duplicated across 8+ files)
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

describe('GitLab Service - Core Functionality', () => {
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

  describe('createOrUpdateTodo - Core CRUD Operations', () => {
    it('should create a new todo successfully', async () => {
      const mockResponse = {
        file_path: 'todos/test-todo.md',
        content: 'test content'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');
      const result = await createOrUpdateTodo(
        mockSettings,
        'todos/test-todo.md',
        '# Test Todo\n\n- [ ] Test task',
        'feat: Add test todo'
      );

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'createOrUpdateFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md',
            content: '# Test Todo\n\n- [ ] Test task',
            commitMessage: 'feat: Add test todo'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should update an existing todo successfully', async () => {
      const mockResponse = {
        file_path: 'todos/existing-todo.md',
        content: 'updated content'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');
      const result = await createOrUpdateTodo(
        mockSettings,
        'todos/existing-todo.md',
        '# Updated Todo\n\n- [x] Completed task',
        'feat: Update existing todo'
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getTodos - Fetching Todo Lists', () => {
    it('should fetch todos from active folder', async () => {
      const mockTodos = [
        {
          id: 'P3--2023-10-27--sample-todo',
          name: 'P3--2023-10-27--sample-todo.md',
          path: 'todos/P3--2023-10-27--sample-todo.md',
          type: 'blob',
          sha: 'mock-sha-123'
        }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockTodos)
      }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: 'todos'
          })
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        title: 'sample-todo',
        priority: 3,
        isArchived: false
      });
    });

    it('should fetch todos from archive folder', async () => {
      const mockTodos = [
        {
          id: 'P1--2023-10-26--archived-todo',
          name: 'P1--2023-10-26--archived-todo.md',
          path: 'todos/archive/P1--2023-10-26--archived-todo.md',
          type: 'blob',
          sha: 'mock-archive-sha-456'
        }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockTodos)
      }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', true);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        title: 'archived-todo',
        priority: 1,
        isArchived: true
      });
    });

    it('should return empty array when no todos found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(result).toEqual([]);
    });
  });

  describe('getFileContent - File Reading', () => {
    it('should fetch raw file content successfully', async () => {
      const expectedContent = '# Test Todo\n\n- [ ] Sample task';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ content: expectedContent })
      }));

      const { getFileContent } = await import('../gitlabService');
      const result = await getFileContent(mockSettings, 'todos/test-todo.md');

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getRawFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md'
          })
        })
      );

      expect(result).toBe(expectedContent);
    });
  });

  describe('deleteFile - File Deletion', () => {
    it('should delete a file successfully', async () => {
      const mockResponse = { message: 'File deleted successfully' };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { deleteFile } = await import('../gitlabService');
      const result = await deleteFile(
        mockSettings,
        'todos/test-todo.md',
        'feat: Delete test todo'
      );

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'deleteFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md',
            commitMessage: 'feat: Delete test todo'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('listProjectFolders - Folder Management', () => {
    it('should list available project folders successfully', async () => {
      const mockFolders = [
        { name: 'todos', type: 'tree' },
        { name: 'work-tasks', type: 'tree' },
        { name: 'personal', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFolders)
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos', 'work-tasks', 'personal']);
    });

    it('should return default folder array on API error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });
  });

  describe('createProjectFolder - Folder Creation', () => {
    it('should create a new project folder successfully', async () => {
      const mockResponse = { message: 'Folder created successfully' };

      // Mock both calls - main folder and archive folder creation
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        }));

      const { createProjectFolder } = await import('../gitlabService');
      await createProjectFolder(mockSettings, 'new-project');

      expect(fetch).toHaveBeenCalledTimes(2); // Creates both folder and archive folder
    });

    it('should validate folder name format', async () => {
      const { createProjectFolder } = await import('../gitlabService');

      await expect(
        createProjectFolder(mockSettings, 'invalid folder name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, '123-starts-with-number')
      ).rejects.toThrow('Invalid folder name');
    });
  });
});