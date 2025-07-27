import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as gitService from '../gitService';
import * as githubService from '../githubService';
import * as gitlabService from '../gitlabService';
import { loadSettings } from '../../utils/localStorage';
import logger from '../../utils/logger';

// Mock all the service dependencies
vi.mock('../githubService');
vi.mock('../gitlabService');
vi.mock('../../utils/localStorage');
vi.mock('../../utils/logger');

describe('Git Service Router - Comprehensive Coverage', () => {
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
      expect(settings.folder).toBe('todos');
      expect(settings.branch).toBe('main');
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
      expect(settings.folder).toBe('todos');
    });

    it('should use new dual-configuration format for GitHub', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        github: {
          pat: 'new-github-token',
          owner: 'new-test-user',
          repo: 'new-test-repo',
          branch: 'develop'
        },
        folder: 'custom-folder'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('github');
      expect(settings.pat).toBe('new-github-token');
      expect(settings.owner).toBe('new-test-user');
      expect(settings.repo).toBe('new-test-repo');
      expect(settings.branch).toBe('develop');
      expect(settings.folder).toBe('custom-folder');
    });

    it('should use new dual-configuration format for GitLab', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        gitlab: {
          instanceUrl: 'https://custom-gitlab.com',
          projectId: '67890',
          token: 'new-gitlab-token',
          branch: 'develop'
        },
        folder: 'custom-folder'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('gitlab');
      expect(settings.instanceUrl).toBe('https://custom-gitlab.com');
      expect(settings.projectId).toBe('67890');
      expect(settings.token).toBe('new-gitlab-token');
      expect(settings.branch).toBe('develop');
      expect(settings.folder).toBe('custom-folder');
    });

    it('should fallback to legacy GitHub settings format', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        // No github object, should use legacy direct fields
        pat: 'legacy-github-token',
        owner: 'legacy-user',
        repo: 'legacy-repo',
        folder: 'legacy-folder'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('github');
      expect(settings.pat).toBe('legacy-github-token');
      expect(settings.owner).toBe('legacy-user');
      expect(settings.repo).toBe('legacy-repo');
      expect(settings.folder).toBe('legacy-folder');
      expect(settings.branch).toBe('main');
    });

    it('should fallback to legacy GitLab settings format', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        // No gitlab object, should use legacy direct fields
        instanceUrl: 'https://legacy-gitlab.com',
        projectId: 'legacy-project',
        token: 'legacy-token',
        folder: 'legacy-folder'
      });

      const settings = gitService.getGitSettings();

      expect(settings.provider).toBe('gitlab');
      expect(settings.instanceUrl).toBe('https://legacy-gitlab.com');
      expect(settings.projectId).toBe('legacy-project');
      expect(settings.token).toBe('legacy-token');
      expect(settings.folder).toBe('legacy-folder');
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

    it('should default to todos folder when none specified', () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
        // No folder specified
      });

      const settings = gitService.getGitSettings();

      expect(settings.folder).toBe('todos');
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

  describe('ensureDirectory', () => {
    it('should route to GitHub service for directory creation', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockResult = { message: 'Directory created' };
      (githubService.ensureDirectory as any).mockResolvedValue(mockResult);

      const result = await gitService.ensureDirectory('todos', 'feat: Create directory');

      expect(githubService.ensureDirectory).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos',
        'feat: Create directory'
      );
      expect(result).toBe(mockResult);
    });

    it('should route to GitLab service for directory creation', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockResult = { message: 'Directory created' };
      (gitlabService.ensureDirectory as any).mockResolvedValue(mockResult);

      const result = await gitService.ensureDirectory('todos');

      expect(gitlabService.ensureDirectory).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos',
        undefined
      );
      expect(result).toBe(mockResult);
    });

    it('should throw error for GitHub incomplete settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        // Missing owner and repo
      });

      await expect(gitService.ensureDirectory('todos')).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for GitLab incomplete settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        // Missing projectId and token
      });

      await expect(gitService.ensureDirectory('todos')).rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for unsupported provider', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'bitbucket' as any
      });

      await expect(gitService.ensureDirectory('todos')).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('getFileContent', () => {
    it('should route to GitHub service for file content retrieval', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockContent = { content: 'File content', sha: 'abc123' };
      (githubService.getFileContent as any).mockResolvedValue(mockContent);

      const result = await gitService.getFileContent('todos/test.md');

      expect(githubService.getFileContent).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toBe(mockContent);
    });

    it('should route to GitLab service for file content retrieval', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockContent = { content: 'File content' };
      (gitlabService.getFileContent as any).mockResolvedValue(mockContent);

      const result = await gitService.getFileContent('todos/test.md');

      expect(gitlabService.getFileContent).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md'
      );
      expect(result).toBe(mockContent);
    });

    it('should throw error for unsupported provider', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'bitbucket' as any
      });

      await expect(gitService.getFileContent('test.md')).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('getFileMetadata', () => {
    it('should route to GitHub service for file metadata retrieval', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockMetadata = { sha: 'abc123', size: 100 };
      (githubService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const result = await gitService.getFileMetadata('todos/test.md');

      expect(githubService.getFileMetadata).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toBe(mockMetadata);
    });

    it('should route to GitLab service for file metadata retrieval', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockMetadata = { file_path: 'todos/test.md', size: 100 };
      (gitlabService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const result = await gitService.getFileMetadata('todos/test.md');

      expect(gitlabService.getFileMetadata).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md'
      );
      expect(result).toBe(mockMetadata);
    });
  });

  describe('moveTaskToArchive', () => {
    it('should route to GitHub service for archiving task', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockResult = { message: 'Task archived' };
      (githubService.moveTaskToArchive as any).mockResolvedValue(mockResult);

      const result = await gitService.moveTaskToArchive(
        'todos/test.md',
        '# Test content',
        'feat: Archive task',
        'custom-folder'
      );

      expect(githubService.moveTaskToArchive).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md',
        '# Test content',
        'feat: Archive task',
        'custom-folder'
      );
      expect(result).toBe(mockResult);
    });

    it('should route to GitLab service for archiving task', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockResult = { message: 'Task archived' };
      (gitlabService.moveTaskToArchive as any).mockResolvedValue(mockResult);

      const result = await gitService.moveTaskToArchive(
        'todos/test.md',
        '# Test content',
        'feat: Archive task'
      );

      expect(gitlabService.moveTaskToArchive).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md',
        '# Test content',
        'feat: Archive task',
        'todos'
      );
      expect(result).toBe(mockResult);
    });

    it('should use default folder when not specified', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      (githubService.moveTaskToArchive as any).mockResolvedValue({});

      await gitService.moveTaskToArchive('todos/test.md', 'content', 'commit');

      expect(githubService.moveTaskToArchive).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md',
        'content',
        'commit',
        'todos'
      );
    });
  });

  describe('moveTaskFromArchive', () => {
    it('should route to GitHub service for unarchiving task', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockResult = { message: 'Task unarchived' };
      (githubService.moveTaskFromArchive as any).mockResolvedValue(mockResult);

      const result = await gitService.moveTaskFromArchive(
        'todos/archive/test.md',
        '# Test content',
        'feat: Unarchive task',
        'custom-folder'
      );

      expect(githubService.moveTaskFromArchive).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/archive/test.md',
        '# Test content',
        'feat: Unarchive task',
        'custom-folder'
      );
      expect(result).toBe(mockResult);
    });

    it('should route to GitLab service for unarchiving task', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockResult = { message: 'Task unarchived' };
      (gitlabService.moveTaskFromArchive as any).mockResolvedValue(mockResult);

      const result = await gitService.moveTaskFromArchive(
        'todos/archive/test.md',
        '# Test content',
        'feat: Unarchive task'
      );

      expect(gitlabService.moveTaskFromArchive).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/archive/test.md',
        '# Test content',
        'feat: Unarchive task',
        'todos'
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getFileHistory', () => {
    it('should route to GitHub service for file history', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockHistory = [{ sha: 'abc123', message: 'Initial commit' }];
      (githubService.getFileHistory as any).mockResolvedValue(mockHistory);

      const result = await gitService.getFileHistory('todos/test.md');

      expect(githubService.getFileHistory).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md'
      );
      expect(result).toBe(mockHistory);
    });

    it('should route to GitLab service for file history', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockHistory = [{ id: 'def456', message: 'Initial commit' }];
      (gitlabService.getFileHistory as any).mockResolvedValue(mockHistory);

      const result = await gitService.getFileHistory('todos/test.md');

      expect(gitlabService.getFileHistory).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md'
      );
      expect(result).toBe(mockHistory);
    });
  });

  describe('getFileAtCommit', () => {
    it('should route to GitHub service for file at specific commit', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockContent = { content: 'Historical content', sha: 'abc123' };
      (githubService.getFileAtCommit as any).mockResolvedValue(mockContent);

      const result = await gitService.getFileAtCommit('todos/test.md', 'abc123');

      expect(githubService.getFileAtCommit).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'todos/test.md',
        'abc123'
      );
      expect(result).toBe(mockContent);
    });

    it('should route to GitLab service for file at specific commit', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockContent = { content: 'Historical content' };
      (gitlabService.getFileAtCommit as any).mockResolvedValue(mockContent);

      const result = await gitService.getFileAtCommit('todos/test.md', 'def456');

      expect(gitlabService.getFileAtCommit).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'todos/test.md',
        'def456'
      );
      expect(result).toBe(mockContent);
    });
  });

  describe('listProjectFolders', () => {
    it('should route to GitHub service for listing folders with logging', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockFolders = ['todos', 'notes', 'docs'];
      (githubService.listProjectFolders as any).mockResolvedValue(mockFolders);

      const result = await gitService.listProjectFolders();

      expect(githubService.listProjectFolders).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo'
      );
      expect(result).toBe(mockFolders);
      expect(logger.log).toHaveBeenCalledWith('gitService: listProjectFolders called with provider:', 'github');
      expect(logger.log).toHaveBeenCalledWith('gitService: GitHub folders:', mockFolders);
    });

    it('should route to GitLab service for listing folders with logging', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockFolders = ['todos', 'notes', 'docs'];
      (gitlabService.listProjectFolders as any).mockResolvedValue(mockFolders);

      const result = await gitService.listProjectFolders();

      expect(gitlabService.listProjectFolders).toHaveBeenCalledWith({
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main'
      });
      expect(result).toBe(mockFolders);
      expect(logger.log).toHaveBeenCalledWith('gitService: listProjectFolders called with provider:', 'gitlab');
      expect(logger.log).toHaveBeenCalledWith('gitService: GitLab folders:', mockFolders);
    });

    it('should handle GitLab errors with logging', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const error = new Error('GitLab API error');
      (gitlabService.listProjectFolders as any).mockRejectedValue(error);

      await expect(gitService.listProjectFolders()).rejects.toThrow('GitLab API error');
      expect(logger.error).toHaveBeenCalledWith('gitService: GitLab listProjectFolders error:', error);
    });

    it('should throw error for incomplete GitHub settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token'
        // Missing owner and repo
      });

      await expect(gitService.listProjectFolders()).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com'
        // Missing projectId and token
      });

      await expect(gitService.listProjectFolders()).rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for unsupported provider', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'bitbucket' as any
      });

      await expect(gitService.listProjectFolders()).rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('createProjectFolder', () => {
    it('should route to GitHub service for folder creation', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token',
        owner: 'test-user',
        repo: 'test-repo'
      });

      const mockResult = undefined; // Void return
      (githubService.createProjectFolder as any).mockResolvedValue(mockResult);

      const result = await gitService.createProjectFolder('new-project');

      expect(githubService.createProjectFolder).toHaveBeenCalledWith(
        'github-token',
        'test-user',
        'test-repo',
        'new-project'
      );
      expect(result).toBe(mockResult);
    });

    it('should route to GitLab service for folder creation', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '12345',
        token: 'gitlab-token'
      });

      const mockResult = undefined; // Void return
      (gitlabService.createProjectFolder as any).mockResolvedValue(mockResult);

      const result = await gitService.createProjectFolder('new-project');

      expect(gitlabService.createProjectFolder).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        },
        'new-project'
      );
      expect(result).toBe(mockResult);
    });

    it('should throw error for incomplete GitHub settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'github',
        pat: 'github-token'
        // Missing owner and repo
      });

      await expect(gitService.createProjectFolder('new-project')).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com'
        // Missing projectId and token
      });

      await expect(gitService.createProjectFolder('new-project')).rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for unsupported provider', async () => {
      (loadSettings as any).mockReturnValue({
        gitProvider: 'bitbucket' as any
      });

      await expect(gitService.createProjectFolder('new-project')).rejects.toThrow('Unsupported Git provider');
    });
  });
});