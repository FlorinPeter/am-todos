import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the global fetch function
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

describe('GitLab Service', () => {
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

  describe('createOrUpdateTodo', () => {
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

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Project not found')
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');
      await expect(
        createOrUpdateTodo(
          mockSettings,
          'todos/test-todo.md',
          '# Test Todo',
          'feat: Add test todo'
        )
      ).rejects.toThrow('GitLab API proxy error: Not Found - Project not found');
    });
  });

  describe('getTodos', () => {
    it('should fetch todos from active folder', async () => {
      const mockFiles = [
        { name: '2023-01-01-todo1.md', path: 'todos/2023-01-01-todo1.md', sha: 'abc123', type: 'file' },
        { name: '2023-01-02-todo2.md', path: 'todos/2023-01-02-todo2.md', sha: 'def456', type: 'file' },
        { name: '.gitkeep', path: 'todos/.gitkeep', sha: 'ghi789', type: 'file' }
      ];

      // Mock all 3 fetch calls that the service makes due to caching system
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
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

      // Should filter out .gitkeep and return only .md files
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('todo1');
      expect(result[1].title).toBe('todo2');
    });

    it('should fetch todos from archive folder', async () => {
      const mockFiles = [
        { name: '2023-01-03-archived-todo.md', path: 'todos/archive/2023-01-03-archived-todo.md', sha: 'xyz789', type: 'file' }
      ];

      // Mock all potential fetch calls that the service makes
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockFiles)
        }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', true);

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: 'todos/archive'
          })
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('archived todo');
    });

    it('should handle network errors with retry', async () => {
      // First call fails with network error
      (fetch as any).mockRejectedValueOnce(new TypeError('fetch error'));
      
      // Retry call succeeds
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { getTodos } = await import('../gitlabService');
      const result = await getTodos(mockSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });

  describe('getFileContent', () => {
    it('should fetch raw file content', async () => {
      const mockContent = '# Test Todo\n\n- [ ] Test task';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ content: mockContent })
      }));

      const { getFileContent } = await import('../gitlabService');
      const result = await getFileContent(mockSettings, 'todos/test-todo.md');

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
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

      expect(result).toBe(mockContent);
    });
  });

  describe('deleteFile', () => {
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

  describe('moveTaskToArchive', () => {
    it('should move a task to archive successfully', async () => {
      // Mock ensureArchiveDirectory (getTodos call)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      // Mock createOrUpdateTodo call
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ file_path: 'todos/archive/test-todo.md' })
      }));

      // Mock deleteFile call
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'File deleted' })
      }));

      const { moveTaskToArchive } = await import('../gitlabService');
      const result = await moveTaskToArchive(
        mockSettings,
        'todos/test-todo.md',
        '# Test Todo\n\n- [x] Completed task',
        'feat: Archive completed todo'
      );

      expect(result).toBe('todos/archive/test-todo.md');
      expect(fetch).toHaveBeenCalledTimes(3); // ensureArchive, create, delete
    });
  });

  describe('listProjectFolders', () => {
    it('should list available project folders', async () => {
      // Mock repository tree response
      const mockTreeResponse = createMockResponse({
        ok: true,
        json: () => Promise.resolve([
          { name: 'todos', type: 'tree', path: 'todos' },
          { name: 'work-tasks', type: 'tree', path: 'work-tasks' },
          { name: 'src', type: 'tree', path: 'src' },
          { name: 'README.md', type: 'blob', path: 'README.md' },
          { name: '.git', type: 'tree', path: '.git' }
        ]),
        text: () => Promise.resolve('[]')
      });

      // Mock fetch to return the repository tree
      mockFetch.mockResolvedValueOnce(mockTreeResponse);

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should call getRepositoryTree action
      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getRepositoryTree',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: '',
            recursive: false
          })
        })
      );

      // Should return filtered project folders (todos, work-tasks) but exclude system folders
      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).not.toContain('src'); // Should be filtered out
      expect(result).not.toContain('.git'); // Should be filtered out
      expect(result).toHaveLength(2);
    });

    it('should return default folder on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });
  });

  describe('createProjectFolder', () => {
    it('should create a new project folder', async () => {
      // Mock createOrUpdateTodo calls for .gitkeep files
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ file_path: 'work-tasks/.gitkeep' }),
          text: () => Promise.resolve('{"file_path":"work-tasks/.gitkeep"}')
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ file_path: 'work-tasks/archive/.gitkeep' }),
          text: () => Promise.resolve('{"file_path":"work-tasks/archive/.gitkeep"}')
        });

      const { createProjectFolder } = await import('../gitlabService');
      await createProjectFolder(mockSettings, 'work-tasks');

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Should create main folder .gitkeep
      expect(fetch).toHaveBeenNthCalledWith(1, 
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"work-tasks/.gitkeep"')
        })
      );

      // Should create archive folder .gitkeep
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/api/gitlab', 
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"work-tasks/archive/.gitkeep"')
        })
      );
    });

    it('should validate folder name', async () => {
      const { createProjectFolder } = await import('../gitlabService');
      
      await expect(
        createProjectFolder(mockSettings, '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, '123invalid')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder(mockSettings, 'spaces not allowed')
      ).rejects.toThrow('Invalid folder name');
    });
  });
});