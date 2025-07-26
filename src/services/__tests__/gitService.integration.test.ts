/**
 * GitService Integration Tests - Complete Delegation Workflows and Complex Operations
 * Consolidated from multiple redundant test files focusing on integration scenarios
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Shared mock setup (consolidated from multiple files)
vi.mock('../../utils/localStorage', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Shared service mocks (consolidated from multiple files)
const mockGithubService = {
  getTodos: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  deleteFile: vi.fn(),
  getFileContent: vi.fn(),
  listProjectFolders: vi.fn(),
  createProjectFolder: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn(),
  ensureDirectory: vi.fn(),
  ensureArchiveDirectory: vi.fn(),
  getFileMetadata: vi.fn()
};

const mockGitlabService = {
  getTodos: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  deleteFile: vi.fn(),
  getFileContent: vi.fn(),
  listProjectFolders: vi.fn(),
  createProjectFolder: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn(),
  ensureDirectory: vi.fn(),
  ensureArchiveDirectory: vi.fn(),
  getFileMetadata: vi.fn()
};

vi.mock('../githubService', () => mockGithubService);
vi.mock('../gitlabService', () => mockGitlabService);

// Mock localStorage utilities
import * as localStorage from '../../utils/localStorage';
const mockLoadSettings = vi.mocked(localStorage.loadSettings);

describe('GitService - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Complete Delegation Workflows - GitHub', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'github-owner',
        repo: 'github-repo',
        folder: 'todos'
      });
    });

    it('should handle complete todo lifecycle through GitHub service', async () => {
      // Mock all GitHub service calls for complete workflow
      const mockTodo = { id: '1', title: 'Test Todo', priority: 3, isArchived: false };
      const mockCreateResponse = { content: { path: 'todos/test.md', sha: 'abc123' } };
      const mockContent = '# Test Todo\n\n- [ ] Test task';
      const mockDeleteResponse = { commit: { message: 'Deleted file' } };
      const mockMetadata = { sha: 'abc123', path: 'todos/test.md', content: 'base64-content' };

      mockGithubService.getTodos.mockResolvedValue([]);
      mockGithubService.createOrUpdateTodo.mockResolvedValue(mockCreateResponse);
      mockGithubService.getFileContent.mockResolvedValue(mockContent);
      mockGithubService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockGithubService.deleteFile.mockResolvedValue(mockDeleteResponse);

      const { getTodos, createOrUpdateTodo, getFileContent, deleteFile } = await import('../gitService');

      // Complete workflow: list -> create -> read -> delete
      const initialTodos = await getTodos('todos', false);
      expect(initialTodos).toEqual([]);

      const createResult = await createOrUpdateTodo('todos/test.md', mockContent, 'feat: Add test todo');
      expect(createResult).toEqual(mockCreateResponse);

      const fileContent = await getFileContent('todos/test.md');
      expect(fileContent).toBe(mockContent);

      const deleteResult = await deleteFile('todos/test.md', 'Delete test todo');
      expect(deleteResult).toEqual(mockDeleteResponse);

      // Verify all GitHub service calls were made
      expect(mockGithubService.getTodos).toHaveBeenCalledTimes(1);
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledTimes(1);
      expect(mockGithubService.getFileContent).toHaveBeenCalledTimes(1);
      expect(mockGithubService.deleteFile).toHaveBeenCalledTimes(1);
    });

    it('should handle complete archive workflow through GitHub service', async () => {
      const mockContent = '# Completed Todo\n\n- [x] Completed task';
      const mockArchivePath = 'todos/archive/completed.md';
      const mockRestorePath = 'todos/completed.md';

      mockGithubService.moveTaskToArchive.mockResolvedValue(mockArchivePath);
      mockGithubService.moveTaskFromArchive.mockResolvedValue(mockRestorePath);
      mockGithubService.getTodos.mockResolvedValue([]);

      const { moveTaskToArchive, moveTaskFromArchive, getTodos } = await import('../gitService');

      // Archive workflow
      const archiveResult = await moveTaskToArchive(
        'todos/completed.md',
        mockContent,
        'Archive completed task',
        'todos'
      );
      expect(archiveResult).toBe(mockArchivePath);

      // Verify archived todos can be retrieved
      await getTodos('todos', true);

      // Restore workflow
      const restoreResult = await moveTaskFromArchive(
        mockArchivePath,
        mockContent,
        'Restore task',
        'todos'
      );
      expect(restoreResult).toBe(mockRestorePath);

      expect(mockGithubService.moveTaskToArchive).toHaveBeenCalledWith(
        'github-token',
        'github-owner',
        'github-repo',
        'todos/completed.md',
        mockContent,
        'Archive completed task',
        'todos'
      );

      expect(mockGithubService.moveTaskFromArchive).toHaveBeenCalledWith(
        'github-token',
        'github-owner',
        'github-repo',
        mockArchivePath,
        mockContent,
        'Restore task',
        'todos'
      );
    });

    it('should handle complete project management workflow', async () => {
      const mockFolders = ['todos', 'work-tasks'];
      mockGithubService.listProjectFolders.mockResolvedValue(mockFolders);
      mockGithubService.createProjectFolder.mockResolvedValue(undefined);
      mockGithubService.ensureDirectory.mockResolvedValue(undefined);

      const { listProjectFolders, createProjectFolder, ensureDirectory } = await import('../gitService');

      // List existing folders
      const folders = await listProjectFolders();
      expect(folders).toEqual(mockFolders);

      // Create new project
      await createProjectFolder('new-project');

      // Ensure directory exists
      await ensureDirectory('new-project');

      expect(mockGithubService.listProjectFolders).toHaveBeenCalledWith(
        'github-token',
        'github-owner',
        'github-repo'
      );

      expect(mockGithubService.createProjectFolder).toHaveBeenCalledWith(
        'github-token',
        'github-owner',
        'github-repo',
        'new-project'
      );

      expect(mockGithubService.ensureDirectory).toHaveBeenCalledWith(
        'github-token',
        'github-owner',
        'github-repo',
        'new-project',
        undefined
      );
    });
  });

  describe('Complete Delegation Workflows - GitLab', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '456',
        folder: 'tasks'
      });
    });

    it('should handle complete todo lifecycle through GitLab service', async () => {
      const mockTodo = { id: '2', title: 'GitLab Todo', priority: 2, isArchived: false };
      const mockCreateResponse = { content: { path: 'tasks/test.md', sha: 'def456' } };
      const mockContent = '# GitLab Todo\n\n- [ ] GitLab task';
      const mockDeleteResponse = { commit: { message: 'Deleted file' } };

      mockGitlabService.getTodos.mockResolvedValue([mockTodo]);
      mockGitlabService.createOrUpdateTodo.mockResolvedValue(mockCreateResponse);
      mockGitlabService.getFileContent.mockResolvedValue(mockContent);
      mockGitlabService.deleteFile.mockResolvedValue(mockDeleteResponse);

      const { getTodos, createOrUpdateTodo, getFileContent, deleteFile } = await import('../gitService');

      // Complete workflow through GitLab
      const todos = await getTodos('tasks', false);
      expect(todos).toEqual([mockTodo]);

      const createResult = await createOrUpdateTodo('tasks/test.md', mockContent, 'feat: Add GitLab todo');
      expect(createResult).toEqual(mockCreateResponse);

      const fileContent = await getFileContent('tasks/test.md');
      expect(fileContent).toBe(mockContent);

      const deleteResult = await deleteFile('tasks/test.md', 'Delete GitLab todo');
      expect(deleteResult).toEqual(mockDeleteResponse);

      // Verify all GitLab service calls were made
      expect(mockGitlabService.getTodos).toHaveBeenCalledWith(
        {
          token: 'gitlab-token',
          instanceUrl: 'https://gitlab.example.com',
          projectId: '456',
          branch: 'main'
        },
        'tasks',
        false
      );

      expect(mockGitlabService.createOrUpdateTodo).toHaveBeenCalledWith(
        {
          token: 'gitlab-token',
          instanceUrl: 'https://gitlab.example.com',
          projectId: '456',
          branch: 'main'
        },
        'tasks/test.md',
        mockContent,
        'feat: Add GitLab todo'
      );
    });

    it('should handle GitLab-specific git history operations', async () => {
      const mockHistory = [
        { sha: 'commit1', message: 'Initial commit', author: 'user', date: '2023-01-01' },
        { sha: 'commit2', message: 'Update todo', author: 'user', date: '2023-01-02' }
      ];

      const mockFileAtCommit = {
        content: '# Historical Content',
        sha: 'commit1'
      };

      mockGitlabService.getFileHistory.mockResolvedValue(mockHistory);
      mockGitlabService.getFileAtCommit.mockResolvedValue(mockFileAtCommit);

      const { getFileHistory, getFileAtCommit } = await import('../gitService');

      const history = await getFileHistory('tasks/test.md');
      expect(history).toEqual(mockHistory);

      const fileAtCommit = await getFileAtCommit('tasks/test.md', 'commit1');
      expect(fileAtCommit).toEqual(mockFileAtCommit);

      expect(mockGitlabService.getFileHistory).toHaveBeenCalledWith(
        {
          token: 'gitlab-token',
          instanceUrl: 'https://gitlab.example.com',
          projectId: '456',
          branch: 'main'
        },
        'tasks/test.md'
      );

      expect(mockGitlabService.getFileAtCommit).toHaveBeenCalledWith(
        {
          token: 'gitlab-token',
          instanceUrl: 'https://gitlab.example.com',
          projectId: '456',
          branch: 'main'
        },
        'tasks/test.md',
        'commit1'
      );
    });
  });

  describe('Cross-Provider Consistency', () => {
    it('should provide consistent interface regardless of provider', async () => {
      const githubSettings = {
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'github-owner',
        repo: 'github-repo',
        folder: 'todos'
      };

      const gitlabSettings = {
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '789',
        folder: 'todos'
      };

      // Test with GitHub
      mockLoadSettings.mockReturnValue(githubSettings);
      mockGithubService.getTodos.mockResolvedValue([]);

      let { getTodos } = await import('../gitService');
      await getTodos('todos', false);

      expect(mockGithubService.getTodos).toHaveBeenCalled();

      // Reset and test with GitLab
      vi.resetModules();
      mockLoadSettings.mockReturnValue(gitlabSettings);
      mockGitlabService.getTodos.mockResolvedValue([]);

      ({ getTodos } = await import('../gitService'));
      await getTodos('todos', false);

      expect(mockGitlabService.getTodos).toHaveBeenCalled();
    });

    it('should handle provider switching during runtime', async () => {
      // Start with GitHub
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'github-owner',
        repo: 'github-repo',
        folder: 'todos'
      });

      mockGithubService.getTodos.mockResolvedValue([]);

      let { getTodos } = await import('../gitService');
      await getTodos('todos', false);

      expect(mockGithubService.getTodos).toHaveBeenCalledTimes(1);

      // Switch to GitLab (simulating settings change)
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '999',
        folder: 'todos'
      });

      vi.resetModules();
      mockGitlabService.getTodos.mockResolvedValue([]);

      ({ getTodos } = await import('../gitService'));
      await getTodos('todos', false);

      expect(mockGitlabService.getTodos).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complex Workflow Integration', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should handle multiple concurrent operations across different functions', async () => {
      // Setup mocks for concurrent operations
      mockGithubService.getTodos.mockImplementation(
        (token, owner, repo, folder, archived) => 
          Promise.resolve(archived ? [] : [{ id: '1', title: 'Test', priority: 3, isArchived: false }])
      );
      mockGithubService.listProjectFolders.mockResolvedValue(['todos', 'work']);
      mockGithubService.getFileContent.mockResolvedValue('# Content');
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { getTodos, listProjectFolders, getFileContent, createOrUpdateTodo } = await import('../gitService');

      // Execute multiple operations concurrently
      const [activeTodos, archivedTodos, folders, content, createResult] = await Promise.all([
        getTodos('todos', false),
        getTodos('todos', true),
        listProjectFolders(),
        getFileContent('test.md'),
        createOrUpdateTodo('new.md', '# New', 'feat: New file')
      ]);

      expect(activeTodos).toHaveLength(1);
      expect(archivedTodos).toHaveLength(0);
      expect(folders).toEqual(['todos', 'work']);
      expect(content).toBe('# Content');
      expect(createResult.content.path).toBe('test.md');
    });

    it('should maintain state consistency during complex operations', async () => {
      const mockMetadata = { sha: 'file-sha', path: 'test.md', content: 'base64-content' };
      mockGithubService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });
      mockGithubService.moveTaskToArchive.mockResolvedValue('archive/test.md');

      const { getFileMetadata, createOrUpdateTodo, moveTaskToArchive } = await import('../gitService');

      // Complex workflow: get metadata -> update -> archive
      const metadata = await getFileMetadata('test.md');
      expect(metadata.sha).toBe('file-sha');

      const updateResult = await createOrUpdateTodo(
        'test.md',
        '# Updated content',
        'feat: Update',
        metadata.sha
      );
      expect(updateResult.content.path).toBe('test.md');

      const archivePath = await moveTaskToArchive(
        'test.md',
        '# Updated content',
        'Archive updated file',
        'todos'
      );
      expect(archivePath).toBe('archive/test.md');

      // Verify proper parameter passing
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'test.md',
        '# Updated content',
        'feat: Update',
        'file-sha'
      );
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should handle partial failures in batch operations gracefully', async () => {
      // Setup mixed success/failure scenario
      mockGithubService.getTodos.mockResolvedValue([]);
      mockGithubService.listProjectFolders.mockRejectedValue(new Error('Folders API failed'));
      mockGithubService.getFileContent.mockResolvedValue('content');

      const { getTodos, listProjectFolders, getFileContent } = await import('../gitService');

      // Some operations succeed, some fail
      const results = await Promise.allSettled([
        getTodos('todos', false),
        listProjectFolders(),
        getFileContent('test.md')
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      if (results[1].status === 'rejected') {
        expect(results[1].reason.message).toBe('Folders API failed');
      }
    });

    it('should recover from temporary service failures', async () => {
      // Simulate temporary failure followed by success
      mockGithubService.getTodos
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([{ id: '1', title: 'Success', priority: 3, isArchived: false }]);

      const { getTodos } = await import('../gitService');

      // First call fails
      await expect(getTodos('todos', false)).rejects.toThrow('Temporary failure');

      // Second call succeeds
      const result = await getTodos('todos', false);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Success');
    });
  });

  describe('Service Interface Consistency', () => {
    it('should export all required functions with consistent signatures', async () => {
      const gitService = await import('../gitService');

      // Verify all expected functions are exported
      const expectedFunctions = [
        'getTodos',
        'createOrUpdateTodo',
        'deleteFile',
        'getFileContent',
        'listProjectFolders',
        'createProjectFolder',
        'moveTaskToArchive',
        'moveTaskFromArchive',
        'getFileHistory',
        'getFileAtCommit',
        'ensureDirectory',
        'getFileMetadata',
        'getGitSettings'
      ];

      expectedFunctions.forEach(funcName => {
        expect(typeof gitService[funcName]).toBe('function');
      });
    });

    it('should maintain consistent parameter patterns across providers', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });

      mockGithubService.getTodos.mockResolvedValue([]);
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { getTodos, createOrUpdateTodo } = await import('../gitService');

      // Test parameter consistency
      await getTodos('custom-folder', true);
      await createOrUpdateTodo('test.md', '# Content', 'feat: Test');

      // Verify GitHub service received consistent parameters
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'custom-folder',
        true
      );

      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'test.md',
        '# Content',
        'feat: Test',
        undefined
      );
    });
  });
});