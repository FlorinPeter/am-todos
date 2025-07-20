import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchTodos, searchTodosDebounced, filterTodosLocally } from '../searchService';
import * as localStorage from '../../utils/localStorage';

// Mock the localStorage module
vi.mock('../../utils/localStorage', () => ({
  loadSettings: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn();

describe('Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchTodos', () => {
    it('should return empty results for empty query', async () => {
      const result = await searchTodos('');
      expect(result).toEqual({
        query: '',
        scope: 'folder',
        total_count: 0,
        items: []
      });
    });

    it('should return empty results for whitespace-only query', async () => {
      const result = await searchTodos('   ');
      expect(result).toEqual({
        query: '',
        scope: 'folder',
        total_count: 0,
        items: []
      });
    });

    it('should throw error when no settings are configured', async () => {
      vi.mocked(localStorage.loadSettings).mockReturnValue(null);

      await expect(searchTodos('test')).rejects.toThrow(
        'No settings configured. Please configure your Git settings first.'
      );
    });

    it('should handle dual-config GitHub settings', async () => {
      const mockSettings = {
        gitProvider: 'github',
        folder: 'tasks',
        github: {
          pat: 'github-token',
          owner: 'github-owner',
          repo: 'github-repo'
        }
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: 'test',
          scope: 'folder',
          total_count: 0,
          items: []
        })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await searchTodos('test', 'folder');

      expect(fetch).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          scope: 'folder',
          folder: 'tasks',
          provider: 'github',
          owner: 'github-owner',
          repo: 'github-repo',
          token: 'github-token'
        })
      });
    });

    it('should handle dual-config GitLab settings', async () => {
      const mockSettings = {
        gitProvider: 'gitlab',
        folder: 'work',
        gitlab: {
          token: 'gitlab-token',
          instanceUrl: 'https://gitlab.work.com',
          projectId: '456'
        }
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: 'test',
          scope: 'repo',
          total_count: 0,
          items: []
        })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await searchTodos('test', 'repo');

      expect(fetch).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          scope: 'repo',
          folder: 'work',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.work.com',
          projectId: '456',
          token: 'gitlab-token'
        })
      });
    });

    it('should throw error for incomplete dual-config GitHub settings', async () => {
      const mockSettings = {
        gitProvider: 'github',
        github: {
          pat: 'token',
          owner: 'owner'
          // missing repo
        }
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      await expect(searchTodos('test')).rejects.toThrow(
        'GitHub settings incomplete. Please configure your Personal Access Token, owner, and repository.'
      );
    });

    it('should throw error for incomplete dual-config GitLab settings', async () => {
      const mockSettings = {
        gitProvider: 'gitlab',
        gitlab: {
          token: 'token',
          instanceUrl: 'https://gitlab.com'
          // missing projectId
        }
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      await expect(searchTodos('test')).rejects.toThrow(
        'GitLab settings incomplete. Please configure your Access Token, instance URL, and project ID.'
      );
    });

    it('should throw error for incomplete legacy GitHub settings', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner'
        // missing repo
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      await expect(searchTodos('test')).rejects.toThrow(
        'GitHub settings incomplete. Please configure your Personal Access Token, owner, and repository.'
      );
    });

    it('should throw error for incomplete legacy GitLab settings', async () => {
      const mockSettings = {
        gitProvider: 'gitlab',
        token: 'token',
        instanceUrl: 'https://gitlab.com'
        // missing projectId
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      await expect(searchTodos('test')).rejects.toThrow(
        'GitLab settings incomplete. Please configure your Access Token, instance URL, and project ID.'
      );
    });

    it('should throw error for invalid git provider', async () => {
      const mockSettings = {
        gitProvider: 'invalid'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      await expect(searchTodos('test')).rejects.toThrow(
        'Invalid Git provider configured. Please select GitHub or GitLab.'
      );
    });

    it('should make GitHub search request with correct parameters', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token', // GitHub uses 'pat' field
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: 'test',
          scope: 'folder',
          total_count: 1,
          items: [{
            path: 'todos/test.md',
            name: 'test.md',
            sha: 'abc123',
            url: 'https://github.com/test-owner/test-repo/blob/main/todos/test.md',
            repository: 'test-owner/test-repo',
            text_matches: []
          }]
        })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const result = await searchTodos('test', 'folder');

      expect(fetch).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'github',
          owner: 'test-owner',
          repo: 'test-repo',
          token: 'test-token'
        })
      });

      expect(result.total_count).toBe(1);
      expect(result.items).toHaveLength(1);
    });

    it('should handle GitLab settings correctly', async () => {
      const mockSettings = {
        gitProvider: 'gitlab',
        token: 'test-token', // GitLab uses 'token' field
        instanceUrl: 'https://gitlab.example.com',
        projectId: '123',
        folder: 'tasks'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: 'test',
          scope: 'repo',
          total_count: 0,
          items: []
        })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await searchTodos('test', 'repo');

      expect(fetch).toHaveBeenCalledWith('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'test',
          scope: 'repo',
          folder: 'tasks',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.example.com',
          projectId: '123',
          token: 'test-token'
        })
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token', // GitHub uses 'pat' field
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: vi.fn().mockResolvedValue('{"error":"GitHub search API rate limit exceeded. Please try again in a few minutes."}')
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(searchTodos('test')).rejects.toThrow(
        'GitHub search API rate limit exceeded. Please try again in a few minutes.'
      );
    });

    it('should handle 401 authentication errors', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('{"error":"Authentication failed. Please check your access token in settings."}')
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(searchTodos('test')).rejects.toThrow(
        'Authentication failed. Please check your access token in settings.'
      );
    });

    it('should handle 403 permission errors', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: vi.fn().mockResolvedValue('{"error":"Access denied. Please check your repository permissions."}')
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(searchTodos('test')).rejects.toThrow(
        'Access denied. Please check your repository permissions.'
      );
    });

    it('should handle 400 bad request errors', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('{"error":"Invalid search query. Please check your search terms."}')
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(searchTodos('test')).rejects.toThrow(
        'Invalid search query. Please check your search terms.'
      );
    });

    it('should handle other HTTP error status codes', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('{"error":"Search API error: Internal Server Error"}')
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      await expect(searchTodos('test')).rejects.toThrow(
        'Search API error: Internal Server Error'
      );
    });

    it('should handle network errors', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token', // GitHub uses 'pat' field
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(searchTodos('test')).rejects.toThrow(
        'Network error: Unable to connect to search service. Please check if the backend server is running.'
      );
    });
  });

  describe('searchTodosDebounced', () => {
    it('should call callback with empty results for empty query', () => {
      return new Promise<void>((resolve) => {
        searchTodosDebounced('', 'folder', (results, error) => {
          expect(error).toBeNull();
          expect(results).toEqual({
            query: '',
            scope: 'folder',
            total_count: 0,
            items: []
          });
          resolve();
        });
      });
    });

    it('should debounce multiple rapid calls', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token', // GitHub uses 'pat' field
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          query: 'test3',
          scope: 'folder',
          total_count: 0,
          items: []
        })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      let callbackCount = 0;
      const callback = (results: any, error: any) => {
        callbackCount++;
        expect(results?.query).toBe('test3');
      };

      // Make multiple rapid calls
      searchTodosDebounced('test1', 'folder', callback, 50);
      searchTodosDebounced('test2', 'folder', callback, 50);
      searchTodosDebounced('test3', 'folder', callback, 50);

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only call the API once with the last query
      expect(callbackCount).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in debounced search', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      // Mock fetch to reject
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      return new Promise<void>((resolve) => {
        searchTodosDebounced('test', 'folder', (results, error) => {
          expect(results).toBeNull();
          expect(error).toBe('Network error');
          resolve();
        }, 10); // Short delay for faster test
      });
    });

    it('should handle non-Error objects in debounced search catch', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);
      
      // Mock fetch to reject with non-Error object
      vi.mocked(fetch).mockRejectedValue('String error');

      return new Promise<void>((resolve) => {
        searchTodosDebounced('test', 'folder', (results, error) => {
          expect(results).toBeNull();
          expect(error).toBe('Unknown search error');
          resolve();
        }, 10); // Short delay for faster test
      });
    });
  });

  describe('filterTodosLocally', () => {
    const mockTodos = [
      {
        id: '1',
        title: 'Task 1',
        content: 'This is a test task',
        frontmatter: { title: 'Task 1' }
      },
      {
        id: '2',
        title: 'Task 2',
        content: 'Another important item',
        frontmatter: { title: 'Task 2' }
      },
      {
        id: '3',
        title: 'Important work',
        content: 'Some content here',
        frontmatter: { title: 'Important work' }
      }
    ];

    it('should return all todos for empty query', () => {
      const result = filterTodosLocally(mockTodos, '');
      expect(result).toEqual(mockTodos);
    });

    it('should filter by title', () => {
      const result = filterTodosLocally(mockTodos, 'Important');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('3');
    });

    it('should filter by content', () => {
      const result = filterTodosLocally(mockTodos, 'test');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should be case insensitive', () => {
      const result = filterTodosLocally(mockTodos, 'TASK');
      expect(result).toHaveLength(2);
    });

    it('should handle whitespace-only queries', () => {
      const result = filterTodosLocally(mockTodos, '   ');
      expect(result).toEqual(mockTodos);
    });
  });
});