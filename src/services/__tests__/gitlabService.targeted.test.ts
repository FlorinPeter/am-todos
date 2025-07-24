/**
 * Targeted tests for GitLab Service uncovered functions
 * Focus: getFileContent, getFileMetadata, ensureArchiveDirectory, moveTaskToArchive, 
 * moveTaskFromArchive, listProjectFolders filtering
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

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
    clone: () => createMockResponse(options) // Critical: Add clone method for caching
  };
  return mockResponse;
};

import {
  getFileContent,
  getFileMetadata,
  ensureArchiveDirectory,
  moveTaskToArchive,
  moveTaskFromArchive,
  listProjectFolders,
  type GitLabSettings
} from '../gitlabService';

describe('GitLab Service - Targeted Coverage', () => {
  const mockSettings: GitLabSettings = {
    gitProvider: 'gitlab',
    gitlabToken: 'test-token',
    gitlabProjectId: '12345',
    gitlabUrl: 'https://gitlab.com',
    folder: 'todos'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment for backend URL detection
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          port: '3000'
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

  describe('getFileContent', () => {
    it('should successfully fetch file content', async () => {
      const mockContent = 'file content here';
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ({ content: mockContent })
      }));

      const result = await getFileContent(mockSettings, 'test/file.md');

      expect(result).toBe(mockContent);
      expect(mockFetch).toHaveBeenCalledWith('/api/gitlab', expect.objectContaining({
        method: 'POST'
      }));
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      await expect(
        getFileContent(mockSettings, 'missing/file.md')
      ).rejects.toThrow();
    });
  });

  describe('getFileMetadata', () => {
    it('should successfully fetch and parse file metadata', async () => {
      const mockMetadata = {
        sha: 'abc123',
        content: 'file content',
        path: 'test/file.md',
        name: 'file.md'
      };
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockMetadata)
      }));

      const result = await getFileMetadata(mockSettings, 'test/file.md');

      expect(result).toEqual({
        sha: 'abc123',
        content: 'file content',
        path: 'test/file.md',
        name: 'file.md'
      });
    });

    it('should handle JSON parse errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        text: async () => 'invalid json'
      }));

      await expect(
        getFileMetadata(mockSettings, 'test/file.md')
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }));

      await expect(
        getFileMetadata(mockSettings, 'missing/file.md')
      ).rejects.toThrow();
    });
  });

  describe('ensureArchiveDirectory', () => {
    it('should successfully verify archive directory exists', async () => {
      // Mock getTodos call for archive check
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ([]) // Empty archive list is fine
      }));

      await ensureArchiveDirectory(mockSettings, 'testfolder');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should create archive directory when it does not exist', async () => {
      // Mock getTodos failure (archive doesn't exist)
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: false,
          status: 404,
          text: async () => 'Not Found'
        }))
        // Mock createOrUpdateTodo for .gitkeep creation
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: async () => ({ path: 'testfolder/archive/.gitkeep' })
        }));

      await ensureArchiveDirectory(mockSettings, 'testfolder');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should use default folder when none specified', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => ([])
      }));

      await ensureArchiveDirectory(mockSettings);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('moveTaskToArchive', () => {
    it('should successfully move task to archive', async () => {
      const currentPath = 'todos/task.md';
      const content = '# Test Task';
      const commitMessage = 'Archive task';
      
      mockFetch
        // ensureArchiveDirectory - getTodos check
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ([])
        }))
        // createOrUpdateTodo for archive
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: async () => ({ path: 'todos/archive/task.md' })
        }))
        // deleteFile from original location
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ message: 'File deleted' })
        }));

      const result = await moveTaskToArchive(
        mockSettings,
        currentPath,
        content,
        commitMessage
      );

      expect(result).toBe('todos/archive/task.md');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle custom folder parameter', async () => {
      mockFetch
        // ensureArchiveDirectory - getTodos check
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ([])
        }))
        // createOrUpdateTodo for archive
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: async () => ({ path: 'work/archive/task.md' })
        }))
        // deleteFile from original location
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ message: 'File deleted' })
        }));

      const result = await moveTaskToArchive(
        mockSettings,
        'work/task.md',
        'content',
        'commit',
        'work'
      );

      expect(result).toBe('work/archive/task.md');
    });
  });

  describe('moveTaskFromArchive', () => {
    it('should successfully move task from archive to active', async () => {
      const currentPath = 'todos/archive/task.md';
      const content = '# Test Task';
      const commitMessage = 'Unarchive task';
      
      mockFetch
        // createOrUpdateTodo for active folder
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: async () => ({ path: 'todos/task.md' })
        }))
        // deleteFile from archive location
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ message: 'File deleted' })
        }));

      const result = await moveTaskFromArchive(
        mockSettings,
        currentPath,
        content,
        commitMessage
      );

      expect(result).toBe('todos/task.md');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle custom folder parameter', async () => {
      mockFetch
        // createOrUpdateTodo for active folder
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 201,
          json: async () => ({ path: 'work/task.md' })
        }))
        // deleteFile from archive location
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          json: async () => ({ message: 'File deleted' })
        }));

      const result = await moveTaskFromArchive(
        mockSettings,
        'work/archive/task.md',
        'content',
        'commit',
        'work'
      );

      expect(result).toBe('work/task.md');
    });
  });

  describe('listProjectFolders - filtering logic', () => {
    it('should filter folders based on common patterns', async () => {
      const mockFolders = [
        { name: 'todos', type: 'tree' },
        { name: 'work-todo', type: 'tree' },
        { name: 'personal-tasks', type: 'tree' },
        { name: 'project-management', type: 'tree' },
        { name: 'my-work-items', type: 'tree' },
        { name: 'random-folder', type: 'tree' },
        { name: 'some-file.md', type: 'blob' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);

      // Should include folders with keywords and valid names
      expect(result).toContain('todos');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should add default todos folder when no matches found', async () => {
      const mockFolders = [
        { name: 'random-folder', type: 'tree' },
        { name: 'another-folder', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);

      // Should include 'todos' as default when no project folders found
      expect(result).toContain('todos');
    });

    it('should handle valid folder name pattern matching', async () => {
      const mockFolders = [
        { name: 'validFolder123', type: 'tree' },
        { name: 'valid_folder_name', type: 'tree' },
        { name: '123invalid', type: 'tree' }, // Should not match pattern
        { name: 'invalid.folder', type: 'tree' } // Should not match pattern
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);

      // Should match valid patterns and include default
      expect(result).toContain('todos');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should remove duplicates from folder list', async () => {
      const mockFolders = [
        { name: 'todos', type: 'tree' },
        { name: 'work-project', type: 'tree' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: async () => mockFolders
      }));

      const result = await listProjectFolders(mockSettings);

      // Should have unique entries (no duplicates)
      const uniqueResults = [...new Set(result)];
      expect(result.length).toBe(uniqueResults.length);
    });

    it('should handle API errors and return default', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }));

      const result = await listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });
  });
});