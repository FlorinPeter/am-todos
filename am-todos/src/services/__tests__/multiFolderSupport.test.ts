import { 
  getTodos,
  createOrUpdateTodo,
  ensureDirectory,
  ensureArchiveDirectory,
  listProjectFolders,
  createProjectFolder,
  moveTaskToArchive,
  moveTaskFromArchive,
  getFileMetadata
} from '../githubService';

// Mock TextEncoder for Node.js test environment
global.TextEncoder = require('util').TextEncoder;
global.btoa = (str: string) => Buffer.from(str).toString('base64');

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Test configuration
const TEST_CONFIG = {
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo'
};

describe('Multi-Folder Support', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Dynamic Folder Operations', () => {
    test('getTodos works with custom folder', async () => {
      const mockTodos = [
        {
          name: 'work-task.md',
          path: 'work-tasks/work-task.md',
          sha: 'abc123',
          download_url: 'https://github.com/test/work-task.md',
          type: 'file'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTodos,
        headers: new Headers(),
        text: async () => JSON.stringify(mockTodos)
      } as Response);

      const result = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'work-tasks', false);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/github'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('work-tasks')
        })
      );
      expect(result).toEqual(mockTodos);
    });

    test('getTodos fetches archived tasks from custom folder', async () => {
      const mockArchivedTodos = [
        {
          name: 'completed-work.md',
          path: 'work-tasks/archive/completed-work.md',
          sha: 'def456',
          download_url: 'https://github.com/test/completed-work.md',
          type: 'file'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockArchivedTodos,
        headers: new Headers(),
        text: async () => JSON.stringify(mockArchivedTodos)
      } as Response);

      const result = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'work-tasks', true);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/github'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('work-tasks/archive')
        })
      );
      expect(result).toEqual(mockArchivedTodos);
    });

    test('ensureDirectory creates custom folder', async () => {
      // Mock directory doesn't exist
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Mock successful directory creation
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'gitkeep-sha' },
            commit: { sha: 'commit-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response);

      await ensureDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'personal-tasks');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify the request body contains the custom folder
      const calls = mockFetch.mock.calls;
      const secondCall = calls[1];
      const requestBody = JSON.parse(secondCall[1]?.body as string);
      expect(requestBody.body.message).toContain('personal-tasks');
    });

    test('ensureArchiveDirectory creates archive for custom folder', async () => {
      // Mock directory doesn't exist
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Mock successful directory creation
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'archive-sha' },
            commit: { sha: 'commit-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response);

      await ensureArchiveDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'client-alpha');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Verify the request body contains the custom folder archive
      const calls = mockFetch.mock.calls;
      const secondCall = calls[1];
      const requestBody = JSON.parse(secondCall[1]?.body as string);
      expect(requestBody.body.message).toContain('client-alpha/archive');
    });
  });

  describe('Archive Operations with Custom Folders', () => {
    test('moveTaskToArchive works with custom folder', async () => {
      const testContent = '# Work Task\n\n- [x] Complete project';
      const mockFileData = {
        content: btoa(testContent),
        sha: 'original-sha',
        path: 'work-tasks/work-task.md',
        name: 'work-task.md'
      };

      mockFetch
        // Get original file metadata
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFileData,
          headers: new Headers(),
          text: async () => JSON.stringify(mockFileData)
        } as Response)
        // Check if archive directory exists
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
          headers: new Headers(),
          text: async () => '[]'
        } as Response)
        // Check if archived file exists (for createOrUpdateTodo)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create file in archive
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'archive-sha', path: 'work-tasks/archive/work-task.md' },
            commit: { sha: 'commit-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response)
        // Delete original file
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Deleted'
        } as Response);

      const result = await moveTaskToArchive(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'work-tasks/work-task.md',
        testContent,
        'Archive completed work task',
        'work-tasks'
      );

      expect(result).toBe('work-tasks/archive/work-task.md');
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    test('moveTaskFromArchive works with custom folder', async () => {
      const testContent = '# Archived Task\n\n- [x] Completed';
      const mockFileData = {
        content: btoa(testContent),
        sha: 'archive-sha',
        path: 'personal/archive/task.md',
        name: 'task.md'
      };

      mockFetch
        // Get archived file metadata
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFileData,
          headers: new Headers(),
          text: async () => JSON.stringify(mockFileData)
        } as Response)
        // Check if active file exists (for createOrUpdateTodo)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create file in active folder
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'active-sha', path: 'personal/task.md' },
            commit: { sha: 'commit-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response)
        // Delete from archive
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Deleted'
        } as Response);

      const result = await moveTaskFromArchive(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'personal/archive/task.md',
        testContent,
        'Restore task from archive',
        'personal'
      );

      expect(result).toBe('personal/task.md');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Project Management Functions', () => {
    test('listProjectFolders discovers existing project folders', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-tasks', type: 'dir' },
        { name: 'personal', type: 'dir' },
        { name: 'client-alpha', type: 'dir' },
        { name: 'README.md', type: 'file' },
        { name: 'some-other-folder', type: 'dir' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockContents,
        headers: new Headers(),
        text: async () => JSON.stringify(mockContents)
      } as Response);

      const result = await listProjectFolders(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal');
      expect(result).toContain('client-alpha');
      expect(result).toContain('some-other-folder');
      expect(result).not.toContain('README.md');
    });

    test('listProjectFolders handles empty repository', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
        headers: new Headers(),
        text: async () => 'Not Found'
      } as Response);

      const result = await listProjectFolders(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      expect(result).toEqual(['todos']); // Default fallback
    });

    test('createProjectFolder creates new project with folder structure', async () => {
      mockFetch
        // Check if main file exists (for createOrUpdateTodo)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create main folder .gitkeep
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'main-sha', path: 'client-beta/.gitkeep' },
            commit: { sha: 'commit1-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response)
        // Check if archive file exists (for createOrUpdateTodo)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create archive folder .gitkeep
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({
            content: { sha: 'archive-sha', path: 'client-beta/archive/.gitkeep' },
            commit: { sha: 'commit2-sha' }
          }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response);

      await createProjectFolder(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        'client-beta'
      );

      expect(mockFetch).toHaveBeenCalledTimes(4);
      
      // Verify main folder creation
      const calls = mockFetch.mock.calls;
      const secondCall = calls[1];
      const firstBody = JSON.parse(secondCall[1]?.body as string);
      expect(firstBody.body.message).toContain('client-beta project folder');
      
      // Verify archive folder creation
      const fourthCall = calls[3];
      const secondBody = JSON.parse(fourthCall[1]?.body as string);
      expect(secondBody.body.message).toContain('client-beta/archive directory');
    });

    test('createProjectFolder validates folder names', async () => {
      // Test invalid folder names
      const invalidNames = [
        '', // Empty
        '123invalid', // Starts with number
        'invalid-@#$', // Special characters
        'invalid space', // Spaces
        'invalid/slash' // Forward slash
      ];

      for (const invalidName of invalidNames) {
        await expect(
          createProjectFolder(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, invalidName)
        ).rejects.toThrow('Invalid folder name');
      }
    });

    test('createProjectFolder accepts valid folder names', async () => {
      mockFetch
        .mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ content: { sha: 'test' }, commit: { sha: 'test' } }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response);

      // Test valid folder names
      const validNames = [
        'todos',
        'work-tasks',
        'client123',
        'project_alpha',
        'personal-stuff',
        'a', // Single character
        'Very_Long_Project_Name_With_Underscores_And_Numbers_123'
      ];

      for (const validName of validNames) {
        mockFetch.mockClear();
        await expect(
          createProjectFolder(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, validName)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Integration with Settings and UI', () => {
    test('folder parameter flows through entire system', async () => {
      const customFolder = 'integration-test';
      
      // Step 1: Create project folder
      mockFetch
        // Check if main file exists
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create main folder
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ content: { sha: 'main' }, commit: { sha: 'commit1' } }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response)
        // Check if archive file exists
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
          headers: new Headers(),
          text: async () => 'Not Found'
        } as Response)
        // Create archive folder
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: async () => ({ content: { sha: 'archive' }, commit: { sha: 'commit2' } }),
          headers: new Headers(),
          text: async () => 'Created'
        } as Response);

      await createProjectFolder(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, customFolder);
      
      // Step 2: Fetch todos from custom folder (should be empty initially)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
        headers: new Headers(),
        text: async () => 'Not Found'
      } as Response);

      const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, customFolder, false);
      expect(todos).toEqual([]);
      
      // Step 3: Create a task in the custom folder
      // Check if task file exists
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
        headers: new Headers(),
        text: async () => 'Not Found'
      } as Response);
      // Create task file
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          content: { sha: 'task-sha', path: `${customFolder}/test-task.md` },
          commit: { sha: 'task-commit' }
        }),
        headers: new Headers(),
        text: async () => 'Created'
      } as Response);

      await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        `${customFolder}/test-task.md`,
        '# Test Task\n\n- [ ] Complete integration test',
        'feat: Add integration test task'
      );
      
      // Verify all operations used the correct custom folder
      const calls = mockFetch.mock.calls;
      
      // Check createProjectFolder calls
      expect(JSON.parse(calls[1][1]?.body as string).body.message).toContain(`${customFolder} project folder`);
      expect(JSON.parse(calls[3][1]?.body as string).body.message).toContain(`${customFolder}/archive directory`);
      
      // Check getTodos call
      expect(JSON.parse(calls[4][1]?.body as string).path).toContain(`/contents/${customFolder}`);
      
      // Check createOrUpdateTodo call  
      expect(JSON.parse(calls[6][1]?.body as string).path).toContain(`${customFolder}/test-task.md`);
    });
  });

  describe('Backward Compatibility', () => {
    test('defaults to todos folder when no folder specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Headers(),
        text: async () => '[]'
      } as Response);

      // Call without folder parameter (should default to 'todos')
      await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody.path).toContain('/contents/todos');
    });

    test('ensureTodosDirectory wrapper still works', async () => {
      const { ensureTodosDirectory } = require('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        headers: new Headers(),
        text: async () => '[]'
      } as Response);

      await ensureTodosDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody.path).toContain('/contents/todos');
    });
  });

  describe('Error Handling', () => {
    test('handles GitHub API errors gracefully for custom folders', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Forbidden' }),
        headers: new Headers(),
        text: async () => 'Forbidden'
      } as Response);

      await expect(
        getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'custom-folder')
      ).rejects.toThrow();
    });

    test('handles network errors during project creation', async () => {
      // Mock the first check (file exists) to throw a network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        createProjectFolder(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, 'test-project')
      ).rejects.toThrow('Network error');
    });
  });
});