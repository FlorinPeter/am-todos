/**
 * GitLab Service Coverage Tests - Direct function testing without caching interference
 * Focused on achieving 80%+ coverage by testing uncovered lines systematically
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

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
    clone: () => createMockResponse(options)
  };
  return mockResponse;
};

// Mock all external dependencies to isolate GitLab service
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

vi.mock('../../utils/filenameMetadata', () => ({
  parseFilenameMetadata: vi.fn(() => null),
  parseLegacyFilenameMetadata: vi.fn(() => null),
  generateFilename: vi.fn((priority: number, date: string, title: string) => 
    `P${priority}--${date}--${title.toLowerCase().replace(/\s+/g, '-')}.md`
  ),
  isNewFormatFilename: vi.fn(() => false)
}));

vi.mock('../../utils/markdown', () => ({
  parseMarkdownWithMetadata: vi.fn((content: string) => ({
    title: 'Parsed Title',
    frontmatter: { tags: [] },
    priority: 3,
    createdAt: '2023-01-01T00:00:00.000Z'
  })),
  stringifyMarkdownWithMetadata: vi.fn((frontmatter: any, content: string) => 
    `---\ntags: []\n---\n${content}`
  )
}));

type GitLabSettings = {
  instanceUrl: string;
  projectId: string;
  token: string;
  branch: string;
};

describe('GitLab Service Coverage Tests', () => {
  const mockSettings: GitLabSettings = {
    instanceUrl: 'https://gitlab.com',
    projectId: '12345',
    token: 'test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Set up test environment
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          port: '3000'
        }
      },
      writable: true
    });

    global.atob = (str: string) => {
      if (!str) return '';
      return Buffer.from(str, 'base64').toString('binary');
    };
  });

  describe('createTodo function', () => {
    it('should create todo with proper filename and call createOrUpdateTodo', async () => {
      // Fresh import for each test to avoid cache
      const { createTodo } = await import('../gitlabService');
      
      const mockResult = {
        content: { sha: 'new-todo-sha' },
        commit: { sha: 'commit-sha-123' }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 201,
        json: async () => mockResult
      }));

      const result = await createTodo(
        mockSettings,
        'Test Todo Title',
        '# Test Todo\n\n- [ ] First task',
        2,
        'work'
      );

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('getTodos function', () => {
    it('should successfully fetch todos from folder', async () => {
      const { getTodos } = await import('../gitlabService');
      
      const mockFiles = [
        {
          name: 'task1.md',
          path: 'todos/task1.md',
          sha: 'sha1'
        },
        {
          name: 'task2.md',
          path: 'todos/task2.md',
          sha: 'sha2'
        }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFiles
      }));

      const result = await getTodos(mockSettings, 'todos', false);

      expect(Array.isArray(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });

    it('should handle network errors with retry logic (covers lines 624-633)', async () => {
      const { getTodos } = await import('../gitlabService');
      
      // First call fails with network error
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => []
        }));

      const result = await getTodos(mockSettings, 'todos', false);

      expect(Array.isArray(result)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + retry
    });

    it('should return empty array when both original and retry fail (covers lines 631-633)', async () => {
      const { getTodos } = await import('../gitlabService');
      
      // Both calls fail with network errors to trigger the retry catch block
      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('retry also failed'));

      const result = await getTodos(mockSettings, 'todos', false);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + retry both fail
    });

    it('should create archive directory when getTodos fails (covers lines 682-688)', async () => {
      const { ensureArchiveDirectory } = await import('../gitlabService');
      
      // Force the function to hit the catch block by making getTodos fail with non-network error
      mockFetch
        .mockResolvedValueOnce(createMockResponse({  // First call to getTodos fails 
          ok: false,
          status: 404,
          text: async () => 'Archive directory not found'
        }))
        .mockResolvedValueOnce(createMockResponse({  // createOrUpdateTodo succeeds
          ok: true,
          status: 201,
          json: async () => ({ path: 'todos/archive/.gitkeep' })
        }));

      await ensureArchiveDirectory(mockSettings, 'todos');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile function', () => {
    it('should successfully delete file via API', async () => {
      const { deleteFile } = await import('../gitlabService');
      
      const mockResult = {
        commit: { sha: 'delete-commit-sha' }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockResult
      }));

      const result = await deleteFile(
        mockSettings,
        'todos/task-to-delete.md',
        'Delete completed task'
      );

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('getFileHistory function', () => {
    it('should successfully fetch file history', async () => {
      const { getFileHistory } = await import('../gitlabService');
      
      const mockCommits = [
        { sha: 'commit1', message: 'Initial commit' },
        { sha: 'commit2', message: 'Update task' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockCommits
      }));

      const result = await getFileHistory(mockSettings, 'todos/task.md');

      expect(result).toEqual(mockCommits);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('getFileAtCommit function', () => {
    it('should successfully fetch file at specific commit', async () => {
      const { getFileAtCommit } = await import('../gitlabService');
      
      const mockData = {
        content: 'file content at commit',
        sha: 'commit-sha-456'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockData
      }));

      const result = await getFileAtCommit(
        mockSettings,
        'todos/task.md',
        'commit-sha-456'
      );

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('getProject function', () => {
    it('should successfully fetch project information', async () => {
      const { getProject } = await import('../gitlabService');
      
      const mockProject = {
        id: 12345,
        name: 'Test Project',
        path_with_namespace: 'user/test-project'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockProject
      }));

      const result = await getProject(mockSettings);

      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('createOrUpdateTodo function', () => {
    it('should successfully create or update todo', async () => {
      const { createOrUpdateTodo } = await import('../gitlabService');
      
      const mockResult = {
        content: { sha: 'updated-sha' },
        commit: { sha: 'update-commit' }
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockResult
      }));

      const result = await createOrUpdateTodo(
        mockSettings,
        'todos/test-task.md',
        '# Updated Task\n\n- [x] Completed item\n- [ ] New item',
        'Update task with progress'
      );

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });

  describe('ensureDirectory function', () => {
    it('should verify directory exists by calling getTodos', async () => {
      const { ensureDirectory } = await import('../gitlabService');
      
      // Mock getTodos to succeed (directory exists)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => []  // Empty array means directory exists but is empty
      }));

      await ensureDirectory(mockSettings, 'testfolder');

      expect(mockFetch).toHaveBeenCalledTimes(1);  // Only getTodos called
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });
  });


  describe('listProjectFolders filtering logic', () => {
    it('should filter folders and add default when no matches (covers lines 824-852)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        // System folders that should be excluded (covers lines 824-833)
        { name: 'src', type: 'tree' },
        { name: 'node_modules', type: 'tree' },
        { name: '.git', type: 'tree' },
        { name: 'build', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);

      // Should include 'todos' as default when no project folders found (covers lines 849-850)
      expect(result).toContain('todos');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});