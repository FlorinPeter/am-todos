import { vi, describe, test, expect, beforeEach } from 'vitest';
import * as gitService from '../gitService';
import * as githubService from '../githubService';
import * as gitlabService from '../gitlabService';

// Mock the service modules
vi.mock('../githubService');
vi.mock('../gitlabService');
vi.mock('../../utils/logger');

const mockGithubService = vi.mocked(githubService);
const mockGitlabService = vi.mocked(gitlabService);

describe('GitService - Comprehensive Coverage', () => {
  const mockSettings = {
    githubPat: 'test-token',
    repoOwner: 'test-owner',
    repoName: 'test-repo',
    todosDirectory: 'todos',
    gitProvider: 'github' as const,
  };

  const mockGitlabSettings = {
    ...mockSettings,
    gitProvider: 'gitlab' as const,
  };

  const mockTodos = [
    {
      id: 'todo-1',
      filename: '2024-01-01-test-todo.md',
      frontmatter: {
        title: 'Test Todo',
        createdAt: '2024-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
      },
      content: '- [ ] Test task',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    mockGithubService.getTodos.mockResolvedValue(mockTodos);
    mockGithubService.getFileContent.mockResolvedValue('- [ ] Test content');
    mockGithubService.getFileMetadata.mockResolvedValue({
      sha: 'test-sha',
      lastModified: '2024-01-01T00:00:00.000Z',
    });
    mockGithubService.createOrUpdateTodo.mockResolvedValue(undefined);
    mockGithubService.ensureDirectory.mockResolvedValue(undefined);
    mockGithubService.moveTaskToArchive.mockResolvedValue(undefined);
    mockGithubService.moveTaskFromArchive.mockResolvedValue(undefined);
    mockGithubService.deleteFile.mockResolvedValue(undefined);

    mockGitlabService.getTodos.mockResolvedValue(mockTodos);
    mockGitlabService.getFileContent.mockResolvedValue('- [ ] Test content');
    mockGitlabService.getFileMetadata.mockResolvedValue({
      sha: 'test-sha',
      lastModified: '2024-01-01T00:00:00.000Z',
    });
    mockGitlabService.createOrUpdateTodo.mockResolvedValue(undefined);
    mockGitlabService.ensureDirectory.mockResolvedValue(undefined);
    mockGitlabService.moveTaskToArchive.mockResolvedValue(undefined);
    mockGitlabService.moveTaskFromArchive.mockResolvedValue(undefined);
    mockGitlabService.deleteFile.mockResolvedValue(undefined);
  });

  describe('Provider Delegation - GitHub', () => {
    test('getTodos delegates to GitHub service', async () => {
      const result = await gitService.getTodos(mockSettings);
      
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(mockSettings);
      expect(mockGitlabService.getTodos).not.toHaveBeenCalled();
      expect(result).toEqual(mockTodos);
    });

    test('getFileContent delegates to GitHub service', async () => {
      const result = await gitService.getFileContent(mockSettings, 'test-file.md');
      
      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(mockSettings, 'test-file.md');
      expect(mockGitlabService.getFileContent).not.toHaveBeenCalled();
      expect(result).toBe('- [ ] Test content');
    });

    test('getFileMetadata delegates to GitHub service', async () => {
      const result = await gitService.getFileMetadata(mockSettings, 'test-file.md');
      
      expect(mockGithubService.getFileMetadata).toHaveBeenCalledWith(mockSettings, 'test-file.md');
      expect(mockGitlabService.getFileMetadata).not.toHaveBeenCalled();
      expect(result).toEqual({
        sha: 'test-sha',
        lastModified: '2024-01-01T00:00:00.000Z',
      });
    });

    test('createOrUpdateTodo delegates to GitHub service', async () => {
      const todoData = {
        filename: 'test-todo.md',
        content: '# Test Todo',
        commitMessage: 'Add test todo',
      };

      await gitService.createOrUpdateTodo(mockSettings, todoData);
      
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(mockSettings, todoData);
      expect(mockGitlabService.createOrUpdateTodo).not.toHaveBeenCalled();
    });

    test('ensureDirectory delegates to GitHub service', async () => {
      await gitService.ensureDirectory(mockSettings);
      
      expect(mockGithubService.ensureDirectory).toHaveBeenCalledWith(mockSettings);
      expect(mockGitlabService.ensureDirectory).not.toHaveBeenCalled();
    });

    test('moveTaskToArchive delegates to GitHub service', async () => {
      await gitService.moveTaskToArchive(mockSettings, 'test-todo.md', 'Archive todo');
      
      expect(mockGithubService.moveTaskToArchive).toHaveBeenCalledWith(
        mockSettings, 
        'test-todo.md', 
        'Archive todo'
      );
      expect(mockGitlabService.moveTaskToArchive).not.toHaveBeenCalled();
    });

    test('moveTaskFromArchive delegates to GitHub service', async () => {
      await gitService.moveTaskFromArchive(mockSettings, 'test-todo.md', 'Unarchive todo');
      
      expect(mockGithubService.moveTaskFromArchive).toHaveBeenCalledWith(
        mockSettings, 
        'test-todo.md', 
        'Unarchive todo'
      );
      expect(mockGitlabService.moveTaskFromArchive).not.toHaveBeenCalled();
    });

    test('deleteFile delegates to GitHub service', async () => {
      await gitService.deleteFile(mockSettings, 'test-todo.md', 'Delete todo');
      
      expect(mockGithubService.deleteFile).toHaveBeenCalledWith(
        mockSettings, 
        'test-todo.md', 
        'Delete todo'
      );
      expect(mockGitlabService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('Provider Delegation - GitLab', () => {
    test('getTodos delegates to GitLab service', async () => {
      const result = await gitService.getTodos(mockGitlabSettings);
      
      expect(mockGitlabService.getTodos).toHaveBeenCalledWith(mockGitlabSettings);
      expect(mockGithubService.getTodos).not.toHaveBeenCalled();
      expect(result).toEqual(mockTodos);
    });

    test('getFileContent delegates to GitLab service', async () => {
      const result = await gitService.getFileContent(mockGitlabSettings, 'test-file.md');
      
      expect(mockGitlabService.getFileContent).toHaveBeenCalledWith(mockGitlabSettings, 'test-file.md');
      expect(mockGithubService.getFileContent).not.toHaveBeenCalled();
      expect(result).toBe('- [ ] Test content');
    });

    test('getFileMetadata delegates to GitLab service', async () => {
      const result = await gitService.getFileMetadata(mockGitlabSettings, 'test-file.md');
      
      expect(mockGitlabService.getFileMetadata).toHaveBeenCalledWith(mockGitlabSettings, 'test-file.md');
      expect(mockGithubService.getFileMetadata).not.toHaveBeenCalled();
      expect(result).toEqual({
        sha: 'test-sha',
        lastModified: '2024-01-01T00:00:00.000Z',
      });
    });

    test('createOrUpdateTodo delegates to GitLab service', async () => {
      const todoData = {
        filename: 'test-todo.md',
        content: '# Test Todo',
        commitMessage: 'Add test todo',
      };

      await gitService.createOrUpdateTodo(mockGitlabSettings, todoData);
      
      expect(mockGitlabService.createOrUpdateTodo).toHaveBeenCalledWith(mockGitlabSettings, todoData);
      expect(mockGithubService.createOrUpdateTodo).not.toHaveBeenCalled();
    });

    test('ensureDirectory delegates to GitLab service', async () => {
      await gitService.ensureDirectory(mockGitlabSettings);
      
      expect(mockGitlabService.ensureDirectory).toHaveBeenCalledWith(mockGitlabSettings);
      expect(mockGithubService.ensureDirectory).not.toHaveBeenCalled();
    });

    test('moveTaskToArchive delegates to GitLab service', async () => {
      await gitService.moveTaskToArchive(mockGitlabSettings, 'test-todo.md', 'Archive todo');
      
      expect(mockGitlabService.moveTaskToArchive).toHaveBeenCalledWith(
        mockGitlabSettings, 
        'test-todo.md', 
        'Archive todo'
      );
      expect(mockGithubService.moveTaskToArchive).not.toHaveBeenCalled();
    });

    test('moveTaskFromArchive delegates to GitLab service', async () => {
      await gitService.moveTaskFromArchive(mockGitlabSettings, 'test-todo.md', 'Unarchive todo');
      
      expect(mockGitlabService.moveTaskFromArchive).toHaveBeenCalledWith(
        mockGitlabSettings, 
        'test-todo.md', 
        'Unarchive todo'
      );
      expect(mockGithubService.moveTaskFromArchive).not.toHaveBeenCalled();
    });

    test('deleteFile delegates to GitLab service', async () => {
      await gitService.deleteFile(mockGitlabSettings, 'test-todo.md', 'Delete todo');
      
      expect(mockGitlabService.deleteFile).toHaveBeenCalledWith(
        mockGitlabSettings, 
        'test-todo.md', 
        'Delete todo'
      );
      expect(mockGithubService.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('propagates GitHub service errors', async () => {
      const error = new Error('GitHub API error');
      mockGithubService.getTodos.mockRejectedValue(error);

      await expect(gitService.getTodos(mockSettings)).rejects.toThrow('GitHub API error');
    });

    test('propagates GitLab service errors', async () => {
      const error = new Error('GitLab API error');
      mockGitlabService.getTodos.mockRejectedValue(error);

      await expect(gitService.getTodos(mockGitlabSettings)).rejects.toThrow('GitLab API error');
    });

    test('handles network timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockGithubService.getFileContent.mockRejectedValue(timeoutError);

      await expect(gitService.getFileContent(mockSettings, 'test.md')).rejects.toThrow('Request timeout');
    });

    test('handles authentication errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).status = 401;
      mockGithubService.createOrUpdateTodo.mockRejectedValue(authError);

      const todoData = {
        filename: 'test.md',
        content: 'content',
        commitMessage: 'message',
      };

      await expect(gitService.createOrUpdateTodo(mockSettings, todoData)).rejects.toThrow('Unauthorized');
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined provider gracefully', async () => {
      const settingsWithoutProvider = {
        ...mockSettings,
        gitProvider: undefined as any,
      };

      // Should default to GitHub
      await gitService.getTodos(settingsWithoutProvider);
      expect(mockGithubService.getTodos).toHaveBeenCalled();
    });

    test('handles null provider gracefully', async () => {
      const settingsWithNullProvider = {
        ...mockSettings,
        gitProvider: null as any,
      };

      // Should default to GitHub
      await gitService.getTodos(settingsWithNullProvider);
      expect(mockGithubService.getTodos).toHaveBeenCalled();
    });

    test('handles invalid provider gracefully', async () => {
      const settingsWithInvalidProvider = {
        ...mockSettings,
        gitProvider: 'invalid' as any,
      };

      // Should default to GitHub
      await gitService.getTodos(settingsWithInvalidProvider);
      expect(mockGithubService.getTodos).toHaveBeenCalled();
    });

    test('handles empty settings object', async () => {
      const emptySettings = {} as any;

      await gitService.getTodos(emptySettings);
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(emptySettings);
    });

    test('passes through all parameters correctly', async () => {
      const complexTodoData = {
        filename: 'complex-todo.md',
        content: '# Complex Todo\n\n- [ ] Task 1\n- [ ] Task 2',
        commitMessage: 'feat: add complex todo with multiple tasks',
        metadata: {
          priority: 1,
          tags: ['urgent', 'feature'],
        },
      };

      await gitService.createOrUpdateTodo(mockSettings, complexTodoData);
      
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(
        mockSettings, 
        complexTodoData
      );
    });

    test('handles very long filenames', async () => {
      const longFilename = 'very-long-filename-' + 'a'.repeat(200) + '.md';
      
      await gitService.getFileContent(mockSettings, longFilename);
      
      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        mockSettings, 
        longFilename
      );
    });

    test('handles special characters in filenames', async () => {
      const specialFilename = 'file-with-émojis-🚀-and-spaces.md';
      
      await gitService.deleteFile(mockSettings, specialFilename, 'Delete special file');
      
      expect(mockGithubService.deleteFile).toHaveBeenCalledWith(
        mockSettings, 
        specialFilename,
        'Delete special file'
      );
    });
  });

  describe('Performance and Concurrency', () => {
    test('handles concurrent operations', async () => {
      const operations = [
        gitService.getTodos(mockSettings),
        gitService.getFileContent(mockSettings, 'file1.md'),
        gitService.getFileContent(mockSettings, 'file2.md'),
        gitService.getFileMetadata(mockSettings, 'file3.md'),
      ];

      await Promise.all(operations);

      expect(mockGithubService.getTodos).toHaveBeenCalledTimes(1);
      expect(mockGithubService.getFileContent).toHaveBeenCalledTimes(2);
      expect(mockGithubService.getFileMetadata).toHaveBeenCalledTimes(1);
    });

    test('maintains provider isolation in concurrent calls', async () => {
      const githubOp = gitService.getTodos(mockSettings);
      const gitlabOp = gitService.getTodos(mockGitlabSettings);

      await Promise.all([githubOp, gitlabOp]);

      expect(mockGithubService.getTodos).toHaveBeenCalledWith(mockSettings);
      expect(mockGitlabService.getTodos).toHaveBeenCalledWith(mockGitlabSettings);
    });
  });
});