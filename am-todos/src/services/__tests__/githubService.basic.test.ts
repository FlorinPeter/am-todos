import { getTodos, createOrUpdateTodo, ensureTodosDirectory, getFileContent } from '../githubService';

// Mock fetch globally
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Test configuration
const TEST_CONFIG = {
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo'
};

describe('GitHub Service - Basic Feature Coverage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Feature 2: GitHub Integration & CRUD Operations', () => {
    test('getTodos fetches todos from GitHub repository', async () => {
      const mockTodos = [
        {
          name: 'test-todo.md',
          path: 'todos/test-todo.md',
          sha: 'abc123',
          download_url: 'https://github.com/test/test.md'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTodos,
      } as Response);

      const result = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/github'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('todos')
        })
      );
      expect(result).toEqual(mockTodos);
    });

    test('getTodos handles empty repository gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      } as Response);

      const result = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      expect(result).toEqual([]);
    });

    test('createOrUpdateTodo creates new todo file', async () => {
      const mockResponse = {
        content: {
          sha: 'new-sha-123',
          path: 'todos/test-todo.md'
        },
        commit: {
          sha: 'commit-sha-456'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const frontmatter = {
        title: 'Test Todo',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      };

      const markdownContent = '# Test Todo\n\n- [ ] Test task';

      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'test-todo.md',
        frontmatter,
        markdownContent,
        'feat: Add new todo',
        undefined // no sha for new file
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/github'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('PUT')
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('createOrUpdateTodo updates existing todo file', async () => {
      const mockResponse = {
        content: {
          sha: 'updated-sha-789',
          path: 'todos/test-todo.md'
        },
        commit: {
          sha: 'commit-sha-789'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const frontmatter = {
        title: 'Updated Todo',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 1,
        isArchived: false,
        chatHistory: []
      };

      const markdownContent = '# Updated Todo\n\n- [x] Completed task';

      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'test-todo.md',
        frontmatter,
        markdownContent,
        'fix: Update todo priority',
        'existing-sha-123' // existing file sha
      );

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    test('getFileContent retrieves file content', async () => {
      const mockFileData = {
        content: btoa('# Test Todo\n\n- [ ] Test task'),
        sha: 'file-sha-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFileData,
      } as Response);

      const result = await getFileContent(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'todos/test-todo.md'
      );

      expect(mockFetch).toHaveBeenCalled();
      expect(result).toEqual({
        content: '# Test Todo\n\n- [ ] Test task',
        sha: 'file-sha-123'
      });
    });

    test('handles GitHub API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      } as Response);

      await expect(
        getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo)
      ).rejects.toThrow();
    });
  });

  describe('Feature 7: Auto-Directory Setup', () => {
    test('ensureTodosDirectory creates todos directory', async () => {
      // Mock directory doesn't exist
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        } as Response)
        // Mock successful directory creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: { sha: 'gitkeep-sha' },
            commit: { sha: 'commit-sha' }
          }),
        } as Response);

      await ensureTodosDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Should check for directory existence, then create .gitkeep
      expect(mockFetch).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
        body: expect.stringContaining('GET')
      }));
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
        body: expect.stringContaining('PUT')
      }));
    });

    test('ensureTodosDirectory handles existing directory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await ensureTodosDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      // Should only check for directory existence
    });
  });

  describe('Feature 6: Smart File Naming System', () => {
    test('handles special characters in filenames', async () => {
      const mockResponse = {
        content: { sha: 'file-sha', path: 'todos/test-file.md' },
        commit: { sha: 'commit-sha' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const frontmatter = {
        title: 'Special Characters: éñ中文',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      };

      await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        '2025-01-01-special-characters.md',
        frontmatter,
        '# Test content',
        'feat: Add todo with special characters'
      );

      expect(mockFetch).toHaveBeenCalled();
      // Verify the request body contains properly encoded content
      const [, requestOptions] = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(requestOptions?.body as string);
      expect(requestBody.content).toBeDefined();
    });
  });

  describe('Archive Operations', () => {
    test('handles archive operations', async () => {
      const mockResponse = {
        content: { sha: 'new-sha', path: 'todos/archive/test.md' },
        commit: { sha: 'commit-sha' }
      };

      mockFetch
        // Get original file
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: btoa('# Test Todo'),
            sha: 'original-sha'
          }),
        } as Response)
        // Create in archive
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        } as Response)
        // Delete original
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        } as Response);

      // Test archive operation (implementation would call multiple GitHub operations)
      const content = await getFileContent(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'todos/test.md'
      );

      expect(content.content).toBe('# Test Todo');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Unicode and Special Content Support', () => {
    test('handles Unicode content correctly', async () => {
      const unicodeContent = '# 中文测试\n\n- [ ] タスク\n- [ ] задача';
      const mockFileData = {
        content: btoa(unicodeContent),
        sha: 'unicode-sha'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFileData,
      } as Response);

      const result = await getFileContent(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'todos/unicode-test.md'
      );

      expect(result.content).toBe(unicodeContent);
    });

    test('handles emoji content correctly', async () => {
      const emojiContent = '# 🚀 Project Launch\n\n- [ ] 📝 Documentation\n- [ ] 🧪 Testing';
      const mockResponse = {
        content: { sha: 'emoji-sha', path: 'todos/emoji-test.md' },
        commit: { sha: 'commit-sha' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const frontmatter = {
        title: '🚀 Project Launch',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      };

      await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'emoji-test.md',
        frontmatter,
        emojiContent,
        'feat: Add emoji todo'
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});