/**
 * GitService Core Tests - Main Service Functions and Basic Delegation
 * Consolidated from 6 redundant test files to eliminate massive duplication
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Shared mock setup (consolidated from 6 files)
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

describe('GitService - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default localStorage mock response
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
      folder: 'todos'
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Service Delegation - Core Functions', () => {
    it('should delegate getTodos to GitHub service', async () => {
      const mockTodos = [
        { id: '1', title: 'Test Todo', priority: 3, isArchived: false }
      ];
      mockGithubService.getTodos.mockResolvedValue(mockTodos);

      const { getTodos } = await import('../gitService');
      const result = await getTodos('todos', false);

      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'test-token',
        'test-owner', 
        'test-repo',
        'todos',
        false
      );
      expect(result).toEqual(mockTodos);
    });

    it('should delegate getTodos to GitLab service when provider is gitlab', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '123',
        folder: 'tasks'
      });

      const mockTodos = [
        { id: '2', title: 'GitLab Todo', priority: 2, isArchived: false }
      ];
      mockGitlabService.getTodos.mockResolvedValue(mockTodos);

      const { getTodos } = await import('../gitService');
      const result = await getTodos('tasks', false);

      expect(mockGitlabService.getTodos).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '123',
          token: 'gitlab-token',
          branch: 'main'
        },
        'tasks',
        false
      );
      expect(result).toEqual(mockTodos);
    });

    it('should delegate createOrUpdateTodo to appropriate service', async () => {
      const mockResponse = { content: { path: 'todos/test.md' } };
      mockGithubService.createOrUpdateTodo.mockResolvedValue(mockResponse);

      const { createOrUpdateTodo } = await import('../gitService');
      const result = await createOrUpdateTodo(
        'todos/test.md',
        '# Test Todo\n\n- [ ] Test task',
        'feat: Add test todo'
      );

      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        '# Test Todo\n\n- [ ] Test task',
        'feat: Add test todo',
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delegate deleteFile to appropriate service', async () => {
      const mockResponse = { commit: { message: 'Deleted file' } };
      const mockMetadata = { sha: 'test-sha-123' };
      
      mockGithubService.getFileMetadata.mockResolvedValue(mockMetadata);
      mockGithubService.deleteFile.mockResolvedValue(mockResponse);

      const { deleteFile } = await import('../gitService');
      const result = await deleteFile('todos/test.md', 'Delete test file');

      expect(mockGithubService.getFileMetadata).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md'
      );
      expect(mockGithubService.deleteFile).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        'test-sha-123',
        'Delete test file'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should delegate getFileContent to appropriate service', async () => {
      const mockContent = '# Test Todo\n\n- [ ] Test task';
      mockGithubService.getFileContent.mockResolvedValue(mockContent);

      const { getFileContent } = await import('../gitService');
      const result = await getFileContent('todos/test.md');

      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toBe(mockContent);
    });
  });

  describe('Folder Operations - Core Functions', () => {
    it('should delegate listProjectFolders to appropriate service', async () => {
      const mockFolders = ['todos', 'work-tasks', 'personal'];
      mockGithubService.listProjectFolders.mockResolvedValue(mockFolders);

      const { listProjectFolders } = await import('../gitService');
      const result = await listProjectFolders();

      expect(mockGithubService.listProjectFolders).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo'
      );
      expect(result).toEqual(mockFolders);
    });

    it('should delegate createProjectFolder to appropriate service', async () => {
      mockGithubService.createProjectFolder.mockResolvedValue(undefined);

      const { createProjectFolder } = await import('../gitService');
      await createProjectFolder('new-project');

      expect(mockGithubService.createProjectFolder).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'new-project'
      );
    });

    it('should handle folder creation with GitLab service', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        projectId: '123',
        token: 'gitlab-token',
        folder: 'todos'
      });

      mockGitlabService.createProjectFolder.mockResolvedValue(undefined);

      const { createProjectFolder } = await import('../gitService');
      await createProjectFolder('gitlab-project');

      expect(mockGitlabService.createProjectFolder).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '123',
          token: 'gitlab-token',
          branch: 'main'
        },
        'gitlab-project'
      );
    });
  });

  describe('Archive Operations - Core Functions', () => {
    it('should delegate moveTaskToArchive to appropriate service', async () => {
      const mockArchivePath = 'todos/archive/test.md';
      mockGithubService.moveTaskToArchive.mockResolvedValue(mockArchivePath);

      const { moveTaskToArchive } = await import('../gitService');
      const result = await moveTaskToArchive(
        'todos/test.md',
        '# Test Todo\n\n- [x] Completed task',
        'Archive completed task',
        'todos'
      );

      expect(mockGithubService.moveTaskToArchive).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        '# Test Todo\n\n- [x] Completed task',
        'Archive completed task',
        'todos'
      );
      expect(result).toBe(mockArchivePath);
    });

    it('should delegate moveTaskFromArchive to appropriate service', async () => {
      const mockActivePath = 'todos/test.md';
      mockGithubService.moveTaskFromArchive.mockResolvedValue(mockActivePath);

      const { moveTaskFromArchive } = await import('../gitService');
      const result = await moveTaskFromArchive(
        'todos/archive/test.md',
        '# Test Todo\n\n- [ ] Restored task',
        'Restore task from archive',
        'todos'
      );

      expect(mockGithubService.moveTaskFromArchive).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/archive/test.md',
        '# Test Todo\n\n- [ ] Restored task',
        'Restore task from archive',
        'todos'
      );
      expect(result).toBe(mockActivePath);
    });
  });

  describe('Git History Operations - Core Functions', () => {
    it('should delegate getFileHistory to appropriate service', async () => {
      const mockHistory = [
        { sha: 'abc123', message: 'Initial commit', author: 'user', date: '2023-01-01' }
      ];
      mockGithubService.getFileHistory.mockResolvedValue(mockHistory);

      const { getFileHistory } = await import('../gitService');
      const result = await getFileHistory('todos/test.md');

      expect(mockGithubService.getFileHistory).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toEqual(mockHistory);
    });

    it('should delegate getFileAtCommit to appropriate service', async () => {
      const mockFileContent = {
        content: '# Historical Content',
        sha: 'abc123'
      };
      mockGithubService.getFileAtCommit.mockResolvedValue(mockFileContent);

      const { getFileAtCommit } = await import('../gitService');
      const result = await getFileAtCommit('todos/test.md', 'abc123');

      expect(mockGithubService.getFileAtCommit).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md',
        'abc123'
      );
      expect(result).toEqual(mockFileContent);
    });
  });

  describe('Directory Management - Core Functions', () => {
    it('should delegate ensureDirectory to appropriate service', async () => {
      mockGithubService.ensureDirectory.mockResolvedValue(undefined);

      const { ensureDirectory } = await import('../gitService');
      await ensureDirectory('new-directory');

      expect(mockGithubService.ensureDirectory).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'new-directory',
        undefined
      );
    });

    // ensureArchiveDirectory function doesn't exist in gitService - removed test
  });

  describe('File Metadata Operations - Core Functions', () => {
    it('should delegate getFileMetadata to appropriate service', async () => {
      const mockMetadata = {
        sha: 'file-sha',
        path: 'todos/test.md',
        content: 'base64-content'
      };
      mockGithubService.getFileMetadata.mockResolvedValue(mockMetadata);

      const { getFileMetadata } = await import('../gitService');
      const result = await getFileMetadata('todos/test.md');

      expect(mockGithubService.getFileMetadata).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toEqual(mockMetadata);
    });
  });

  describe('Provider Selection Logic', () => {
    it('should use GitHub service by default', async () => {
      const { getTodos } = await import('../gitService');
      await getTodos('todos', false);

      expect(mockGithubService.getTodos).toHaveBeenCalled();
      expect(mockGitlabService.getTodos).not.toHaveBeenCalled();
    });

    it('should use GitLab service when provider is set to gitlab', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        projectId: '123',
        token: 'gitlab-token',
        folder: 'todos'
      });

      const { getTodos } = await import('../gitService');
      await getTodos('todos', false);

      expect(mockGitlabService.getTodos).toHaveBeenCalled();
      expect(mockGithubService.getTodos).not.toHaveBeenCalled();
    });

    it('should throw error for unknown provider (no fallback)', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unknown-provider',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });

      const { getTodos } = await import('../gitService');
      
      await expect(getTodos('todos', false)).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('Configuration Handling', () => {
    it('should handle missing git settings gracefully', async () => {
      mockLoadSettings.mockReturnValue(null);

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow();
    });

    it('should handle incomplete git settings', async () => {
      mockLoadSettings.mockReturnValue({
        provider: 'github',
        token: 'test-token'
        // Missing owner, repo, folder
      });

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow();
    });

    it('should pass through all required parameters correctly', async () => {
      const settings = {
        gitProvider: 'github',
        pat: 'custom-token',
        owner: 'custom-owner',
        repo: 'custom-repo',
        folder: 'custom-folder'
      };
      mockLoadSettings.mockReturnValue(settings);

      const { getTodos } = await import('../gitService');
      await getTodos('custom-path', true);

      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'custom-token',
        'custom-owner',
        'custom-repo',
        'custom-path',
        true
      );
    });
  });
});