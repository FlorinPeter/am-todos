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

describe('githubService - Complete Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockLogger.error.mockClear();
    mockLogger.log.mockClear();
  });

  describe('deleteFile edge cases', () => {
    it('should handle delete file success path', async () => {
      const { deleteFile } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ sha: 'new-sha' })
      });

      const result = await deleteFile('token', 'owner', 'repo', 'test.md', 'sha123');
      
      expect(result).toEqual({ sha: 'new-sha' });
      expect(mockLogger.log).toHaveBeenCalledWith('Deleting file via proxy:', expect.any(String));
      expect(mockLogger.log).toHaveBeenCalledWith('File deleted successfully:', 'test.md');
    });

    it('should handle API error with text response', async () => {
      const { deleteFile } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: () => Promise.resolve('Validation failed: file does not exist')
      });

      await expect(deleteFile('token', 'owner', 'repo', 'test.md', 'sha123'))
        .rejects.toThrow('GitHub API proxy error: Unprocessable Entity - Validation failed: file does not exist');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Proxy error:', 'Validation failed: file does not exist');
    });
  });

  describe('listProjectFolders edge cases', () => {
    it('should handle successful folder listing with filtering', async () => {
      const { listProjectFolders } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          { name: 'todos', type: 'dir' },
          { name: 'tasks', type: 'dir' },
          { name: 'docs', type: 'dir' },
          { name: 'README.md', type: 'file' },
          { name: '.git', type: 'dir' },
          { name: 'node_modules', type: 'dir' }
        ])
      });

      const result = await listProjectFolders('token', 'owner', 'repo');
      
      // Should include directory names but filter appropriately
      expect(result).toEqual(expect.arrayContaining(['todos', 'tasks', 'docs']));
      expect(result).not.toContain('README.md'); // Should exclude files
    });

    it('should return default fallback on API failure', async () => {
      const { listProjectFolders } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied')
      });

      const result = await listProjectFolders('token', 'owner', 'repo');
      
      expect(result).toEqual(['todos']);
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing project folders:', expect.any(Error));
    });
  });

  describe('getFileContent edge cases', () => {
    it('should handle file retrieval success', async () => {
      const { getFileContent } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('# Test Content\n\nHello world')
      });

      const result = await getFileContent('token', 'owner', 'repo', 'test.md');
      
      expect(result).toBe('# Test Content\n\nHello world');
    });

    it('should handle file not found errors', async () => {
      const { getFileContent } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found')
      });

      await expect(getFileContent('token', 'owner', 'repo', 'nonexistent.md'))
        .rejects.toThrow('GitHub API proxy error: Not Found - File not found');
    });
  });

  describe('createOrUpdateTodo edge cases', () => {
    it('should handle todo creation with proper parameters', async () => {
      const { createOrUpdateTodo } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ 
          content: { sha: 'new-todo-sha' },
          commit: { sha: 'commit-sha' }
        })
      });

      const result = await createOrUpdateTodo(
        'token', 
        'owner', 
        'repo', 
        'todos/new-task.md', 
        'Task content', 
        'Add new task',
        'todos'
      );
      
      expect(result.content.sha).toBe('new-todo-sha');
    });
  });
});