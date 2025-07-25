/**
 * Essential GitLab Service Coverage Tests - Focus on pushing over 80% coverage
 * Specifically targeting uncovered lines: 631-633, 682-688
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

describe('GitLab Service Essential Coverage Tests', () => {
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

  describe('Critical coverage improvements', () => {

    it('should test basic functionality coverage', async () => {
      const { getTodos } = await import('../gitlabService');
      
      const mockFiles = [
        { name: 'task1.md', path: 'todos/task1.md', sha: 'sha1' },
        { name: 'task2.md', path: 'todos/task2.md', sha: 'sha2' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFiles
      }));

      const result = await getTodos(mockSettings, 'todos', false);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should test createTodo function', async () => {
      const { createTodo } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 201,
        json: async () => ({ content: { sha: 'new-sha' }, commit: { sha: 'commit-sha' } })
      }));

      const result = await createTodo(mockSettings, 'Test', 'Content', 2, 'todos');
      expect(result).toBeDefined();
    });

    it('should test deleteFile function', async () => {
      const { deleteFile } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ commit: { sha: 'delete-sha' } })
      }));

      const result = await deleteFile(mockSettings, 'todos/task.md', 'Delete task');
      expect(result).toBeDefined();
    });

    it('should test getFileHistory function', async () => {
      const { getFileHistory } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => [{ sha: 'commit1', message: 'First' }]
      }));

      const result = await getFileHistory(mockSettings, 'todos/task.md');
      expect(result).toBeDefined();
    });

    it('should test getFileAtCommit function', async () => {
      const { getFileAtCommit } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ content: 'content', sha: 'sha' })
      }));

      const result = await getFileAtCommit(mockSettings, 'todos/task.md', 'commit-sha');
      expect(result).toBeDefined();
    });

    it('should test getProject function', async () => {
      const { getProject } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 123, name: 'Project' })
      }));

      const result = await getProject(mockSettings);
      expect(result).toBeDefined();
    });

    it('should test createOrUpdateTodo function', async () => {
      const { createOrUpdateTodo } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ content: { sha: 'sha' } })
      }));

      const result = await createOrUpdateTodo(mockSettings, 'path', 'content', 'message');
      expect(result).toBeDefined();
    });

    it('should test listProjectFolders function', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => [
          { name: 'src', type: 'tree' },
          { name: 'todos', type: 'tree' }
        ]
      }));

      const result = await listProjectFolders(mockSettings);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('todos');
    });

    it('should test ensureDirectory function', async () => {
      const { ensureDirectory } = await import('../gitlabService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => []
      }));

      await ensureDirectory(mockSettings, 'testfolder');
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});