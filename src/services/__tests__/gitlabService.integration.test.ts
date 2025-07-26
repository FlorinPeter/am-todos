/**
 * GitLab Service Integration Tests - Complex Workflows and Real API Scenarios
 * Consolidated from multiple test files focusing on integration scenarios
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

describe('GitLab Service - Integration Tests', () => {
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

  describe('Service Interface and Exports', () => {
    it('should export all required functions', async () => {
      const gitlabService = await import('../gitlabService');

      // Core CRUD operations
      expect(typeof gitlabService.createOrUpdateTodo).toBe('function');
      expect(typeof gitlabService.getTodos).toBe('function');
      expect(typeof gitlabService.getFileContent).toBe('function');
      expect(typeof gitlabService.deleteFile).toBe('function');

      // Archive operations
      expect(typeof gitlabService.moveTaskToArchive).toBe('function');
      expect(typeof gitlabService.moveTaskFromArchive).toBe('function');

      // Project management
      expect(typeof gitlabService.listProjectFolders).toBe('function');
      expect(typeof gitlabService.createProjectFolder).toBe('function');

      // Git operations
      expect(typeof gitlabService.getFileHistory).toBe('function');
      expect(typeof gitlabService.getFileAtCommit).toBe('function');
      expect(typeof gitlabService.getProject).toBe('function');
    });

    it('should handle function calls with proper parameter types', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' })
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');

      // Should not throw with correct parameter types
      await expect(
        createOrUpdateTodo(
          mockSettings,
          'todos/test.md',
          '# Test',
          'feat: Test'
        )
      ).resolves.toBeDefined();
    });
  });

  describe('Archive Workflow Integration', () => {
    it('should complete full archive/unarchive workflow', async () => {
      const mockFileContent = '# Test Todo\n\n- [x] Completed task';
      const mockArchiveResponse = { file_path: 'todos/archive/test.md' };
      const mockUnarchiveResponse = { file_path: 'todos/test.md' };

      // Mock the archive workflow: get content -> create in archive -> delete original
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          text: () => Promise.resolve(mockFileContent)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockArchiveResponse)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Deleted' })
        }));

      const { moveTaskToArchive } = await import('../gitlabService');
      const archiveResult = await moveTaskToArchive(
        mockSettings,
        'todos/test.md',
        mockFileContent,
        'Archive: Move completed task'
      );

      expect(archiveResult).toBe('todos/archive/test.md');
      expect(fetch).toHaveBeenCalledTimes(3); // archive operation calls

      // Now test unarchive workflow
      mockFetch.mockClear();
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          text: () => Promise.resolve(mockFileContent)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve(mockUnarchiveResponse)
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Deleted' })
        }));

      const { moveTaskFromArchive } = await import('../gitlabService');
      const unarchiveResult = await moveTaskFromArchive(
        mockSettings,
        'todos/archive/test.md',
        mockFileContent,
        'Unarchive: Restore active task'
      );

      expect(unarchiveResult).toBe('todos/test.md');
      expect(fetch).toHaveBeenCalledTimes(2); // unarchive operation calls
    });
  });

  describe('Project Creation Workflow', () => {
    it('should create complete project structure', async () => {
      // Mock responses for creating main folder and archive folder
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Main folder created' })
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: () => Promise.resolve({ message: 'Archive folder created' })
        }));

      const { createProjectFolder } = await import('../gitlabService');
      await createProjectFolder(mockSettings, 'new-project');

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Verify main folder creation
      expect(fetch).toHaveBeenNthCalledWith(1, '/api/gitlab', 
        expect.objectContaining({
          body: expect.stringContaining('new-project/.gitkeep')
        })
      );

      // Verify archive folder creation
      expect(fetch).toHaveBeenNthCalledWith(2, '/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('new-project/archive/.gitkeep')
        })
      );
    });
  });

  describe('Git History Integration', () => {
    it('should fetch file history successfully', async () => {
      const mockHistory = [
        { sha: 'abc123', message: 'Initial commit', author: 'user' },
        { sha: 'def456', message: 'Update task', author: 'user' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ commits: mockHistory })
      }));

      const { getFileHistory } = await import('../gitlabService');
      const result = await getFileHistory(mockSettings, 'todos/test.md');

      expect(result).toEqual({ commits: mockHistory });
      expect(fetch).toHaveBeenCalledWith('/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('getFileHistory'),
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should get file at specific commit', async () => {
      const mockFileAtCommit = {
        content: '# Old Version\n\n- [ ] Old task',
        sha: 'abc123'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockFileAtCommit)
      }));

      const { getFileAtCommit } = await import('../gitlabService');
      const result = await getFileAtCommit(
        mockSettings,
        'todos/test.md',
        'abc123'
      );

      expect(result).toEqual(mockFileAtCommit);
      expect(fetch).toHaveBeenCalledWith('/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"sha":"abc123"')
        })
      );
    });
  });

  describe('Different GitLab Instance Configurations', () => {
    it('should handle different GitLab instance URLs', async () => {
      const customSettings = {
        instanceUrl: 'https://custom-gitlab.company.com',
        projectId: '98765',
        token: 'glpat-custom-token',
        branch: 'develop'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([])
      }));

      const { getTodos } = await import('../gitlabService');
      await getTodos(customSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledWith('/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('custom-gitlab.company.com')
        })
      );
    });

    it('should handle custom branch names', async () => {
      const branchSettings = {
        ...mockSettings,
        branch: 'feature-branch'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'Created' })
      }));

      const { createOrUpdateTodo } = await import('../gitlabService');
      await createOrUpdateTodo(
        branchSettings,
        'todos/feature-test.md',
        '# Feature Test',
        'feat: Add feature test'
      );

      expect(fetch).toHaveBeenCalledWith('/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"branch":"feature-branch"')
        })
      );
    });
  });

  describe('Error Handling Consistency', () => {
    it('should have consistent error handling across functions', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      }));

      const gitlabService = await import('../gitlabService');

      // Test that all functions handle errors consistently
      await expect(
        gitlabService.createOrUpdateTodo(mockSettings, 'test.md', '# Test', 'feat: Test')
      ).rejects.toThrow('GitLab API proxy error');

      await expect(
        gitlabService.deleteFile(mockSettings, 'test.md', 'Delete test')
      ).rejects.toThrow('GitLab API proxy error');

      await expect(
        gitlabService.getFileHistory(mockSettings, 'test.md')
      ).rejects.toThrow();

      await expect(
        gitlabService.getFileAtCommit(mockSettings, 'test.md', 'abc123')
      ).rejects.toThrow();
    });
  });

  describe('Project Information Integration', () => {
    it('should fetch project information successfully', async () => {
      const mockProject = {
        id: 12345,
        name: 'test-project',
        default_branch: 'main',
        web_url: 'https://gitlab.example.com/user/test-project'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockProject)
      }));

      const { getProject } = await import('../gitlabService');
      const result = await getProject(mockSettings);

      expect(result).toEqual(mockProject);
      expect(fetch).toHaveBeenCalledWith('/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"action":"getProject"')
        })
      );
    });

    it('should handle project API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Project not found',
        text: () => Promise.resolve('Project not found')
      }));

      const { getProject } = await import('../gitlabService');

      await expect(
        getProject(mockSettings)
      ).rejects.toThrow('GitLab API proxy error');
    });
  });

  describe('API Pattern Consistency', () => {
    it('should use consistent API patterns across all functions', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        json: () => Promise.resolve({ message: 'Success' })
      }));

      const { createOrUpdateTodo, deleteFile } = await import('../gitlabService');

      // Test that all API calls follow the same pattern
      await createOrUpdateTodo(mockSettings, 'test.md', '# Test', 'feat: Test');
      await deleteFile(mockSettings, 'test.md', 'Delete test');

      // All calls should go to /api/gitlab with POST method
      expect(fetch).toHaveBeenCalledTimes(2);
      
      for (let i = 0; i < 2; i++) {
        expect(fetch).toHaveBeenNthCalledWith(i + 1, '/api/gitlab',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
    });
  });
});