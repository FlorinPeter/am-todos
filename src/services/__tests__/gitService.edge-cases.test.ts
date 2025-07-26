/**
 * GitService Edge Cases Tests - Validation, Error Handling, and Edge Cases
 * Consolidated from multiple redundant test files focusing on validation and error scenarios
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

describe('GitService - Edge Cases and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Settings Validation - Error Handling', () => {
    it('should throw error when no settings are configured', async () => {
      mockLoadSettings.mockReturnValue(null);

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow(
        'No settings configured. Please configure your Git provider in the application settings.'
      );
    });

    it('should throw error when settings are undefined', async () => {
      mockLoadSettings.mockReturnValue(undefined);

      const { createOrUpdateTodo } = await import('../gitService');

      await expect(
        createOrUpdateTodo('test.md', '# Test', 'feat: Test')
      ).rejects.toThrow('No settings configured');
    });

    it('should handle missing required GitHub fields', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        folder: 'todos'
        // Missing pat, owner, repo
      });

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow();
    });

    it('should handle missing required GitLab fields', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        folder: 'todos'
        // Missing token, instanceUrl, projectId
      });

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow();
    });

    it('should handle incomplete GitHub settings gracefully', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner'
        // Missing repo
      });

      const { getFileContent } = await import('../gitService');

      await expect(getFileContent('test.md')).rejects.toThrow();
    });

    it('should handle incomplete GitLab settings gracefully', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        token: 'token',
        instanceUrl: 'https://gitlab.com'
        // Missing projectId
      });

      const { getFileContent } = await import('../gitService');

      await expect(getFileContent('test.md')).rejects.toThrow();
    });
  });

  describe('Folder Name Validation', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should delegate folder creation without validation (validation handled by underlying service)', async () => {
      mockGithubService.createProjectFolder.mockResolvedValue(undefined);
      
      const { createProjectFolder } = await import('../gitService');

      // gitService delegates to underlying service without its own validation
      await expect(createProjectFolder('any-folder-name')).resolves.not.toThrow();
      
      expect(mockGithubService.createProjectFolder).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'any-folder-name'
      );
    });

    it('should accept valid folder names', async () => {
      mockGithubService.createProjectFolder.mockResolvedValue(undefined);

      const { createProjectFolder } = await import('../gitService');

      // Valid folder names should not throw
      await expect(createProjectFolder('valid-folder')).resolves.not.toThrow();
      await expect(createProjectFolder('valid_folder')).resolves.not.toThrow();
      await expect(createProjectFolder('validfolder')).resolves.not.toThrow();
    });

    it('should handle folder name validation errors from underlying service', async () => {
      mockGithubService.createProjectFolder.mockRejectedValue(new Error('Folder already exists'));

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('valid-folder')).rejects.toThrow('Folder already exists');
    });
  });

  describe('Service Provider Edge Cases', () => {
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

    it('should handle null provider gracefully', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: null,
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });

      const { getTodos } = await import('../gitService');
      await getTodos('todos', false);

      // Should fall back to GitHub
      expect(mockGithubService.getTodos).toHaveBeenCalled();
    });

    it('should handle case-sensitive provider names (exact match required)', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'GITLAB', // Uppercase will not match 'gitlab'
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '123',
        folder: 'todos'
      });

      const { getTodos } = await import('../gitService');
      
      // Should throw error as 'GITLAB' doesn't match 'gitlab'
      await expect(getTodos('todos', false)).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('Parameter Validation and Edge Cases', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should delegate file content requests without path validation', async () => {
      mockGithubService.getFileContent.mockResolvedValue('content');
      
      const { getFileContent } = await import('../gitService');

      // gitService delegates to underlying service without its own path validation
      await expect(getFileContent('')).resolves.toBeDefined();
      await expect(getFileContent(null)).resolves.toBeDefined();
      await expect(getFileContent(undefined)).resolves.toBeDefined();
      
      expect(mockGithubService.getFileContent).toHaveBeenCalledTimes(3);
    });

    it('should handle very long file paths', async () => {
      const longPath = 'todos/' + 'a'.repeat(1000) + '.md';
      mockGithubService.getFileContent.mockResolvedValue('content');

      const { getFileContent } = await import('../gitService');
      const result = await getFileContent(longPath);

      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        longPath
      );
    });

    it('should handle special characters in file paths', async () => {
      const specialPath = 'todos/файл-тест-中文-日本語.md';
      mockGithubService.getFileContent.mockResolvedValue('content');

      const { getFileContent } = await import('../gitService');
      await getFileContent(specialPath);

      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        specialPath
      );
    });
  });

  describe('Error Propagation and Handling', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should propagate GitHub service errors correctly', async () => {
      const customError = new Error('GitHub API rate limit exceeded');
      mockGithubService.getTodos.mockRejectedValue(customError);

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow('GitHub API rate limit exceeded');
    });

    it('should propagate GitLab service errors correctly', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.example.com',
        token: 'gitlab-token',
        projectId: '123',
        folder: 'todos'
      });

      const customError = new Error('GitLab authentication failed');
      mockGitlabService.getTodos.mockRejectedValue(customError);

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow('GitLab authentication failed');
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      mockGithubService.createOrUpdateTodo.mockRejectedValue(timeoutError);

      const { createOrUpdateTodo } = await import('../gitService');

      await expect(
        createOrUpdateTodo('test.md', '# Test', 'feat: Test')
      ).rejects.toThrow('Network timeout');
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      // deleteFile calls getFileMetadata first, so mock that to fail
      mockGithubService.getFileMetadata.mockRejectedValue(serviceError);

      const { deleteFile } = await import('../gitService');

      // deleteFile uses 2 parameters: path and commitMessage
      await expect(
        deleteFile('test.md', 'Delete test')
      ).rejects.toThrow('Service temporarily unavailable');
    });
  });

  describe('Data Validation Edge Cases', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should handle empty content in createOrUpdateTodo', async () => {
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { createOrUpdateTodo } = await import('../gitService');

      await expect(createOrUpdateTodo('test.md', '', 'feat: Empty content')).resolves.toBeDefined();
    });

    it('should handle very large content', async () => {
      const largeContent = '#'.repeat(100000); // 100KB content
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { createOrUpdateTodo } = await import('../gitService');

      await expect(createOrUpdateTodo('test.md', largeContent, 'feat: Large content')).resolves.toBeDefined();
    });

    it('should handle special characters in content', async () => {
      const specialContent = '# Test 🚀\n\n- [ ] Special chars: 中文 日本語 العربية';
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { createOrUpdateTodo } = await import('../gitService');

      await expect(createOrUpdateTodo('test.md', specialContent, 'feat: Special chars')).resolves.toBeDefined();
    });

    it('should delegate commit message handling without validation', async () => {
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });
      
      const { createOrUpdateTodo } = await import('../gitService');

      // gitService delegates to underlying service without commit message validation
      await expect(createOrUpdateTodo('test.md', '# Test', null)).resolves.toBeDefined();
      await expect(createOrUpdateTodo('test.md', '# Test', '')).resolves.toBeDefined();
      
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing folder in settings', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo'
        // Missing folder
      });
      
      mockGithubService.getTodos.mockResolvedValue([]);

      const { getTodos } = await import('../gitService');
      await getTodos('custom-folder', false);

      // Should use provided folder parameter
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo',
        'custom-folder',
        false
      );
    });

    it('should handle settings with extra unknown fields', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos',
        unknownField: 'should-be-ignored',
        anotherField: 123
      });
      
      mockGithubService.getTodos.mockResolvedValue([]);

      const { getTodos } = await import('../gitService');
      const result = await getTodos('todos', false);

      // Should work normally, ignoring unknown fields
      expect(mockGithubService.getTodos).toHaveBeenCalled();
    });

    it('should handle malformed settings gracefully', async () => {
      mockLoadSettings.mockReturnValue('invalid-settings-format');

      const { getTodos } = await import('../gitService');

      await expect(getTodos('todos', false)).rejects.toThrow();
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    beforeEach(() => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        folder: 'todos'
      });
    });

    it('should handle multiple simultaneous operations', async () => {
      mockGithubService.getTodos.mockResolvedValue([]);
      mockGithubService.getFileContent.mockResolvedValue('content');
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ content: { path: 'test.md' } });

      const { getTodos, getFileContent, createOrUpdateTodo } = await import('../gitService');

      // Execute multiple operations simultaneously
      const promises = [
        getTodos('todos', false),
        getFileContent('test1.md'),
        getFileContent('test2.md'),
        createOrUpdateTodo('test3.md', '# Test', 'feat: Test')
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle rapid successive calls to same function', async () => {
      mockGithubService.getTodos.mockResolvedValue([]);

      const { getTodos } = await import('../gitService');

      // Rapid successive calls
      const promises = Array(10).fill(0).map(() => getTodos('todos', false));

      await expect(Promise.all(promises)).resolves.toBeDefined();
      expect(mockGithubService.getTodos).toHaveBeenCalledTimes(10);
    });
  });
});