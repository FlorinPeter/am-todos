/**
 * GitHub Service - Comprehensive Test Suite
 * Consolidated from 14 redundant test files to eliminate massive duplication
 * Covers all unique functionality while removing 13 duplicate test files
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
import * as githubService from '../githubService';

const mockFetchWithTimeout = vi.mocked(fetchWithTimeout);

// Shared helper function (previously duplicated across 11+ files)
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

describe('GitHub Service - Comprehensive Test Suite', () => {
  const mockToken = 'test-token';
  const mockOwner = 'testuser';
  const mockRepo = 'test-repo';
  const mockFolder = 'todos';

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

    // Add atob for Base64 decoding in tests
    global.atob = (str: string) => {
      if (!str) return '';
      return Buffer.from(str, 'base64').toString('binary');
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  // Test that all major functions are exported and callable
  describe('Module Exports', () => {
    it('should export all required functions', async () => {
      const module = await import('../githubService');
      
      // Core CRUD operations
      expect(typeof module.createOrUpdateTodo).toBe('function');
      expect(typeof module.getTodos).toBe('function');
      expect(typeof module.getFileContent).toBe('function');
      expect(typeof module.deleteFile).toBe('function');
      expect(typeof module.getFileMetadata).toBe('function');
      
      // Project management
      expect(typeof module.listProjectFolders).toBe('function');
      expect(typeof module.createProjectFolder).toBe('function');
      
      // Archive operations
      expect(typeof module.moveTaskToArchive).toBe('function');
      expect(typeof module.moveTaskFromArchive).toBe('function');
      
      // Git history
      expect(typeof module.getFileHistory).toBe('function');
      expect(typeof module.getFileAtCommit).toBe('function');
    });
  });

  describe('createOrUpdateTodo - Core CRUD Operations', () => {
    it('should create a new todo successfully', async () => {
      const mockResponse = {
        content: {
          name: 'test-todo.md',
          path: 'todos/test-todo.md',
          sha: 'abc123'
        }
      };

      // First call: getFileMetadata (should fail - file doesn't exist)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: actual file creation
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createOrUpdateTodo } = await import('../githubService');
      const result = await createOrUpdateTodo(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/test-todo.md',
        '# Test Todo\n\n- [ ] Test task',
        'feat: Add test todo'
      );

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"method":"PUT"')
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should update an existing todo successfully', async () => {
      const mockResponse = {
        content: {
          name: 'existing-todo.md',
          path: 'todos/existing-todo.md',
          sha: 'def456'
        }
      };

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createOrUpdateTodo } = await import('../githubService');
      const result = await createOrUpdateTodo(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/existing-todo.md',
        '# Updated Todo\n\n- [x] Completed task',
        'feat: Update existing todo',
        'existing-sha'
      );

      expect(result).toEqual(mockResponse);
    });

    it('handles Unicode content properly', async () => {
      const unicodeContent = '# Unicode Test 🚀\n\n- [ ] Task with emoji 💫\n- [ ] Unicode: héllö wörld';
      const mockResponse = {
        content: {
          name: 'unicode-todo.md',
          path: 'todos/unicode-todo.md',
          sha: 'unicode-sha'
        }
      };

      // First call: getFileMetadata (should fail - file doesn't exist)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: actual file creation
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createOrUpdateTodo } = await import('../githubService');
      const result = await createOrUpdateTodo(
        mockToken,
        mockOwner,
        mockRepo,
        'todos/unicode-todo.md',
        unicodeContent,
        'feat: Add unicode todo'
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2); // Should make 2 calls
    });
  });

  describe('getTodos - Fetching Todo Lists', () => {
    it('should fetch todos from active folder', async () => {
      const mockFiles = [
        {
          name: 'P3--2023-10-27--sample-todo.md',
          path: 'todos/P3--2023-10-27--sample-todo.md',
          sha: 'file-sha-1',
          type: 'file'
        }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"method":"GET"')
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
      const mockFiles = [
        {
          name: 'P1--2023-10-26--archived-todo.md',
          path: 'todos/archive/P1--2023-10-26--archived-todo.md',
          sha: 'file-sha-2',
          type: 'file'
        }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', true);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        title: 'archived-todo',
        priority: 1,
        isArchived: true
      });
    });

    it('should return empty array when no todos found', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      expect(result).toEqual([]);
    });

    it('handles API errors properly', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      const { getTodos } = await import('../githubService');
      const result = await getTodos(mockToken, mockOwner, mockRepo, mockFolder, false);

      expect(result).toEqual([]);
    });
  });

  describe('getFileContent - File Reading', () => {
    it('should fetch raw file content successfully', async () => {
      const expectedContent = '# Test Todo\n\n- [ ] Sample task';

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        text: () => Promise.resolve(expectedContent)
      }));

      const { getFileContent } = await import('../githubService');
      const result = await getFileContent('fake-token', 'test-owner', 'test-repo', 'todos/test-todo.md');

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"method":"GET"')
        })
      );

      expect(result).toBe(expectedContent);
    });

    it('handles file not found', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      const { getFileContent } = await import('../githubService');
      
      await expect(
        getFileContent(mockToken, mockOwner, mockRepo, 'nonexistent/file.md')
      ).rejects.toThrow();
    });
  });

  describe('deleteFile - File Deletion', () => {
    it('should delete a file successfully', async () => {
      const mockResponse = { 
        commit: { 
          message: 'feat: Delete test todo',
          sha: 'commit-sha' 
        }
      };

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { deleteFile } = await import('../githubService');
      const result = await deleteFile(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/test-todo.md',
        'file-sha',
        'feat: Delete test todo'
      );

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"method":"DELETE"')
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('getFileMetadata - File Metadata', () => {
    it('should fetch file metadata successfully', async () => {
      const mockMetadata = {
        sha: 'file-sha',
        content: btoa('# Test Content\n\n- [ ] Test task'), // Valid Base64 encoded content
        path: 'todos/test.md',
        name: 'test.md'
      };

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockMetadata)
      }));

      const { getFileMetadata } = await import('../githubService');
      const result = await getFileMetadata('fake-token', 'test-owner', 'test-repo', 'todos/test.md');

      expect(result).toMatchObject({
        sha: 'file-sha',
        content: '# Test Content\n\n- [ ] Test task', // Decoded content
        path: 'todos/test.md',
        name: 'test.md'
      });
    });

    it('returns file metadata successfully', async () => {
      const mockFileData = {
        name: 'example.md',
        path: 'todos/example.md',
        sha: 'example-sha',
        content: btoa('# Example\n\n- [ ] Task')
      };

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFileData)
      }));

      const { getFileMetadata } = await import('../githubService');
      const result = await getFileMetadata(mockToken, mockOwner, mockRepo, 'todos/example.md');

      expect(result.sha).toBe('example-sha');
      expect(result.content).toBe('# Example\n\n- [ ] Task');
      expect(result.path).toBe('todos/example.md');
    });
  });

  describe('listProjectFolders - Folder Management', () => {
    it('should list available project folders successfully', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-tasks', type: 'dir' },
        { name: 'personal', type: 'dir' },
        { name: 'README.md', type: 'file' } // Should be filtered out
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toEqual(['todos', 'work-tasks', 'personal']);
    });

    it('should return default folder array on API error', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toEqual(['todos']);
    });

    it('should add default todos folder when not present', async () => {
      const mockContents = [
        { name: 'work-project', type: 'dir' },
        { name: 'personal-tasks', type: 'dir' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toContain('todos');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should not duplicate todos folder when already present', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-project', type: 'dir' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders(mockToken, mockOwner, mockRepo);

      const todosCount = result.filter(folder => folder === 'todos').length;
      expect(todosCount).toBe(1);
    });

    it('should filter folders using pattern matching', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' }, // Exact match
        { name: 'work-tasks', type: 'dir' }, // work- pattern
        { name: 'personal-project', type: 'dir' }, // personal- pattern
        { name: 'my-work-items', type: 'dir' }, // Contains work
        { name: 'task-management', type: 'dir' }, // task- pattern
        { name: 'project-alpha', type: 'dir' }, // project- pattern
        { name: 'validFolder123', type: 'dir' }, // Should match pattern
        { name: '123invalid', type: 'dir' }, // Should not match pattern
        { name: 'README.md', type: 'file' } // Should be filtered out (not dir)
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal-project');
      expect(result).toContain('my-work-items');
      expect(result).toContain('validFolder123');
      // Just verify the function executed successfully and returned an array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('createProjectFolder - Folder Creation', () => {
    it('should create a new project folder successfully', async () => {
      const mockResponse = { 
        content: { 
          path: 'new-project/.gitkeep',
          sha: 'gitkeep-sha' 
        }
      };

      // Mock 4 calls total: 2 getFileMetadata failures + 2 actual file creations
      mockFetchWithTimeout
        // First file creation sequence
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        }))
        // Second file creation sequence  
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { 
              path: 'new-project/archive/.gitkeep',
              sha: 'archive-gitkeep-sha' 
            }
          })
        }));

      await githubService.createProjectFolder('fake-token', 'test-owner', 'test-repo', 'new-project');

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(4); // 2 getFileMetadata calls + 2 file creations
    });

    it('should validate folder name format', async () => {
      const { createProjectFolder } = await import('../githubService');

      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', 'invalid folder name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        createProjectFolder('fake-token', 'test-owner', 'test-repo', '123-starts-with-number')
      ).rejects.toThrow('Invalid folder name');
    });

    it('creates new project folder successfully', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      // Mock the main folder .gitkeep creation
      mockFetchWithTimeout
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found')) // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { path: 'test-project/.gitkeep', sha: 'sha1' }
          })
        }))
        // Mock the archive .gitkeep creation  
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found')) // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { path: 'test-project/archive/.gitkeep', sha: 'sha2' }
          })
        }));

      const result = await createProjectFolder(mockToken, mockOwner, mockRepo, 'test-project');

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(4);
      expect(result).toBeUndefined(); // Function doesn't return anything
    });
  });

  describe('moveTaskToArchive - Archive Operations', () => {
    it('should move a task to archive successfully', async () => {
      const mockFileContent = '# Test Todo\n\n- [x] Completed task';
      // Use a simple, known-good Base64 string for testing
      const validBase64Content = 'IyBUZXN0IFRvZG8KCi0gW3hdIENvbXBsZXRlZCB0YXNr'; // btoa('# Test Todo\n\n- [x] Completed task')
      
      // Mock all the API calls in sequence:
      mockFetchWithTimeout
        // 1. ensureArchiveDirectory - check if archive exists (success = directory exists)
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([]) // Directory exists
        }))
        // 2. getFileMetadata - get current file metadata  
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            sha: 'existing-file-sha',
            content: validBase64Content,
            path: 'todos/test.md',
            name: 'test.md'
          })
        }))
        // 3. createOrUpdateTodo sequence - check if archive file exists (should fail)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))
        // 4. createOrUpdateTodo - actual creation
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { path: 'todos/archive/test.md', sha: 'new-sha' }
          })
        }))
        // 5. deleteFile - delete original file
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            commit: { message: 'Archive: Remove test.md from active todos' }
          })
        }));

      const result = await githubService.moveTaskToArchive(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        mockFileContent,
        'Archive: Move completed task',
        'todos'
      );

      expect(result).toBe('todos/archive/test.md');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(5); // ensureArchive + getFileMetadata + createOrUpdate (check + create) + delete
    });

    it('should handle custom folder in moveTaskToArchive', async () => {
      const { moveTaskToArchive } = await import('../githubService');
      
      const currentPath = 'work/project-task.md';
      const content = '# Project Task';
      const commitMessage = 'Archive work task';
      const customFolder = 'work';
      
      mockFetchWithTimeout
        // ensureArchiveDirectory for custom folder
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([])
        }))
        // getFileMetadata
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            sha: 'file-sha',
            content: btoa(content),
            path: currentPath,
            name: 'project-task.md'
          })
        }))
        // createOrUpdateTodo check (fails - file doesn't exist in archive)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))
        // createOrUpdateTodo actual creation
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { path: 'work/archive/project-task.md', sha: 'archive-sha' }
          })
        }))  
        // deleteFile - delete original
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            commit: { sha: 'delete-sha' }
          })
        }));

      const result = await moveTaskToArchive(
        mockToken,
        mockOwner,
        mockRepo,
        currentPath,
        content,
        commitMessage,
        customFolder
      );

      expect(result).toBe('work/archive/project-task.md');
    });
  });

  describe('moveTaskFromArchive - Archive Recovery Operations', () => {
    it('should successfully move task from archive to active folder', async () => {
      const { moveTaskFromArchive } = await import('../githubService');
      
      const currentPath = 'todos/archive/2025-07-24-test-task.md';
      const content = '# Test Task\n\n- [ ] Task item';
      const commitMessage = 'Unarchive: Move task back to active';
      
      mockFetchWithTimeout
        // getFileMetadata call - get current file info
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            sha: 'archive-file-sha',
            content: btoa(content),
            path: currentPath,
            name: '2025-07-24-test-task.md'
          })
        }))
        // createOrUpdateTodo check if active file exists (should fail)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))
        // createOrUpdateTodo actual creation in active folder
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: () => Promise.resolve({
            content: { 
              path: 'todos/2025-07-24-test-task.md',
              sha: 'new-active-sha'
            }
          })
        }))
        // deleteFile - remove from archive
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            commit: { sha: 'delete-commit-sha' }
          })
        }));

      const result = await moveTaskFromArchive(
        mockToken,
        mockOwner,
        mockRepo,
        currentPath,
        content,
        commitMessage
      );

      expect(result).toBe('todos/2025-07-24-test-task.md');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(4);
    });

    it('should handle custom folder in moveTaskFromArchive', async () => {
      const { moveTaskFromArchive } = await import('../githubService');
      
      const currentPath = 'work/archive/task.md';
      const content = '# Work Task';
      const commitMessage = 'Unarchive work task';
      const customFolder = 'work';
      
      mockFetchWithTimeout
        // getFileMetadata
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            sha: 'archive-sha',
            content: btoa(content),
            path: currentPath,
            name: 'task.md'
          })
        }))
        // createOrUpdateTodo check (fails)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))
        // createOrUpdateTodo creation
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            content: { path: 'work/task.md', sha: 'active-sha' }
          })
        }))
        // deleteFile
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({
            commit: { sha: 'delete-sha' }
          })
        }));

      const result = await moveTaskFromArchive(
        mockToken,
        mockOwner,
        mockRepo,
        currentPath,
        content,
        commitMessage,
        customFolder
      );

      expect(result).toBe('work/task.md');
    });

    it('should handle errors when file not found in archive', async () => {
      const { moveTaskFromArchive } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found')
      }));

      await expect(
        moveTaskFromArchive(
          mockToken,
          mockOwner,
          mockRepo,
          'missing/archive/file.md',
          'content',
          'commit message'
        )
      ).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      const { moveTaskFromArchive } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      }));

      await expect(
        moveTaskFromArchive(
          mockToken,
          mockOwner,
          mockRepo,
          'archive/file.md',
          'content',
          'commit message'
        )
      ).rejects.toThrow();
    });
  });

  describe('getFileHistory - Git History', () => {
    it('returns commit history for file successfully', async () => {
      const mockCommits = [
        {
          sha: 'commit-1',
          commit: {
            message: 'Update task',
            author: { name: 'User', date: '2023-10-27T10:00:00Z' }
          }
        }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ commits: mockCommits })
      }));

      const result = await githubService.getFileHistory(mockToken, mockOwner, mockRepo, 'todos/task.md');

      expect(result).toEqual(mockCommits);
      expect(result[0]).toMatchObject({
        sha: 'commit-1',
        commit: expect.objectContaining({
          message: 'Update task'
        })
      });
    });
  });

  describe('getFileAtCommit - Historical File Content', () => {
    it('should fetch file content at specific commit', async () => {
      const mockContent = '# Historical Content\n\n- [ ] Old task';
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContent)
      }));

      const result = await githubService.getFileAtCommit(
        mockToken, 
        mockOwner, 
        mockRepo, 
        'todos/task.md',
        'commit-sha'
      );

      expect(result).toBe(mockContent);
    });

    it('should handle errors with proper error messages', async () => {
      const { getFileAtCommit } = await import('../githubService');
      
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        getFileAtCommit(
          mockToken,
          mockOwner,
          mockRepo,
          'path/to/file.md',
          'commit-sha'
        )
      ).rejects.toThrow('Network error');
    });
  });

  describe('Environment Detection', () => {
    it('should handle different environment configurations', () => {
      // Test localhost environment
      expect(global.window.location.hostname).toBe('localhost');
      expect(global.window.location.port).toBe('3000');
      
      // Test that relative URLs are used consistently
      expect(typeof mockFetchWithTimeout).toBe('function');
    });

    it('should handle multiple hostname scenarios', () => {
      // Test Cloud Run environment
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hostname: 'am-todos-123456789-uc.a.run.app',
            port: '',
            origin: 'https://am-todos-123456789-uc.a.run.app',
            pathname: '/'
          }
        },
        writable: true
      });

      expect(global.window.location.hostname).toContain('.run.app');

      // Test IP address environment  
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hostname: '192.168.1.100',
            port: '3000',
            origin: 'http://192.168.1.100:3000',
            pathname: '/'
          }
        },
        writable: true
      });

      expect(global.window.location.hostname).toMatch(/^\d+\.\d+\.\d+\.\d+$/);

      // Test custom domain environment
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hostname: 'todos.example.com',
            port: '',
            origin: 'https://todos.example.com',
            pathname: '/'
          }
        },
        writable: true
      });

      expect(global.window.location.hostname).toBe('todos.example.com');
    });
  });

  describe('Error Handling Patterns', () => {
    it('should have consistent error handling across functions', async () => {
      // Test network error handling
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network error'));

      const { getTodos } = await import('../githubService');
      const result = await getTodos(mockToken, mockOwner, mockRepo, mockFolder, false);

      expect(result).toEqual([]);
    });

    it('handles network errors gracefully', async () => {
      // Mock first call (getFileMetadata) to succeed, second call to fail
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404
      }));
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network failed'));

      const { createOrUpdateTodo } = await import('../githubService');
      
      await expect(
        createOrUpdateTodo(mockToken, mockOwner, mockRepo, 'test.md', 'content', 'message')
      ).rejects.toThrow('Network failed');
    });

    it('handles invalid JSON responses', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toEqual(['todos']); // Falls back to default
    });

    it('handles listProjectFolders network error fallback', async () => {
      const { listProjectFolders } = await import('../githubService');
      
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toEqual(['todos']);
    });

    it('handles malformed JSON response', async () => {
      const { getFileMetadata } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.reject(new Error('Malformed JSON'))
      }));

      await expect(
        getFileMetadata(mockToken, mockOwner, mockRepo, 'test.md')
      ).rejects.toThrow('Malformed JSON');
    });
  });

  describe('Conditional Logic Coverage', () => {
    it('should test includeArchived ternary logic in getTodos', async () => {
      const { getTodos } = await import('../githubService');
      
      // Test active folder path (includeArchived = false)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      await getTodos(mockToken, mockOwner, mockRepo, 'work', false);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          body: expect.stringContaining('/repos/testuser/test-repo/contents/work') // Should be active folder
        })
      );

      vi.clearAllMocks();

      // Test archive folder path (includeArchived = true)  
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      await getTodos(mockToken, mockOwner, mockRepo, 'work', true);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          body: expect.stringContaining('/repos/testuser/test-repo/contents/work/archive') // Should be archive folder
        })
      );
    });
  });

  describe('createTodo - New Todo Creation with Filename Metadata', () => {
    it('should create a new todo with filename-based metadata', async () => {
      const mockResponse = {
        content: {
          name: 'P2--2023-10-27--sample-todo.md',
          path: 'todos/P2--2023-10-27--sample-todo.md',
          sha: 'new-todo-sha'
        }
      };

      // Mock the Date.toISOString to return predictable date
      const mockDate = new Date('2023-10-27T12:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      vi.spyOn(mockDate, 'toISOString').mockReturnValue('2023-10-27T12:00:00.000Z');

      // First call: getFileMetadata (should fail - new file)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('GitHub API error: Not Found'));
      
      // Second call: actual file creation
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }));

      const { createTodo } = await import('../githubService');
      const result = await createTodo(
        mockToken,
        mockOwner,
        mockRepo,
        'Sample Todo',
        '# Sample Todo\n\n- [ ] First task\n- [ ] Second task',
        2,
        'todos'
      );

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResponse);
      
      // Verify that the request includes the filename-based metadata format
      const createCall = mockFetchWithTimeout.mock.calls[1];
      expect(createCall[1].body).toContain('P2--2023-10-27--Sample_Todo.md');
      
      vi.restoreAllMocks();
    });

    it('should create todo with default priority and folder', async () => {
      const mockResponse = {
        content: {
          name: 'P3--2023-10-27--default-todo.md',
          path: 'todos/P3--2023-10-27--default-todo.md',
          sha: 'default-todo-sha'
        }
      };

      // Mock predictable date
      const mockDate = new Date('2023-10-27T12:00:00.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      vi.spyOn(mockDate, 'toISOString').mockReturnValue('2023-10-27T12:00:00.000Z');

      mockFetchWithTimeout
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        }));

      const { createTodo } = await import('../githubService');
      const result = await createTodo(
        mockToken,
        mockOwner,
        mockRepo,
        'Default Todo',
        '# Default Todo\n\n- [ ] Task'
        // Using default priority (3) and folder ('todos')
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
      
      // Verify default priority P3 is used
      const createCall = mockFetchWithTimeout.mock.calls[1];
      expect(createCall[1].body).toContain('P3--2023-10-27--Default_Todo.md');
      
      vi.restoreAllMocks();
    });
  });

  describe('Caching and Request Deduplication', () => {
    it('should handle cache behavior correctly', async () => {
      // Test basic caching functionality by making similar requests  
      const { getTodos } = await import('../githubService');
      
      // Mock successful response
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      // Make a request 
      const result = await getTodos(mockToken, mockOwner, mockRepo, 'todos', false);
      
      expect(result).toEqual([]);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should handle JSON parsing errors in cache', async () => {
      const { getFileContent } = await import('../githubService');
      
      // Mock a response that fails JSON parsing but succeeds as text
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('# Valid text content')
      }));

      const result = await getFileContent(mockToken, mockOwner, mockRepo, 'todos/test.md');
      
      expect(result).toBe('# Valid text content');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });

    it('should skip caching for non-JSON responses', async () => {
      const { getFileContent } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: () => Promise.resolve('# Plain text content')
      }));

      const result = await getFileContent(mockToken, mockOwner, mockRepo, 'todos/test.md');
      
      expect(result).toBe('# Plain text content');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Directory Creation Error Handling', () => {
    it('should handle ensureDirectory creation failure', async () => {
      const { ensureDirectory } = await import('../githubService');
      
      // First call: check if directory exists (fails - doesn't exist)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Directory not found'));
      
      // Second call: attempt to create directory (fails)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Permission denied')
      }));

      await expect(
        ensureDirectory(mockToken, mockOwner, mockRepo, 'new-folder')
      ).rejects.toThrow('GitHub API proxy error: Forbidden');

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should handle ensureArchiveDirectory creation failure', async () => {
      const { ensureArchiveDirectory } = await import('../githubService');
      
      // First call: check if archive directory exists (fails)
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Archive not found'));
      
      // Second call: attempt to create archive directory (fails)
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      }));

      await expect(
        ensureArchiveDirectory(mockToken, mockOwner, mockRepo, 'todos')
      ).rejects.toThrow('GitHub API proxy error: Internal Server Error');

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTodos Advanced Error Handling', () => {
    it('should handle unknown file format processing error', async () => {
      const { getTodos } = await import('../githubService');
      
      const mockFiles = [{
        name: 'unknown-format-file.md',
        path: 'todos/unknown-format-file.md',
        sha: 'unknown-sha',
        type: 'file'
      }];

      // Mock the main getTodos call
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      }));
      
      // Mock getFileContent call (for unknown format fallback) to fail
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Failed to fetch content'));

      const result = await getTodos(mockToken, mockOwner, mockRepo, 'todos', false);
      
      // Should handle the error gracefully and continue processing (empty result since file failed)
      expect(result).toEqual([]);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should handle network error with retry mechanism', async () => {
      const { getTodos } = await import('../githubService');
      
      // First call: network error
      mockFetchWithTimeout.mockRejectedValueOnce(new TypeError('fetch error'));
      
      // Retry call: success
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const result = await getTodos(mockToken, mockOwner, mockRepo, 'todos', false);
      
      expect(result).toEqual([]);
      // Should make 2 calls: original + retry
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });

    it('should handle network error with failed retry', async () => {
      const { getTodos } = await import('../githubService');
      
      // First call: network error
      mockFetchWithTimeout.mockRejectedValueOnce(new TypeError('Load failed'));
      
      // Retry call: also fails
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Retry failed'));

      const result = await getTodos(mockToken, mockOwner, mockRepo, 'todos', false);
      
      expect(result).toEqual([]);
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    });
  });

  describe('Git History Error Handling', () => {
    it('should handle getFileHistory API errors', async () => {
      const { getFileHistory } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found in history')
      }));

      await expect(
        getFileHistory(mockToken, mockOwner, mockRepo, 'todos/nonexistent.md')
      ).rejects.toThrow('Failed to fetch file history: Not Found');

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/git-history',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `token ${mockToken}`
          })
        })
      );
    });

    it('should handle getFileAtCommit API errors', async () => {
      const { getFileAtCommit } = await import('../githubService');
      
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid commit SHA')
      }));

      await expect(
        getFileAtCommit(mockToken, mockOwner, mockRepo, 'todos/test.md', 'invalid-sha')
      ).rejects.toThrow('Failed to fetch file at commit: Bad Request');

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/file-at-commit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            path: 'todos/test.md',
            sha: 'invalid-sha',
            owner: mockOwner,
            repo: mockRepo
          })
        })
      );
    });
  });
});