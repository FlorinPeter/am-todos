/**
 * GitLab Service Aggressive Coverage Tests - Push over 80%
 * Targeting remaining uncovered lines: 631-633, 682-688
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create proper Response mock objects
const createMockResponse = (options: {
  ok: boolean;
  status?: number;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
}) => ({
  ok: options.ok,
  status: options.status || (options.ok ? 200 : 500),
  json: options.json || (async () => ({})),
  text: options.text || (async () => ''),
  clone: () => createMockResponse(options)
});

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../utils/rateLimitHandler', () => ({
  parseRateLimitError: vi.fn(() => ({ isRateLimited: false })),
  showRateLimitNotification: vi.fn()
}));

vi.mock('../../utils/filenameMetadata', () => ({
  parseFilenameMetadata: vi.fn(() => null),
  parseLegacyFilenameMetadata: vi.fn(() => null),
  generateFilename: vi.fn(() => 'test-file.md'),
  isNewFormatFilename: vi.fn(() => false)
}));

vi.mock('../../utils/markdown', () => ({
  parseMarkdownWithMetadata: vi.fn((content: string) => ({
    title: 'Test Title',
    frontmatter: { tags: [] },
    priority: 3,
    createdAt: '2023-01-01T00:00:00.000Z'
  })),
  stringifyMarkdownWithMetadata: vi.fn((frontmatter: any, content: string) => 
    `---\ntags: []\n---\n${content}`
  )
}));

describe('GitLab Service Aggressive Coverage', () => {
  const mockSettings = {
    instanceUrl: 'https://gitlab.com',
    projectId: '12345',
    token: 'test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockFetch.mockReset();
  });

  describe('Complete function coverage', () => {
    it('should fully cover ensureArchiveDirectory error path (lines 682-688)', async () => {
      const { ensureArchiveDirectory } = await import('../gitlabService');
      
      // Mock getTodos to fail (triggers catch block)
      // Then mock createOrUpdateTodo to succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Directory not found'))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          json: async () => ({ content: { sha: 'sha' } })
        }));

      await ensureArchiveDirectory(mockSettings, 'test-folder');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should cover getTodos retry failure path (lines 631-633)', async () => {
      const { getTodos } = await import('../gitlabService');
      
      // Both original and retry fail to cover lines 631-633
      mockFetch
        .mockRejectedValueOnce(new TypeError('Network failure'))
        .mockRejectedValueOnce(new TypeError('Retry failed'));

      const result = await getTodos(mockSettings, 'todos', false);
      expect(result).toEqual([]);
    });

    it('should cover additional archive operations', async () => {
      const { moveTaskToArchive, moveTaskFromArchive } = await import('../gitlabService');
      
      // Mock for moveTaskToArchive: check archive exists, create file, delete original
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => [] }))  // ensureArchiveDirectory
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'archived' }) }))  // create
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'deleted' }) }));  // delete

      const archivePath = await moveTaskToArchive(
        mockSettings, 'todos/task.md', 'content', 'Archive task', 'todos'
      );
      expect(archivePath).toBe('todos/archive/task.md');

      // Reset mocks for moveTaskFromArchive
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'unarchived' }) }))  // create
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'deleted' }) }));  // delete

      const activePath = await moveTaskFromArchive(
        mockSettings, 'todos/archive/task.md', 'content', 'Unarchive task', 'todos'
      );
      expect(activePath).toBe('todos/task.md');
    });

    it('should cover createProjectFolder validation and creation', async () => {
      const { createProjectFolder } = await import('../gitlabService');
      
      // Test valid folder creation
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'main-gitkeep' }) }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, json: async () => ({ sha: 'archive-gitkeep' }) }));

      await createProjectFolder(mockSettings, 'validFolder');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Test invalid folder validation
      await expect(createProjectFolder(mockSettings, '123invalid')).rejects.toThrow();
    });

    it('should cover file content and metadata operations', async () => {
      const { getFileContent, getFileMetadata } = await import('../gitlabService');
      
      // Test getFileContent
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ content: 'file content' })
      }));

      const content = await getFileContent(mockSettings, 'todos/task.md');
      expect(content).toBe('file content');

      // Test getFileMetadata successful case
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sha: 'sha', content: 'content', path: 'path', name: 'name' }),
        json: async () => ({}),
        clone: () => mockResponse
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const metadata = await getFileMetadata(mockSettings, 'todos/task.md');
      expect(metadata.sha).toBe('sha');
    });

    it('should cover getFileMetadata JSON parse error (lines 660-663)', async () => {
      const { getFileMetadata } = await import('../gitlabService');
      
      // Test getFileMetadata with invalid JSON to trigger parse error
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'invalid json response',  // This will cause JSON.parse to fail
        json: async () => ({}),
        clone: () => mockResponse
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      await expect(getFileMetadata(mockSettings, 'todos/task.md')).rejects.toThrow(
        'Failed to parse GitLab API response'
      );
    });

    it('should cover listProjectFolders comprehensive scenarios', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      // Test with various folder types including edge cases
      const mockFolders = [
        { name: 'project-tasks', type: 'tree' },
        { name: 'work-items', type: 'tree' },
        { name: 'personal-notes', type: 'tree' },
        { name: 'validFolder123', type: 'tree' },
        { name: 'src', type: 'tree' },  // Should be filtered out
        { name: 'build', type: 'tree' }  // Should be filtered out
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      expect(result).toContain('project-tasks');
      expect(result).toContain('work-items');
      expect(result).toContain('personal-notes');
      expect(result).toContain('validFolder123');
      expect(result).not.toContain('src');
      expect(result).not.toContain('build');
    });

    it('should cover complete file operations pipeline', async () => {
      const { createTodo, deleteFile, getFileHistory, getFileAtCommit, getProject } = await import('../gitlabService');
      
      // createTodo
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ content: { sha: 'new-todo' } })
      }));

      await createTodo(mockSettings, 'New Task', 'Content', 1, 'work');
      
      // deleteFile
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ commit: { sha: 'delete-commit' } })
      }));

      await deleteFile(mockSettings, 'work/task.md', 'Delete task');

      // getFileHistory
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => [{ sha: 'commit1', message: 'First' }]
      }));

      const history = await getFileHistory(mockSettings, 'work/task.md');
      expect(Array.isArray(history)).toBe(true);

      // getFileAtCommit
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ content: 'content at commit', sha: 'commit-sha' })
      }));

      const fileAtCommit = await getFileAtCommit(mockSettings, 'work/task.md', 'commit-sha');
      expect(fileAtCommit.sha).toBe('commit-sha');

      // getProject
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ id: 123, name: 'Project' })
      }));

      const project = await getProject(mockSettings);
      expect(project.id).toBe(123);
    });
  });
});