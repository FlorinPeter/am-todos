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

describe('githubService - Edge Case Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockLogger.error.mockClear();
    mockLogger.log.mockClear();
  });

  describe('createOrUpdateTodo file existence check', () => {
    it('should handle existing file detection when no SHA provided', async () => {
      const { createOrUpdateTodo } = await import('../githubService');
      
      // First call: getFileMetadata succeeds (file exists)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ sha: 'existing-sha', content: 'content' })
        })
        // Second call: createOrUpdateTodo with existing SHA
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            content: { sha: 'updated-sha' },
            commit: { sha: 'commit-sha' }
          })
        });

      const result = await createOrUpdateTodo(
        'token', 
        'owner', 
        'repo', 
        'todos/task.md', 
        'content', 
        'commit message'
        // No SHA provided - should trigger file existence check
      );
      
      expect(result.content.sha).toBe('updated-sha');
      expect(mockLogger.log).toHaveBeenCalledWith('Checking if file already exists...');
      expect(mockLogger.log).toHaveBeenCalledWith('File exists, using existing SHA:', 'existing-sha');
    });

    it('should handle new file creation when file does not exist', async () => {
      const { createOrUpdateTodo } = await import('../githubService');
      
      // First call: getFileMetadata fails (file does not exist)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve('File not found')
        })
        // Second call: createOrUpdateTodo for new file
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ 
            content: { sha: 'new-file-sha' },
            commit: { sha: 'commit-sha' }
          })
        });

      const result = await createOrUpdateTodo(
        'token', 
        'owner', 
        'repo', 
        'todos/new-task.md', 
        'content', 
        'commit message'
        // No SHA provided - should trigger file existence check
      );
      
      expect(result.content.sha).toBe('new-file-sha');
      expect(mockLogger.log).toHaveBeenCalledWith('Checking if file already exists...');
      expect(mockLogger.log).toHaveBeenCalledWith('File does not exist, creating new file');
    });
  });

  describe('ensureDirectory error handling', () => {
    it('should handle directory creation errors gracefully', async () => {
      const { ensureDirectory } = await import('../githubService');
      
      // First call: check if directory exists (fails)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve('Directory not found')
        })
        // Second call: create .gitkeep file (fails)
        .mockResolvedValueOnce({
          ok: false,
          status: 422,
          statusText: 'Unprocessable Entity',
          text: () => Promise.resolve('Failed to create file')
        });

      await expect(ensureDirectory('token', 'owner', 'repo', 'new-folder'))
        .rejects.toThrow('GitHub API proxy error: Unprocessable Entity - Failed to create file');
    });
  });

  describe('getTodos with proper headers mock', () => {
    it('should handle successful response with proper header mocking', async () => {
      const { getTodos } = await import('../githubService');
      
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-ratelimit-remaining', '4999']
        ]),
        json: () => Promise.resolve([
          { name: 'task1.md', type: 'file', path: 'todos/task1.md' },
          { name: 'task2.md', type: 'file', path: 'todos/task2.md' }
        ])
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getTodos('token', 'owner', 'repo', 'todos');
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('task1.md');
    });
  });

  describe('getFileMetadata error scenarios', () => {
    it('should handle metadata fetch failures properly', async () => {
      const { getFileMetadata } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied to file metadata')
      });

      await expect(getFileMetadata('token', 'owner', 'repo', 'protected/file.md'))
        .rejects.toThrow('GitHub API proxy error: Forbidden - Access denied to file metadata');
    });
  });
});