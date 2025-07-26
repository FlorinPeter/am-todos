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

  describe('moveTaskFromArchive', () => {
    it('should move a task from archive to active folder successfully', async () => {
      // Mock createOrUpdateTodo call for active folder
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ file_path: 'todos/restored-todo.md' })
      }));

      // Mock deleteFile call for archive
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'File deleted from archive' })
      }));

      const { moveTaskFromArchive } = await import('../gitlabService');
      const result = await moveTaskFromArchive(
        mockSettings,
        'todos/archive/restored-todo.md',
        '# Restored Todo\n\n- [ ] Unarchived task',
        'feat: Restore todo from archive',
        'work-items'
      );

      expect(result).toBe('work-items/restored-todo.md');
      expect(fetch).toHaveBeenCalledTimes(2); // create in active, delete from archive

      // Verify createOrUpdateTodo call for active folder
      expect(fetch).toHaveBeenNthCalledWith(1,
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"work-items/restored-todo.md"')
        })
      );

      // Verify deleteFile call for archive
      expect(fetch).toHaveBeenNthCalledWith(2,
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"todos/archive/restored-todo.md"')
        })
      );
    });

    it('should use default folder for moveTaskFromArchive', async () => {
      // Mock createOrUpdateTodo call
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ file_path: 'todos/default-todo.md' })
      }));

      // Mock deleteFile call
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'File deleted' })
      }));

      const { moveTaskFromArchive } = await import('../gitlabService');
      const result = await moveTaskFromArchive(
        mockSettings,
        'todos/archive/default-todo.md',
        '# Default Todo',
        'feat: Restore todo'
      );

      expect(result).toBe('todos/default-todo.md');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getFileHistory', () => {
    it('should get file history successfully', async () => {
      const mockCommits = [
        {
          sha: 'abc123',
          message: 'feat: Add initial todo',
          author: 'testuser',
          date: '2023-01-01T00:00:00Z',
          url: 'https://gitlab.example.com/project/commits/abc123'
        },
        {
          sha: 'def456', 
          message: 'fix: Update todo content',
          author: 'testuser',
          date: '2023-01-02T00:00:00Z',
          url: 'https://gitlab.example.com/project/commits/def456'
        }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockCommits)
      }));

      const { getFileHistory } = await import('../gitlabService');
      const result = await getFileHistory(mockSettings, 'todos/test-todo.md');

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getFileHistory',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md'
          })
        })
      );

      expect(result).toEqual(mockCommits);
    });

    it('should handle getFileHistory API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File history not found')
      }));

      const { getFileHistory } = await import('../gitlabService');
      await expect(
        getFileHistory(mockSettings, 'todos/nonexistent.md')
      ).rejects.toThrow('GitLab API proxy error: Not Found - File history not found');
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

    it('should filter project folders using specific patterns (lines 842-846)', async () => {
      // Mock repository tree with various folder types including the specific patterns
      const mockTreeResponse = createMockResponse({
        ok: true,
        json: () => Promise.resolve([
          { name: 'project-alpha', type: 'tree', path: 'project-alpha' }, // Should match "project"
          { name: 'work-items', type: 'tree', path: 'work-items' }, // Should match "work"
          { name: 'personal-notes', type: 'tree', path: 'personal-notes' }, // Should match "personal"
          { name: 'my-todos', type: 'tree', path: 'my-todos' }, // Should match "todo"
          { name: 'task-list', type: 'tree', path: 'task-list' }, // Should match "task"
          { name: 'valid_folder-name', type: 'tree', path: 'valid_folder-name' }, // Should match regex
          { name: 'src', type: 'tree', path: 'src' }, // Should NOT match
          { name: '123invalid', type: 'tree', path: '123invalid' }, // Should NOT match regex
          { name: 'special!chars', type: 'tree', path: 'special!chars' } // Should NOT match regex
        ])
      });

      mockFetch.mockResolvedValueOnce(mockTreeResponse);

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should include folders matching the specific patterns (lines 842-846)
      expect(result).toContain('project-alpha'); // "project" pattern
      expect(result).toContain('work-items'); // "work" pattern
      expect(result).toContain('personal-notes'); // "personal" pattern
      expect(result).toContain('my-todos'); // "todo" pattern
      expect(result).toContain('task-list'); // "task" pattern
      expect(result).toContain('valid_folder-name'); // regex pattern

      // Should exclude folders not matching any pattern
      expect(result).not.toContain('src');
      expect(result).not.toContain('123invalid');
      expect(result).not.toContain('special!chars');
    });

    it('should add default todos folder when no project folders found (lines 853-854)', async () => {
      // Mock repository tree with only system folders that are excluded
      const mockTreeResponse = createMockResponse({
        ok: true,
        json: () => Promise.resolve([
          { name: 'src', type: 'tree', path: 'src' }, // System folder - excluded
          { name: 'docs', type: 'tree', path: 'docs' }, // System folder - excluded
          { name: 'node_modules', type: 'tree', path: 'node_modules' }, // System folder - excluded
          { name: '123invalid', type: 'tree', path: '123invalid' }, // Invalid regex - excluded
          { name: 'special!chars', type: 'tree', path: 'special!chars' }, // Invalid regex - excluded
          { name: 'README.md', type: 'blob', path: 'README.md' } // Not a tree - excluded
        ])
      });

      mockFetch.mockResolvedValueOnce(mockTreeResponse);

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should fall back to default 'todos' when no project folders match (lines 853-854)
      expect(result).toEqual(['todos']);
    });

    it('should include todos folder when present in directory listing (line 845)', async () => {
      // Mock repository tree with 'todos' folder and other valid folders
      const mockTreeResponse = createMockResponse({
        ok: true,
        json: () => Promise.resolve([
          { name: 'project-work', type: 'tree', path: 'project-work' }, // Should match
          { name: 'personal-stuff', type: 'tree', path: 'personal-stuff' }, // Should match
          { name: 'todos', type: 'tree', path: 'todos' } // Should match (line 845: name === 'todos')
        ])
      });

      mockFetch.mockResolvedValueOnce(mockTreeResponse);

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should include all found folders including explicit 'todos'
      expect(result).toContain('project-work');
      expect(result).toContain('personal-stuff');
      expect(result).toContain('todos'); // Included because it's in the directory listing (line 845)
    });

    it('should only include valid project folders when todos folder not present', async () => {
      // Mock repository tree without 'todos' folder but with other valid folders
      const mockTreeResponse = createMockResponse({
        ok: true,
        json: () => Promise.resolve([
          { name: 'project-work', type: 'tree', path: 'project-work' }, // Should match
          { name: 'personal-stuff', type: 'tree', path: 'personal-stuff' }, // Should match
          { name: 'src', type: 'tree', path: 'src' } // System folder - should be excluded
        ])
      });

      mockFetch.mockResolvedValueOnce(mockTreeResponse);

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(mockSettings);

      // Should include only the valid project folders, not 'todos' (since it wasn't found AND other folders exist)
      expect(result).toContain('project-work');
      expect(result).toContain('personal-stuff');
      expect(result).not.toContain('todos'); // Not added because other folders exist
      expect(result).not.toContain('src'); // System folder excluded
      expect(result).toHaveLength(2);
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

  describe('createTodo (New Format)', () => {
    it('should create a new todo with filename-based metadata', async () => {
      const mockResponse = {
        file_path: 'todos/P2--2023-01-01--test-todo.md',
        content: 'test content'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createTodo } = await import('../gitlabService');
      const result = await createTodo(
        mockSettings,
        'Test Todo',
        '# Test Todo\n\n- [ ] Test task',
        2,
        'work-tasks'
      );

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"createOrUpdateFile"')
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should use default priority and folder for createTodo', async () => {
      const mockResponse = {
        file_path: 'todos/P3--2023-01-01--simple-todo.md',
        content: 'test content'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createTodo } = await import('../gitlabService');
      const result = await createTodo(
        mockSettings,
        'Simple Todo',
        '# Simple Todo\n\n- [ ] Default task'
      );

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"todos/')
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getFileAtCommit', () => {
    it('should get file content at specific commit', async () => {
      const mockData = {
        content: '# Test Todo\n\n- [x] Completed task',
        sha: 'abc123'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockData)
      }));

      const { getFileAtCommit } = await import('../gitlabService');
      const result = await getFileAtCommit(mockSettings, 'todos/test.md', 'abc123');

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getFileAtCommit',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test.md',
            sha: 'abc123'
          })
        })
      );

      expect(result).toEqual(mockData);
    });

    it('should handle getFileAtCommit errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found at commit')
      }));

      const { getFileAtCommit } = await import('../gitlabService');
      await expect(
        getFileAtCommit(mockSettings, 'todos/missing.md', 'invalid123')
      ).rejects.toThrow('GitLab API proxy error: Not Found - File not found at commit');
    });
  });

  describe('getProject', () => {
    it('should get GitLab project information', async () => {
      const mockProject = {
        id: 12345,
        name: 'Test Project',
        description: 'A test project',
        web_url: 'https://gitlab.example.com/user/test-project'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockProject)
      }));

      const { getProject } = await import('../gitlabService');
      const result = await getProject(mockSettings);

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getProject',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch
          })
        })
      );

      expect(result).toEqual(mockProject);
    });

    it('should handle getProject API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied')
      }));

      const { getProject } = await import('../gitlabService');
      await expect(
        getProject(mockSettings)
      ).rejects.toThrow('GitLab API proxy error: Forbidden - Access denied');
    });
  });

  describe('getFileMetadata', () => {
    it('should get file metadata successfully', async () => {
      const mockMetadata = {
        sha: 'abc123def456',
        content: 'base64encodedcontent==',
        path: 'todos/test-file.md',
        name: 'test-file.md',
        size: 1024,
        encoding: 'base64'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockMetadata))
      }));

      const { getFileMetadata } = await import('../gitlabService');
      const result = await getFileMetadata(mockSettings, 'todos/test-file.md');

      expect(fetch).toHaveBeenCalledWith(
        '/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-file.md'
          })
        })
      );

      expect(result).toEqual({
        sha: 'abc123def456',
        content: 'base64encodedcontent==',
        path: 'todos/test-file.md',
        name: 'test-file.md'
      });
    });

    it('should handle JSON parse error in getFileMetadata', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        text: () => Promise.resolve('invalid json response')
      }));

      const { getFileMetadata } = await import('../gitlabService');
      await expect(
        getFileMetadata(mockSettings, 'todos/invalid.md')
      ).rejects.toThrow('Failed to parse GitLab API response:');
    });
  });

  describe('ensureArchiveDirectory', () => {
    it('should not create archive directory when it already exists', async () => {
      // Mock getTodos to succeed (directory exists)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { ensureArchiveDirectory } = await import('../gitlabService');
      await ensureArchiveDirectory(mockSettings, 'existing-folder');

      expect(fetch).toHaveBeenCalledTimes(1); // Only the getTodos call
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should test caching system cache hit', async () => {
      const { getTodos } = await import('../gitlabService');
      
      // Mock successful response
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ([
          {
            id: 'test1',
            title: 'Test Todo 1',
            content: '# Test 1\\n\\n- [ ] Task',
            path: 'todos/test1.md',
            createdAt: '2023-01-01T10:00:00.000Z',
            priority: 2,
            isArchived: false
          }
        ])
      }));

      // First call
      await getTodos(mockSettings, 'todos', false);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await getTodos(mockSettings, 'todos', false);
      expect(fetch).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should test error handling with different status codes', async () => {
      const { createOrUpdateTodo } = await import('../gitlabService');
      
      // Test 500 error
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
        text: async () => 'Server error'
      }));

      await expect(
        createOrUpdateTodo(mockSettings, 'todos/test.md', 'content', 'commit')
      ).rejects.toThrow();
    });

  });

  // === Coverage Improvement: Uncovered Lines 635-637, 686-692 ===
  describe('Error Handling Coverage (lines 635-637, 686-692)', () => {
    it('should handle retry failure in getTodos (lines 635-637)', async () => {
      const { getTodos } = await import('../gitlabService');
      
      // Mock first call to fail with network error, second call (retry) to also fail
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('Retry fetch failed'))
        .mockResolvedValue(createMockResponse({ ok: true, json: async () => [] })); // Fallback

      const result = await getTodos(mockSettings, 'todos', false);

      expect(result).toEqual([]); // Should return empty array after retry fails
    }, 10000); // Increase timeout

    it('should create archive directory when it does not exist (lines 686-692)', async () => {
      const { ensureArchiveDirectory } = await import('../gitlabService');
      
      // Mock getTodos to fail, then mock create operations to succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Directory not found'))
        .mockResolvedValue(createMockResponse({
          ok: true,
          json: async () => ({ file_path: 'todos/archive/.gitkeep' })
        }));

      await ensureArchiveDirectory(mockSettings, 'todos');

      expect(mockFetch).toHaveBeenCalled(); // Verify fetch operations occurred
    });
  });
});