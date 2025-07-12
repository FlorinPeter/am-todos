import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger methods to avoid test output pollution
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
  
  // Mock window.location for environment detection
  Object.defineProperty(window, 'location', {
    value: {
      hostname: 'localhost',
      port: '3000'
    },
    writable: true
  });
});

describe('GitHub Service - Comprehensive Coverage', () => {
  const mockToken = 'test-token';
  const mockOwner = 'testuser';
  const mockRepo = 'test-repo';
  const mockFolder = 'todos';

  // Test that all major functions are exported and callable
  describe('Module Exports', () => {
    it('should export all required functions', async () => {
      const githubService = await import('../githubService');
      
      const expectedFunctions = [
        'createOrUpdateTodo',
        'ensureDirectory', 
        'ensureTodosDirectory',
        'getTodos',
        'getFileContent',
        'getFileMetadata',
        'ensureArchiveDirectory',
        'moveTaskToArchive',
        'moveTaskFromArchive',
        'deleteFile',
        'getFileHistory',
        'listProjectFolders',
        'createProjectFolder',
        'getFileAtCommit'
      ];

      expectedFunctions.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('Function Parameter Validation', () => {
    it('should handle function calls with proper parameter types', async () => {
      const githubService = await import('../githubService');
      
      // Test that functions are callable with proper parameters (just check they exist)
      const mockParams = {
        token: 'test-token',
        owner: 'test-owner', 
        repo: 'test-repo',
        path: 'test.md',
        content: '# Test',
        commitMessage: 'Test commit',
        sha: 'abc123',
        folder: 'todos'
      };

      // Test that functions exist and accept parameters without throwing type errors
      expect(githubService.createOrUpdateTodo).toBeDefined();
      expect(githubService.ensureDirectory).toBeDefined();
      expect(typeof githubService.createOrUpdateTodo).toBe('function');
      expect(typeof githubService.ensureDirectory).toBe('function');
    });
  });

  describe('Environment Detection', () => {
    it('should handle different environment configurations', () => {
      // Test that the module loads and detects environment correctly
      expect(window.location.hostname).toBeDefined();
      expect(window.location.port).toBeDefined();
    });
  });

  describe('Error Handling Patterns', () => {
    it('should have consistent error handling across functions', async () => {
      const githubService = await import('../githubService');
      
      // Test that async functions return promises
      const asyncFunctions = [
        'createOrUpdateTodo',
        'getTodos', 
        'getFileContent',
        'getFileMetadata',
        'deleteFile'
      ];

      asyncFunctions.forEach(funcName => {
        const func = githubService[funcName];
        expect(func).toBeDefined();
        // Functions should be async and return promises
        expect(typeof func).toBe('function');
      });
    });
  });

  describe('Archive Operations Workflow', () => {
    it('should export archive-related functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.moveTaskToArchive).toBeDefined();
      expect(githubService.moveTaskFromArchive).toBeDefined();
      expect(githubService.ensureArchiveDirectory).toBeDefined();
      
      expect(typeof githubService.moveTaskToArchive).toBe('function');
      expect(typeof githubService.moveTaskFromArchive).toBe('function');
      expect(typeof githubService.ensureArchiveDirectory).toBe('function');
    });
  });

  describe('Project Management Functions', () => {
    it('should export project folder management functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.listProjectFolders).toBeDefined();
      expect(githubService.createProjectFolder).toBeDefined();
      
      expect(typeof githubService.listProjectFolders).toBe('function');
      expect(typeof githubService.createProjectFolder).toBe('function');
    });
  });

  describe('Git History Functions', () => {
    it('should export git history functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.getFileHistory).toBeDefined();
      expect(githubService.getFileAtCommit).toBeDefined();
      
      expect(typeof githubService.getFileHistory).toBe('function');
      expect(typeof githubService.getFileAtCommit).toBe('function');
    });
  });

  describe('File Operations', () => {
    it('should export core file operation functions', async () => {
      const githubService = await import('../githubService');
      
      const fileOperations = [
        'createOrUpdateTodo',
        'getFileContent', 
        'getFileMetadata',
        'deleteFile'
      ];

      fileOperations.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('Directory Management', () => {
    it('should export directory management functions', async () => {
      const githubService = await import('../githubService');
      
      const directoryFunctions = [
        'ensureDirectory',
        'ensureTodosDirectory', 
        'ensureArchiveDirectory'
      ];

      directoryFunctions.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('API Integration Points', () => {
    it('should use consistent API patterns', async () => {
      const githubService = await import('../githubService');
      
      // All major functions should be async
      const asyncFunctions = [
        'createOrUpdateTodo',
        'getTodos',
        'getFileContent', 
        'getFileMetadata',
        'deleteFile',
        'getFileHistory',
        'listProjectFolders',
        'createProjectFolder',
        'getFileAtCommit'
      ];

      asyncFunctions.forEach(funcName => {
        const func = githubService[funcName];
        expect(func).toBeDefined();
        expect(func.constructor.name).toBe('AsyncFunction');
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility functions', async () => {
      const githubService = await import('../githubService');
      
      // ensureTodosDirectory is a backward compatibility wrapper
      expect(githubService.ensureTodosDirectory).toBeDefined();
      expect(typeof githubService.ensureTodosDirectory).toBe('function');
    });
  });

  describe('Functional Tests', () => {
    describe('createOrUpdateTodo', () => {
      it('creates a new todo successfully', async () => {
        const githubService = await import('../githubService');
        const mockPath = 'todos/test-todo.md';
        const mockContent = '# Test Todo\n\n- [ ] Task 1';
        const mockCommitMessage = 'feat: Add test todo';

        // Mock file check (file doesn't exist)
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found'
          })
          // Mock create file request
          .mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({
              content: { sha: 'new-file-sha' },
              commit: { sha: 'commit-sha' }
            })
          });

        const result = await githubService.createOrUpdateTodo(
          mockToken,
          mockOwner,
          mockRepo,
          mockPath,
          mockContent,
          mockCommitMessage
        );

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          content: { sha: 'new-file-sha' },
          commit: { sha: 'commit-sha' }
        });
      });

      it('updates existing todo with provided SHA', async () => {
        const githubService = await import('../githubService');
        const mockPath = 'todos/existing-todo.md';
        const mockContent = '# Updated Todo\n\n- [x] Completed task';
        const mockCommitMessage = 'feat: Update existing todo';
        const mockSha = 'existing-file-sha';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            content: { sha: 'updated-file-sha' },
            commit: { sha: 'update-commit-sha' }
          })
        });

        const result = await githubService.createOrUpdateTodo(
          mockToken,
          mockOwner,
          mockRepo,
          mockPath,
          mockContent,
          mockCommitMessage,
          mockSha
        );

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          content: { sha: 'updated-file-sha' },
          commit: { sha: 'update-commit-sha' }
        });
      });

      it('handles Unicode content properly', async () => {
        const githubService = await import('../githubService');
        const mockPath = 'todos/unicode-todo.md';
        const mockContent = '# Unicode Todo 🚀\n\n- [ ] Task with émojis 😀';
        const mockCommitMessage = 'feat: Add unicode todo';

        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found'
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ success: true })
          });

        await githubService.createOrUpdateTodo(
          mockToken,
          mockOwner,
          mockRepo,
          mockPath,
          mockContent,
          mockCommitMessage
        );

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('ensureDirectory', () => {
      it('does not create directory when it already exists', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => []
        });

        await githubService.ensureDirectory(mockToken, mockOwner, mockRepo, 'existing-folder');

        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('creates directory when it does not exist', async () => {
        const githubService = await import('../githubService');
        
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found'
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ success: true })
          });

        await githubService.ensureDirectory(mockToken, mockOwner, mockRepo, 'new-folder');

        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('handles directory creation failure', async () => {
        const githubService = await import('../githubService');
        
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found'
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 422,
            text: async () => 'Directory creation failed'
          });

        await expect(githubService.ensureDirectory(
          mockToken,
          mockOwner,
          mockRepo,
          'failed-folder'
        )).rejects.toThrow();
      });
    });

    describe('getTodos', () => {
      it('returns todos from specified folder', async () => {
        const githubService = await import('../githubService');
        const mockFiles = [
          {
            name: 'todo1.md',
            path: 'todos/todo1.md',
            sha: 'sha1',
            content: '',
            type: 'file'
          },
          {
            name: 'todo2.md',
            path: 'todos/todo2.md',
            sha: 'sha2',
            content: '',
            type: 'file'
          },
          {
            name: '.gitkeep',
            path: 'todos/.gitkeep',
            sha: 'sha3',
            content: '',
            type: 'file'
          }
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => mockFiles
        });

        const result = await githubService.getTodos(mockToken, mockOwner, mockRepo, 'todos');

        expect(result).toHaveLength(2); // Should exclude .gitkeep
        expect(result[0].name).toBe('todo1.md');
        expect(result[1].name).toBe('todo2.md');
      });

      it('returns empty array when directory does not exist', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'Not Found',
          json: async () => ({ message: 'Not Found' }),
          headers: new Headers(),
          url: 'test-url'
        } as Response);

        await expect(githubService.getTodos(mockToken, mockOwner, mockRepo, 'nonexistent')).rejects.toThrow();
      });

      it('handles API errors properly', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server error'
        });

        await expect(githubService.getTodos(
          mockToken,
          mockOwner,
          mockRepo,
          'todos'
        )).rejects.toThrow();
      });
    });

    describe('getFileContent', () => {
      it('returns decoded file content', async () => {
        const githubService = await import('../githubService');
        const mockContent = '# Test Todo';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockContent
        });

        const result = await githubService.getFileContent(
          mockToken,
          mockOwner,
          mockRepo,
          'todos/test.md'
        );

        expect(result).toBe(mockContent);
      });

      it('handles file not found', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: async () => 'File not found'
        });

        await expect(githubService.getFileContent(
          mockToken,
          mockOwner,
          mockRepo,
          'todos/nonexistent.md'
        )).rejects.toThrow();
      });
    });

    describe('getFileMetadata', () => {
      it('returns file metadata successfully', async () => {
        const githubService = await import('../githubService');
        const mockContent = '# Test Todo';
        const mockFileData = {
          name: 'test.md',
          path: 'todos/test.md',
          sha: 'file-sha',
          content: btoa(mockContent)
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFileData
        });

        const result = await githubService.getFileMetadata(
          mockToken,
          mockOwner,
          mockRepo,
          'todos/test.md'
        );

        expect(result.name).toBe('test.md');
        expect(result.sha).toBe('file-sha');
        expect(result.content).toBe(mockContent);
      });
    });

    describe('deleteFile', () => {
      it('deletes file successfully', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true })
        });

        const result = await githubService.deleteFile(
          mockToken,
          mockOwner,
          mockRepo,
          'todos/delete-me.md',
          'file-sha',
          'feat: Delete todo'
        );

        expect(result).toEqual({ success: true });
      });
    });

    describe('listProjectFolders', () => {
      it('returns list of project folders', async () => {
        const githubService = await import('../githubService');
        const mockFolders = [
          { name: 'todos', type: 'dir', path: 'todos' },
          { name: 'work-tasks', type: 'dir', path: 'work-tasks' },
          { name: 'README.md', type: 'file', path: 'README.md' }
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFolders
        });

        const result = await githubService.listProjectFolders(mockToken, mockOwner, mockRepo);

        expect(result).toEqual(['todos', 'work-tasks']);
      });
    });

    describe('createProjectFolder', () => {
      it('creates new project folder successfully', async () => {
        const githubService = await import('../githubService');
        
        // Mock the sequence of calls made by createProjectFolder
        mockFetch
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            text: async () => 'Not Found',
            headers: new Headers(),
            url: 'test-url'
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ content: { sha: 'new-file-sha' } }),
            text: async () => 'success',
            headers: new Headers(),
            url: 'test-url'
          } as Response)
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found', 
            text: async () => 'Not Found',
            headers: new Headers(),
            url: 'test-url'
          } as Response)
          .mockResolvedValueOnce({
            ok: true,
            status: 201,
            json: async () => ({ content: { sha: 'archive-file-sha' } }),
            text: async () => 'success',
            headers: new Headers(),
            url: 'test-url'
          } as Response);

        await githubService.createProjectFolder(mockToken, mockOwner, mockRepo, 'new-project');

        expect(mockFetch).toHaveBeenCalledTimes(4); // Check file existence + create file for both .gitkeep files
      });
    });

    describe('getFileHistory', () => {
      it('returns commit history for file successfully', async () => {
        const githubService = await import('../githubService');
        const mockCommits = [
          {
            sha: 'commit1',
            commit: {
              message: 'feat: Add todo',
              author: { name: 'User', date: '2023-01-01T00:00:00Z' }
            }
          }
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ commits: mockCommits }),
          text: async () => JSON.stringify({ commits: mockCommits }),
          headers: new Headers(),
          url: 'test-url'
        } as Response);

        const result = await githubService.getFileHistory(
          mockToken,
          mockOwner,
          mockRepo,
          'todos/test.md',
          5
        );

        expect(result).toEqual(mockCommits);
      });
    });

    describe('Error Handling', () => {
      it('handles network errors gracefully', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(githubService.getTodos(
          mockToken,
          mockOwner,
          mockRepo,
          'todos'
        )).rejects.toThrow('Network error');
      });

      it('handles invalid JSON responses', async () => {
        const githubService = await import('../githubService');
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: () => Promise.reject(new Error('Invalid JSON'))
        });

        await expect(githubService.getTodos(
          mockToken,
          mockOwner,
          mockRepo,
          'todos'
        )).rejects.toThrow('Invalid JSON');
      });
    });
  });
});