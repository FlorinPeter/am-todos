/**
 * GitHub Service Integration Tests - Complex Workflows and Real-World Scenarios
 * Consolidated from multiple test files focusing on integration scenarios
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

// Mock getFileMetadata to avoid Base64 environment issues
const mockGetFileMetadata = vi.fn();
vi.mock('../githubService', async () => {
  const actual = await vi.importActual('../githubService');
  return {
    ...actual,
    getFileMetadata: mockGetFileMetadata
  };
});

describe('GitHub Service - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWithTimeout.mockReset();
    mockGetFileMetadata.mockReset();
    
    // Mock Base64 functions to ensure they work in test environment
    global.btoa = global.btoa || ((str) => Buffer.from(str, 'utf8').toString('base64'));
    global.atob = global.atob || ((str) => Buffer.from(str, 'base64').toString('utf8'));
    
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

  describe('Service Interface and Exports', () => {
    it('should export all required functions', async () => {
      const githubService = await import('../githubService');

      // Core CRUD operations
      expect(typeof githubService.createOrUpdateTodo).toBe('function');
      expect(typeof githubService.getTodos).toBe('function');
      expect(typeof githubService.getFileContent).toBe('function');
      expect(typeof githubService.deleteFile).toBe('function');

      // Archive operations
      expect(typeof githubService.moveTaskToArchive).toBe('function');
      expect(typeof githubService.moveTaskFromArchive).toBe('function');

      // Project management
      expect(typeof githubService.listProjectFolders).toBe('function');
      expect(typeof githubService.createProjectFolder).toBe('function');

      // Git operations
      expect(typeof githubService.getFileHistory).toBe('function');
      expect(typeof githubService.getFileAtCommit).toBe('function');

      // Directory management
      expect(typeof githubService.ensureDirectory).toBe('function');
      expect(typeof githubService.ensureArchiveDirectory).toBe('function');
    });

    it('should handle function calls with proper parameter types', async () => {
      mockFetchWithTimeout.mockResolvedValue(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ content: { path: 'test.md' } })
      }));

      const { createOrUpdateTodo } = await import('../githubService');

      // Should not throw with correct parameter types
      await expect(
        createOrUpdateTodo(
          'fake-token',
          'test-owner',
          'test-repo',
          'todos/test.md',
          '# Test',
          'feat: Test'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Archive Workflow Integration', () => {
    it('should use archive path when includeArchived=true', async () => {
      const mockFiles = [
        {
          name: 'P1--2023-10-26--archived-task.md',
          path: 'todos/archive/P1--2023-10-26--archived-task.md',
          sha: 'archive-sha',
          type: 'file'
        }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', true);

      expect(mockFetchWithTimeout).toHaveBeenCalledWith(
        '/api/github',
        expect.objectContaining({
          body: expect.stringContaining('todos/archive')
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].isArchived).toBe(true);
    });

    it.skip('should complete full archive/unarchive workflow', async () => {
      const mockFileContent = 'Test Content'; // Simplest possible content
      const mockArchiveResponse = { content: { path: 'todos/archive/test.md' } };
      const mockUnarchiveResponse = { content: { path: 'todos/test.md' } };

      // Mock getFileMetadata directly to avoid Base64 environment issues
      mockGetFileMetadata
        .mockResolvedValueOnce({
          sha: 'file-sha',
          content: mockFileContent,
          path: 'todos/test.md',
          name: 'test.md'
        })
        .mockResolvedValueOnce({
          sha: 'archive-sha',
          content: mockFileContent,
          path: 'todos/archive/test.md',
          name: 'test.md'
        });

      // Mock the archive workflow: ensure archive dir -> create in archive -> delete original
      mockFetchWithTimeout
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([]) // Directory exists
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockArchiveResponse)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ commit: { message: 'Deleted' } })
        }));

      const { moveTaskToArchive } = await import('../githubService');
      const archiveResult = await moveTaskToArchive(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        mockFileContent,
        'Archive: Move completed task',
        'todos'
      );

      expect(archiveResult).toBe('todos/archive/test.md');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3); // ensureArchive + create + delete
      expect(mockGetFileMetadata).toHaveBeenCalledTimes(1); // getMetadata for current file

      // Now test unarchive workflow
      mockFetchWithTimeout.mockClear();
      mockFetchWithTimeout
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockUnarchiveResponse)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ commit: { message: 'Deleted' } })
        }));

      const { moveTaskFromArchive } = await import('../githubService');
      const unarchiveResult = await moveTaskFromArchive(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/archive/test.md',
        mockFileContent,
        'Unarchive: Restore active task',
        'todos'
      );

      expect(unarchiveResult).toBe('todos/test.md');
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2); // create + delete (getMetadata now mocked separately)
      expect(mockGetFileMetadata).toHaveBeenCalledTimes(2); // Initial + unarchive getMetadata calls
    });
  });

  describe('Environment Detection Integration', () => {
    it('should use relative URLs for all environments', async () => {
      const environments = [
        { hostname: 'localhost', port: '3000', origin: 'http://localhost:3000' },
        { hostname: '127.0.0.1', port: '3000', origin: 'http://127.0.0.1:3000' },
        { hostname: 'production.example.com', port: '443', origin: 'https://production.example.com' },
        { hostname: 'app.company.com', port: '443', origin: 'https://app.company.com' }
      ];

      for (const env of environments) {
        Object.defineProperty(global, 'window', {
          value: { location: env },
          writable: true
        });

        mockFetchWithTimeout.mockClear();
        mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve([])
        }));

        const { getTodos } = await import('../githubService');
        await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

        // Should always use relative URL regardless of environment
        expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/github', expect.any(Object));
      }
    });

    it('should handle different deployment contexts', async () => {
      // Test Cloud Run environment
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            hostname: 'myapp-123456-ue.a.run.app',
            port: '443',
            origin: 'https://myapp-123456-ue.a.run.app'
          }
        },
        writable: true
      });

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { listProjectFolders } = await import('../githubService');
      await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/github', expect.any(Object));
    });
  });

  describe('Git History Integration', () => {
    it('should fetch file history successfully', async () => {
      const mockHistory = [
        { sha: 'abc123', message: 'Initial commit', author: 'user', date: '2023-10-01' },
        { sha: 'def456', message: 'Update task', author: 'user', date: '2023-10-02' }
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ commits: mockHistory }) // Wrap in commits property
      }));

      const { getFileHistory } = await import('../githubService');
      const result = await getFileHistory('fake-token', 'test-owner', 'test-repo', 'todos/test.md');

      expect(result).toEqual(mockHistory);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/git-history',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('todos/test.md')
        })
      );
    });

    it('should get file at specific commit', async () => {
      const mockFileAtCommit = {
        content: '# Old Version\n\n- [ ] Old task',
        sha: 'abc123'
      };

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFileAtCommit)
      }));

      const { getFileAtCommit } = await import('../githubService');
      const result = await getFileAtCommit(
        'fake-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        'abc123'
      );

      expect(result).toEqual(mockFileAtCommit);
      expect(mockFetchWithTimeout).toHaveBeenCalledWith('/api/file-at-commit',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"sha":"abc123"')
        })
      );
    });
  });

  describe('Complete Project Workflow', () => {
    it('should create complete project structure with archive support', async () => {
      // Mock responses for creating main folder and archive folder
      // Each createOrUpdateTodo calls getFileMetadata first, then actual creation
      mockFetchWithTimeout
        // First file creation sequence (main folder)
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ content: { path: 'new-project/.gitkeep' } })
        }))
        // Second file creation sequence (archive folder) 
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ content: { path: 'new-project/archive/.gitkeep' } })
        }));

      const { createProjectFolder } = await import('../githubService');
      await createProjectFolder('fake-token', 'test-owner', 'test-repo', 'new-project');

      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(4); // 2 getFileMetadata calls + 2 file creations
      
      // Verify main folder creation (call 2 - actual creation after getFileMetadata fails)
      expect(mockFetchWithTimeout).toHaveBeenNthCalledWith(2, '/api/github', 
        expect.objectContaining({
          body: expect.stringContaining('new-project/.gitkeep')
        })
      );

      // Verify archive folder creation (call 4 - actual creation after getFileMetadata fails)
      expect(mockFetchWithTimeout).toHaveBeenNthCalledWith(4, '/api/github',
        expect.objectContaining({
          body: expect.stringContaining('new-project/archive/.gitkeep')
        })
      );
    });

    it('should handle successful getTodos with filtering', async () => {
      const mockFiles = [
        { name: 'P1--2023-10-27--high-priority.md', path: 'todos/P1--2023-10-27--high-priority.md', sha: 'sha1', type: 'file' },
        { name: 'P3--2023-10-26--normal-task.md', path: 'todos/P3--2023-10-26--normal-task.md', sha: 'sha2', type: 'file' },
        { name: 'README.md', path: 'todos/README.md', sha: 'sha3', type: 'file' }, // Should be filtered out
        { name: '.gitkeep', path: 'todos/.gitkeep', sha: 'sha4', type: 'file' } // Should be filtered out
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      }));

      const { getTodos } = await import('../githubService');
      const result = await getTodos('fake-token', 'test-owner', 'test-repo', 'todos', false);

      // Should only include markdown files with proper naming
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('high-priority');
      expect(result[0].priority).toBe(1);
      expect(result[1].title).toBe('normal-task');
      expect(result[1].priority).toBe(3);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should have consistent error handling across functions', async () => {
      mockFetchWithTimeout.mockResolvedValue(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      }));

      const githubService = await import('../githubService');

      // Test that all functions handle errors consistently
      await expect(
        githubService.createOrUpdateTodo('token', 'owner', 'repo', 'test.md', '# Test', 'feat: Test')
      ).rejects.toThrow('GitHub API proxy error');

      await expect(
        githubService.deleteFile('token', 'owner', 'repo', 'test.md', 'sha', 'Delete test')
      ).rejects.toThrow('GitHub API proxy error');

      await expect(
        githubService.getFileHistory('token', 'owner', 'repo', 'test.md')
      ).rejects.toThrow();

      await expect(
        githubService.getFileAtCommit('token', 'owner', 'repo', 'test.md', 'abc123')
      ).rejects.toThrow();
    });

    it('should handle delete error and throw with detailed message', async () => {
      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found')
      }));

      const { deleteFile } = await import('../githubService');

      await expect(
        deleteFile('fake-token', 'test-owner', 'test-repo', 'nonexistent.md', 'fake-sha', 'Delete nonexistent')
      ).rejects.toThrow('GitHub API proxy error: Not Found - File not found');
    });
  });

  describe('API Pattern Consistency', () => {
    it('should use consistent API patterns across all functions', async () => {
      // Mock sequence for createOrUpdateTodo: getFileMetadata (fails) + actual creation
      mockFetchWithTimeout
        .mockRejectedValueOnce(new Error('GitHub API error: Not Found'))  // getFileMetadata fails
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ content: { path: 'test.md' } })
        }))
        // Mock for deleteFile
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ commit: { message: 'Deleted' } })
        }));

      const { createOrUpdateTodo, deleteFile } = await import('../githubService');

      // Test that all API calls follow the same pattern
      await createOrUpdateTodo('token', 'owner', 'repo', 'test.md', '# Test', 'feat: Test');
      await deleteFile('token', 'owner', 'repo', 'test.md', 'sha', 'Delete test');

      // All calls should go to /api/github with POST method
      expect(mockFetchWithTimeout).toHaveBeenCalledTimes(3); // getFileMetadata + create + delete
      
      for (let i = 0; i < 3; i++) {
        expect(mockFetchWithTimeout).toHaveBeenNthCalledWith(i + 1, '/api/github',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
    });

    it('should return default fallback when API request fails', async () => {
      mockFetchWithTimeout.mockRejectedValueOnce(new Error('Network failure'));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toEqual(['todos']); // Default fallback
    });

    it('should successfully return filtered folders when API call succeeds', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-tasks', type: 'dir' },
        { name: 'personal-notes', type: 'dir' },
        { name: 'node_modules', type: 'dir' } // Should be included as valid pattern
      ];

      mockFetchWithTimeout.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');
      const result = await listProjectFolders('fake-token', 'test-owner', 'test-repo');

      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal-notes');
      expect(result).toContain('node_modules');
    });
  });
});