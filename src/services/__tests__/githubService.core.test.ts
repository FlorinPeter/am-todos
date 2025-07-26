/**
 * GitHub Service Core Tests - Main CRUD Operations and Happy Path Scenarios
 * Consolidated from 11 redundant test files to eliminate massive duplication
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

describe('GitHub Service - Core Functionality', () => {
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
  });
});