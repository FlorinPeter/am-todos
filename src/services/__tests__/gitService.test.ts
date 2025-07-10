import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as gitService from '../gitService';
import * as githubService from '../githubService';
import * as gitlabService from '../gitlabService';
import { loadSettings } from '../../utils/localStorage';

// Mock all the service dependencies
vi.mock('../githubService');
vi.mock('../gitlabService');
vi.mock('../../utils/localStorage');

describe('Git Service Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitSettings', () => {
    it('should return GitHub settings when provider is github', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('github');
      expect(settings.pat).toBe('github-token');
      expect(settings.owner).toBe('test-user');
      expect(settings.repo).toBe('test-repo');
    });

    it('should return GitLab settings when provider is gitlab', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main',
        folder: 'todos'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('gitlab');
      expect(settings.instanceUrl).toBe('https://gitlab.com');
      expect(settings.projectId).toBe('12345');
      expect(settings.token).toBe('gitlab-token');
      expect(settings.branch).toBe('main');
    });

    it('should default to github when no provider is specified', () => {
      (loadSettings as any).mockReturnValue({
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('github');
    });

    it('should throw error when no settings are found', () => {
      (loadSettings as any).mockReturnValue(null);

      expect(() => gitService.getGitSettings()).toThrow(
        'No settings configured. Please configure your Git provider in the application settings.'
      );
    });
  });

  describe('createOrUpdateTodo', () => {
    it('should route to GitHub service when provider is github', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      });

      const mockResult = { file_path: 'todos/test.md' };
      (githubService.createOrUpdateTodo as any).mockResolvedValue(mockResult);

      const result = await gitService.createOrUpdateTodo(
        'todos/test.md',
        '# Test',
        'feat: Add test',
        'sha123'
      );

      expect(githubService.createOrUpdateTodo).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md',
        '# Test',
        'feat: Add test',
        'sha123'
      );
      expect(result).toBe(mockResult);
    });

    it('should route to GitLab service when provider is gitlab', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main',
        folder: 'todos'
      });

      const mockResult = { file_path: 'todos/test.md' };
      (gitlabService.createOrUpdateTodo as any).mockResolvedValue(mockResult);

      const result = await gitService.createOrUpdateTodo(
        'todos/test.md',
        '# Test',
        'feat: Add test'
      );

      expect(gitlabService.createOrUpdateTodo).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md',
        '# Test',
        'feat: Add test'
      );
      expect(result).toBe(mockResult);
    });

    it('should throw error when GitHub settings are incomplete', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        // Missing owner and repo
        folder: 'todos'
      });

      await expect(
        gitService.createOrUpdateTodo('todos/test.md', '# Test', 'feat: Add test')
      ).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error when GitLab settings are incomplete', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        // Missing projectId and token
        folder: 'todos'
      });

      await expect(
        gitService.createOrUpdateTodo('todos/test.md', '# Test', 'feat: Add test')
      ).rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });
  });

  describe('getTodos', () => {
    it('should route to GitHub service when provider is github', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      });

      const mockTodos = [{ name: 'test.md', path: 'todos/test.md' }];
      (githubService.getTodos as any).mockResolvedValue(mockTodos);

      const result = await gitService.getTodos('todos', false);

      expect(githubService.getTodos).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos',
        false
      );
      expect(result).toBe(mockTodos);
    });

    it('should route to GitLab service when provider is gitlab', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main',
        folder: 'todos'
      });

      const mockTodos = [{ name: 'test.md', path: 'todos/test.md' }];
      (gitlabService.getTodos as any).mockResolvedValue(mockTodos);

      const result = await gitService.getTodos('todos', false);

      expect(gitlabService.getTodos).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos',
        false
      );
      expect(result).toBe(mockTodos);
    });
  });

  describe('deleteFile', () => {
    it('should get metadata first for GitHub and then delete', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      });

      const mockMetadata = { sha: 'abc123' };
      const mockResult = { message: 'deleted' };
      (githubService.getFileMetadata as any).mockResolvedValue(mockMetadata);
      (githubService.deleteFile as any).mockResolvedValue(mockResult);

      const result = await gitService.deleteFile('todos/test.md', 'feat: Delete test');

      expect(githubService.getFileMetadata).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md'
      );
      expect(githubService.deleteFile).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md',
        'abc123',
        'feat: Delete test'
      );
      expect(result).toBe(mockResult);
    });

    it('should delete directly for GitLab without getting metadata', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main',
        folder: 'todos'
      });

      const mockResult = { message: 'deleted' };
      (gitlabService.deleteFile as any).mockResolvedValue(mockResult);

      const result = await gitService.deleteFile('todos/test.md', 'feat: Delete test');

      expect(gitlabService.deleteFile).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md',
        'feat: Delete test'
      );
      expect(result).toBe(mockResult);
      
      // Should not call getFileMetadata for GitLab
      expect(githubService.getFileMetadata).not.toHaveBeenCalled();
    });
  });

  describe('unsupported provider', () => {
    it('should throw error for unsupported provider', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'bitbucket' as any, // Unsupported provider
        folder: 'todos'
      });

      await expect(
        gitService.createOrUpdateTodo('todos/test.md', '# Test', 'feat: Add test')
      ).rejects.toThrow('Unsupported Git provider');
    });
  });
});