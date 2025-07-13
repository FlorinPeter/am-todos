import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
const mockLogger = {
  error: vi.fn(),
  log: vi.fn(),
};
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

describe('githubService - Targeted Reachable Lines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockLogger.error.mockClear();
    mockLogger.log.mockClear();
  });

  describe('Target line 165: includeArchived ternary in getTodos', () => {
    it('should use archive path when includeArchived=true', async () => {
      const { getTodos } = await import('../githubService');
      
      const mockHeaders = new Map([
        ['content-type', 'application/json']
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeaders,
        json: () => Promise.resolve([
          { name: 'archived-task.md', type: 'file', path: 'todos/archive/archived-task.md' }
        ])
      });

      const result = await getTodos('token', 'owner', 'repo', 'todos', true);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('archived-task.md');
      
      // Verify the correct archive API path was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/github'),
        expect.objectContaining({
          body: expect.stringContaining('todos/archive')
        })
      );
    });
  });

  describe('Target successful getTodos flows', () => {
    it('should handle successful getTodos with filtering', async () => {
      const { getTodos } = await import('../githubService');
      
      const mockHeaders = new Map([
        ['content-type', 'application/json']
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeaders,
        json: () => Promise.resolve([
          { name: 'task1.md', type: 'file', path: 'todos/task1.md' },
          { name: '.gitkeep', type: 'file', path: 'todos/.gitkeep' },
          { name: 'task2.md', type: 'file', path: 'todos/task2.md' },
          { name: 'not-markdown.txt', type: 'file', path: 'todos/not-markdown.txt' }
        ])
      });

      const result = await getTodos('token', 'owner', 'repo', 'todos');
      
      // Should filter out .gitkeep and non-markdown files
      expect(result).toHaveLength(2);
      expect(result.map(f => f.name)).toEqual(['task1.md', 'task2.md']);
    });
  });

  describe('Target lines 450-453, 457-459: listProjectFolders filtering', () => {
    it('should include folders with keyword patterns', async () => {
      const { listProjectFolders } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          { name: 'work-tasks', type: 'dir' },      // Should match work pattern
          { name: 'personal-notes', type: 'dir' },  // Should match personal pattern
          { name: 'project-alpha', type: 'dir' },   // Should match project pattern
          { name: 'tasks-daily', type: 'dir' },     // Should match task pattern
          { name: 'other-folder', type: 'dir' },    // Should match regex pattern
        ])
      });

      const result = await listProjectFolders('token', 'owner', 'repo');
      
      // Should include folders matching patterns  
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal-notes'); 
      expect(result).toContain('project-alpha');
      expect(result).toContain('tasks-daily');
      expect(result).toContain('other-folder');
      
      // Should always include 'todos' default (line 457-459)
      expect(result).toContain('todos');
      expect(result[0]).toBe('todos'); // Should be first (unshift)
    });

    it('should not duplicate todos if already present', async () => {
      const { listProjectFolders } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          { name: 'todos', type: 'dir' },           // Already present
          { name: 'work-items', type: 'dir' },
        ])
      });

      const result = await listProjectFolders('token', 'owner', 'repo');
      
      // Should not duplicate todos
      const todosCount = result.filter(folder => folder === 'todos').length;
      expect(todosCount).toBe(1);
    });
  });

  describe('Target lines 475-477: createProjectFolder validation', () => {
    it('should throw error for invalid folder names', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      // Test empty name
      await expect(createProjectFolder('token', 'owner', 'repo', ''))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
      
      // Test name starting with number
      await expect(createProjectFolder('token', 'owner', 'repo', '123-invalid'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
      
      // Test name with special characters
      await expect(createProjectFolder('token', 'owner', 'repo', 'invalid@name'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
      
      // Test name starting with dot
      await expect(createProjectFolder('token', 'owner', 'repo', '.hidden'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

  });
});