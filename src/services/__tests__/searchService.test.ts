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

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
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
        }),
        signal: expect.any(AbortSignal)
      }));
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

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
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
        }),
        signal: expect.any(AbortSignal)
      }));
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

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
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
        }),
        signal: expect.any(AbortSignal)
      }));

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

      expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
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
        }),
        signal: expect.any(AbortSignal)
      }));
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

    it('should handle invalid queries and return all todos (lines 247-249)', async () => {
      // Import the redos protection module and spy on it  
      const redosProtection = await import('../../utils/redosProtection');
      const validateSpy = vi.spyOn(redosProtection, 'validateAndSanitizeSearchQuery')
        .mockReturnValue({
          isValid: false,
          error: 'Query contains malicious patterns'
        });
      
      const result = filterTodosLocally(mockTodos, 'SELECT * FROM users');
      
      // Should return all todos when query is invalid
      expect(result).toEqual(mockTodos);
      expect(validateSpy).toHaveBeenCalledWith('SELECT * FROM users');
      
      // Restore the spy
      validateSpy.mockRestore();
    });

    it('should handle errors during todo filtering (lines 260-262)', () => {
      // Create a problematic todo that will cause an error during filtering
      const problematicTodos = [
        {
          id: '1',
          title: 'Normal task',
          content: 'Normal content'
        },
        {
          id: '2',
          // Create a getter that throws an error
          get title() { throw new Error('Title access error'); },
          content: 'Some content'
        },
        {
          id: '3',
          title: 'Another task',
          // Create a getter that throws an error  
          get content() { throw new Error('Content access error'); }
        }
      ];

      const result = filterTodosLocally(problematicTodos, 'task');
      
      // Should only return todos that don't throw errors during filtering
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('Error Response Handling Coverage (lines 172-175, 178-179)', () => {
    it('should handle non-JSON error response text (lines 172-175)', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      // Mock a failed response with plain text (not JSON)
      const mockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: vi.fn().mockResolvedValue('Validation failed: Invalid query syntax'),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // Should use raw text when JSON parsing fails (lines 172-175)
      await expect(searchTodos('invalid[query')).rejects.toThrow('Validation failed: Invalid query syntax');
      
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should handle error when reading response fails (lines 178-179)', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      // Mock a failed response where reading response throws an error
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockRejectedValue(new Error('Network error reading response')),
        json: vi.fn().mockRejectedValue(new Error('Cannot read response'))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // Should use default error message when response reading fails (lines 178-179)
      await expect(searchTodos('test')).rejects.toThrow('Search API error: Internal Server Error');
      
      expect(mockResponse.text).toHaveBeenCalled();
    });

    it('should handle empty response text with JSON parsing failure (line 174)', async () => {
      const mockSettings = {
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      // Mock a failed response with empty text and JSON parsing failure
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(''), // Empty response text
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      // Should fall back to default error message when text is empty (line 174 condition)
      await expect(searchTodos('test')).rejects.toThrow('Search API error: Bad Request');
    });
  });

  // === Coverage Improvement: Lines 119-120 ===
  describe('Search Query Validation Coverage (lines 119-120)', () => {
    it('should throw error for invalid search query (lines 119-120)', async () => {
      const mockSettings = {
        gitProvider: 'github' as const,
        pat: 'test-token',
        owner: 'test-owner',  
        repo: 'test-repo',
        folder: 'todos'
      };

      vi.mocked(localStorage.loadSettings).mockReturnValue(mockSettings);

      // Create a search query that will be considered invalid by ReDoS protection
      const invalidQuery = '*'.repeat(1000); // Extremely long pattern that should be invalid

      await expect(searchTodos(invalidQuery)).rejects.toThrow(/Invalid search query/);
    });
  });
});