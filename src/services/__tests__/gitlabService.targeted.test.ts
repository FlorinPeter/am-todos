/**
 * GitLab Service Targeted Coverage Tests - Systematic line-by-line testing
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
}) => ({
  ok: options.ok,
  status: options.status || (options.ok ? 200 : 500),
  json: options.json || (async () => ({})),
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

describe('GitLab Service - Targeted Coverage Tests', () => {
  const mockSettings = {
    instanceUrl: 'https://gitlab.com',
    projectId: '12345',
    token: 'test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('listProjectFolders filtering logic', () => {
    it('should filter folders with project pattern (covers line 838)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        { name: 'my-project', type: 'tree' },  // Should match line 838
        { name: 'src', type: 'tree' }         // Should be filtered out
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      expect(result).toContain('my-project');
    });

    it('should filter folders with work pattern (covers line 839)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        { name: 'work-items', type: 'tree' },  // Should match line 839
        { name: 'node_modules', type: 'tree' } // Should be filtered out
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      expect(result).toContain('work-items');
    });

    it('should filter folders with personal pattern (covers line 840)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        { name: 'personal-notes', type: 'tree' }, // Should match line 840
        { name: 'build', type: 'tree' }          // Should be filtered out
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      expect(result).toContain('personal-notes');
    });

    it('should match valid folder name regex pattern (covers line 842)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        { name: 'validFolder123', type: 'tree' }, // Should match regex line 842
        { name: '123invalid', type: 'tree' }      // Should NOT match regex
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      expect(result).toContain('validFolder123');
      expect(result).not.toContain('123invalid');
    });

    it('should add default todos when no project folders found (covers lines 849-850)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      const mockFolders = [
        // Only system folders that will be filtered out
        { name: 'src', type: 'tree' },
        { name: 'node_modules', type: 'tree' },
        { name: '.git', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);
      
      // Should add 'todos' as default when no project folders found (lines 849-850)
      expect(result).toContain('todos');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Comprehensive function coverage', () => {
    it('should test getFileAtCommit function (covers lines 780-790)', async () => {
      const { getFileAtCommit } = await import('../gitlabService');
      
      const mockData = {
        content: 'file content at commit',
        sha: 'commit-sha-456'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockData
      }));

      const result = await getFileAtCommit(mockSettings, 'todos/task.md', 'commit-sha-456');
      expect(result).toEqual(mockData);
    });

    it('should test getProject function (covers lines 793-799)', async () => {
      const { getProject } = await import('../gitlabService');
      
      const mockProject = {
        id: 12345,
        name: 'Test Project',
        path_with_namespace: 'user/test-project'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => mockProject
      }));

      const result = await getProject(mockSettings);
      expect(result).toEqual(mockProject);
    });

    it('should handle listProjectFolders error and return default (covers lines 854-856)', async () => {
      const { listProjectFolders } = await import('../gitlabService');
      
      // Mock fetch to throw error to trigger catch block
      mockFetch.mockRejectedValueOnce(new Error('GitLab API error'));

      const result = await listProjectFolders(mockSettings);
      
      // Should return default ['todos'] when error occurs (lines 854-856)
      expect(result).toEqual(['todos']);
    });

    it('should test createProjectFolder function with valid name (covers lines 860-881)', async () => {
      const { createProjectFolder } = await import('../gitlabService');
      
      // Mock successful creation of .gitkeep files
      mockFetch
        .mockResolvedValueOnce(createMockResponse({  // Main folder .gitkeep
          ok: true,
          json: async () => ({ content: { sha: 'gitkeep-sha' } })
        }))
        .mockResolvedValueOnce(createMockResponse({  // Archive folder .gitkeep
          ok: true,
          json: async () => ({ content: { sha: 'archive-gitkeep-sha' } })
        }));

      await createProjectFolder(mockSettings, 'valid-folder-name');
      
      expect(mockFetch).toHaveBeenCalledTimes(2); // Two .gitkeep files created
    });

    it('should throw error for invalid folder name in createProjectFolder (covers lines 864-866)', async () => {
      const { createProjectFolder } = await import('../gitlabService');
      
      // Test invalid folder name to trigger validation error
      await expect(createProjectFolder(mockSettings, '123invalid-name')).rejects.toThrow(
        'Invalid folder name. Use letters, numbers, underscores, and hyphens only.'
      );
      
      // Should not make any API calls for invalid name
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should test getFileContent function (covers lines 639-645)', async () => {
      const { getFileContent } = await import('../gitlabService');
      
      const mockContent = 'This is the file content';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: async () => ({ content: mockContent })
      }));

      const result = await getFileContent(mockSettings, 'todos/task.md');
      expect(result).toBe(mockContent);
    });

    it('should test getFileMetadata function (covers lines 647-673)', async () => {
      const { getFileMetadata } = await import('../gitlabService');
      
      const mockMetadata = {
        sha: 'file-sha-123',
        content: 'encoded-content',
        path: 'todos/task.md',
        name: 'task.md'
      };

      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockMetadata),
        json: async () => mockMetadata,
        clone: () => mockResponse
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getFileMetadata(mockSettings, 'todos/task.md');
      expect(result).toEqual({
        sha: 'file-sha-123',
        content: 'encoded-content',
        path: 'todos/task.md',
        name: 'task.md'
      });
    });

    it('should test moveTaskToArchive function (covers lines 691-716)', async () => {
      const { moveTaskToArchive } = await import('../gitlabService');
      
      // Mock successful archive directory check, file creation, and deletion
      mockFetch
        .mockResolvedValueOnce(createMockResponse({  // Check archive exists
          ok: true,
          json: async () => []
        }))
        .mockResolvedValueOnce(createMockResponse({  // Create archived file
          ok: true,
          json: async () => ({ content: { sha: 'archived-sha' } })
        }))
        .mockResolvedValueOnce(createMockResponse({  // Delete original file
          ok: true,
          json: async () => ({ commit: { sha: 'delete-sha' } })
        }));

      const result = await moveTaskToArchive(
        mockSettings,
        'todos/task.md',
        'Task content',
        'Archive completed task',
        'todos'
      );
      
      expect(result).toBe('todos/archive/task.md');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should test moveTaskFromArchive function (covers lines 718-740)', async () => {
      const { moveTaskFromArchive } = await import('../gitlabService');
      
      // Mock successful file creation and deletion
      mockFetch
        .mockResolvedValueOnce(createMockResponse({  // Create unarchived file
          ok: true,
          json: async () => ({ content: { sha: 'unarchived-sha' } })
        }))
        .mockResolvedValueOnce(createMockResponse({  // Delete archived file
          ok: true,
          json: async () => ({ commit: { sha: 'delete-archive-sha' } })
        }));

      const result = await moveTaskFromArchive(
        mockSettings,
        'todos/archive/task.md',
        'Task content',
        'Unarchive task',
        'todos'
      );
      
      expect(result).toBe('todos/task.md');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

  });
});