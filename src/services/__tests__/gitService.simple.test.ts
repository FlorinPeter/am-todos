import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the localStorage module
const mockLoadSettings = vi.fn();
vi.mock('../../utils/localStorage', () => ({
  loadSettings: mockLoadSettings,
}));

// Mock the service modules
const mockGithubService = {
  createOrUpdateTodo: vi.fn(),
  ensureDirectory: vi.fn(),
  getTodos: vi.fn(),
  getFileContent: vi.fn(),
  getFileMetadata: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
  deleteFile: vi.fn(),
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn(),
  listProjectFolders: vi.fn(),
  createProjectFolder: vi.fn(),
};

const mockGitlabService = {
  createOrUpdateTodo: vi.fn(),
  ensureDirectory: vi.fn(),
  getTodos: vi.fn(),
  getFileContent: vi.fn(),
  getFileMetadata: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
  deleteFile: vi.fn(),
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn(),
  listProjectFolders: vi.fn(),
  createProjectFolder: vi.fn(),
};

vi.mock('../githubService', () => mockGithubService);
vi.mock('../gitlabService', () => mockGitlabService);

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('gitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGitSettings', () => {
    it('should throw error when no settings configured', async () => {
      mockLoadSettings.mockReturnValue(null);
      
      const { getGitSettings } = await import('../gitService');
      
      expect(() => getGitSettings()).toThrow('No settings configured');
    });

    it('should return GitHub settings with defaults', async () => {
      mockLoadSettings.mockReturnValue({
        pat: 'test-token',
        owner: 'test-owner', 
        repo: 'test-repo'
      });
      
      const { getGitSettings } = await import('../gitService');
      const settings = getGitSettings();
      
      expect(settings.provider).toBe('github');
      expect(settings.folder).toBe('todos');
      expect(settings.pat).toBe('test-token');
    });

    it('should return GitLab settings when provider is gitlab', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'gitlab-token',
        folder: 'tasks'
      });
      
      const { getGitSettings } = await import('../gitService');
      const settings = getGitSettings();
      
      expect(settings.provider).toBe('gitlab');
      expect(settings.folder).toBe('tasks');
      expect(settings.instanceUrl).toBe('https://gitlab.com');
    });
  });

  describe('createOrUpdateTodo', () => {
    it('should delegate to GitHub service with correct parameters', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
      mockGithubService.createOrUpdateTodo.mockResolvedValue({ success: true });
      
      const { createOrUpdateTodo } = await import('../gitService');
      await createOrUpdateTodo('path', 'content', 'commit', 'sha');
      
      expect(mockGithubService.createOrUpdateTodo).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path', 'content', 'commit', 'sha'
      );
    });

    it('should delegate to GitLab service with correct parameters', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'token'
      });
      mockGitlabService.createOrUpdateTodo.mockResolvedValue({ success: true });
      
      const { createOrUpdateTodo } = await import('../gitService');
      await createOrUpdateTodo('path', 'content', 'commit');
      
      expect(mockGitlabService.createOrUpdateTodo).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          branch: 'main'
        },
        'path', 'content', 'commit'
      );
    });

    it('should throw error for incomplete GitHub settings', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token'
        // missing owner and repo
      });
      
      const { createOrUpdateTodo } = await import('../gitService');
      
      await expect(createOrUpdateTodo('path', 'content', 'commit'))
        .rejects.toThrow('GitHub settings incomplete');
    });

    it('should throw error for incomplete GitLab settings', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com'
        // missing projectId and token
      });
      
      const { createOrUpdateTodo } = await import('../gitService');
      
      await expect(createOrUpdateTodo('path', 'content', 'commit'))
        .rejects.toThrow('GitLab settings incomplete');
    });

    it('should throw error for unsupported provider', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'bitbucket' // unsupported
      });
      
      const { createOrUpdateTodo } = await import('../gitService');
      
      await expect(createOrUpdateTodo('path', 'content', 'commit'))
        .rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('getTodos', () => {
    it('should delegate to GitHub with default folder', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
      mockGithubService.getTodos.mockResolvedValue(['todo1']);
      
      const { getTodos } = await import('../gitService');
      const result = await getTodos();
      
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'todos', false
      );
      expect(result).toEqual(['todo1']);
    });

    it('should handle custom folder and includeArchived', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
      mockGithubService.getTodos.mockResolvedValue(['archived']);
      
      const { getTodos } = await import('../gitService');
      await getTodos('custom-folder', true);
      
      expect(mockGithubService.getTodos).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'custom-folder', true
      );
    });
  });

  describe('deleteFile', () => {
    it('should get metadata first for GitHub then delete', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
      mockGithubService.getFileMetadata.mockResolvedValue({ sha: 'file-sha' });
      mockGithubService.deleteFile.mockResolvedValue({ success: true });
      
      const { deleteFile } = await import('../gitService');
      await deleteFile('path', 'commit');
      
      expect(mockGithubService.getFileMetadata).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path'
      );
      expect(mockGithubService.deleteFile).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path', 'file-sha', 'commit'
      );
    });

    it('should delete directly for GitLab', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'token'
      });
      mockGitlabService.deleteFile.mockResolvedValue({ success: true });
      
      const { deleteFile } = await import('../gitService');
      await deleteFile('path', 'commit');
      
      expect(mockGitlabService.deleteFile).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          branch: 'main'
        },
        'path', 'commit'
      );
    });
  });

  describe('listProjectFolders', () => {
    it('should handle GitLab errors and re-throw', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: '123',
        token: 'token'
      });
      const error = new Error('Network error');
      mockGitlabService.listProjectFolders.mockRejectedValue(error);
      
      const { listProjectFolders } = await import('../gitService');
      
      await expect(listProjectFolders()).rejects.toThrow('Network error');
    });

    it('should return folders from GitHub', async () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
      mockGithubService.listProjectFolders.mockResolvedValue(['folder1', 'folder2']);
      
      const { listProjectFolders } = await import('../gitService');
      const result = await listProjectFolders();
      
      expect(result).toEqual(['folder1', 'folder2']);
    });
  });

  describe('other service methods', () => {
    const setupGitHub = () => {
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'token',
        owner: 'owner',
        repo: 'repo'
      });
    };

    it('should delegate ensureDirectory', async () => {
      setupGitHub();
      mockGithubService.ensureDirectory.mockResolvedValue();
      
      const { ensureDirectory } = await import('../gitService');
      await ensureDirectory('folder', 'commit');
      
      expect(mockGithubService.ensureDirectory).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'folder', 'commit'
      );
    });

    it('should delegate getFileContent', async () => {
      setupGitHub();
      mockGithubService.getFileContent.mockResolvedValue('content');
      
      const { getFileContent } = await import('../gitService');
      const result = await getFileContent('path');
      
      expect(result).toBe('content');
      expect(mockGithubService.getFileContent).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path'
      );
    });

    it('should delegate getFileMetadata', async () => {
      setupGitHub();
      mockGithubService.getFileMetadata.mockResolvedValue({ sha: 'sha' });
      
      const { getFileMetadata } = await import('../gitService');
      const result = await getFileMetadata('path');
      
      expect(result).toEqual({ sha: 'sha' });
    });

    it('should delegate moveTaskToArchive', async () => {
      setupGitHub();
      mockGithubService.moveTaskToArchive.mockResolvedValue();
      
      const { moveTaskToArchive } = await import('../gitService');
      await moveTaskToArchive('path', 'content', 'commit', 'folder');
      
      expect(mockGithubService.moveTaskToArchive).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path', 'content', 'commit', 'folder'
      );
    });

    it('should delegate moveTaskFromArchive', async () => {
      setupGitHub();
      mockGithubService.moveTaskFromArchive.mockResolvedValue();
      
      const { moveTaskFromArchive } = await import('../gitService');
      await moveTaskFromArchive('path', 'content', 'commit', 'folder');
      
      expect(mockGithubService.moveTaskFromArchive).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'path', 'content', 'commit', 'folder'
      );
    });

    it('should delegate getFileHistory', async () => {
      setupGitHub();
      mockGithubService.getFileHistory.mockResolvedValue([]);
      
      const { getFileHistory } = await import('../gitService');
      const result = await getFileHistory('path');
      
      expect(result).toEqual([]);
    });

    it('should delegate getFileAtCommit', async () => {
      setupGitHub();
      mockGithubService.getFileAtCommit.mockResolvedValue('old-content');
      
      const { getFileAtCommit } = await import('../gitService');
      const result = await getFileAtCommit('path', 'sha');
      
      expect(result).toBe('old-content');
    });

    it('should delegate createProjectFolder', async () => {
      setupGitHub();
      mockGithubService.createProjectFolder.mockResolvedValue();
      
      const { createProjectFolder } = await import('../gitService');
      await createProjectFolder('new-folder');
      
      expect(mockGithubService.createProjectFolder).toHaveBeenCalledWith(
        'token', 'owner', 'repo', 'new-folder'
      );
    });
  });
});