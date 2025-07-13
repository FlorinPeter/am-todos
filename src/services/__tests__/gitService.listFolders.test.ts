import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockLoadSettings = vi.fn();
vi.mock('../../utils/localStorage', () => ({
  loadSettings: mockLoadSettings,
}));

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

// Mock github and gitlab services
const mockGithubService = {
  listProjectFolders: vi.fn(),
};
const mockGitlabService = {
  listProjectFolders: vi.fn(),
};

vi.mock('../githubService', () => mockGithubService);
vi.mock('../gitlabService', () => mockGitlabService);

describe('gitService - listProjectFolders Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('listProjectFolders function - remaining lines', () => {
    it('should throw error for incomplete GitHub settings in listProjectFolders', async () => {
      // Mock incomplete GitHub settings - covers lines 405-406
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        owner: 'testowner',
        repo: 'testrepo',
        // pat: missing
      });

      const { listProjectFolders } = await import('../gitService');

      await expect(listProjectFolders())
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings in listProjectFolders', async () => {
      // Mock incomplete GitLab settings - covers lines 412-413
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        // token: missing
      });

      const { listProjectFolders } = await import('../gitService');

      await expect(listProjectFolders())
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should successfully return GitLab folders and log result', async () => {
      // Mock complete GitLab settings - covers lines 421-422
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
      });

      const expectedFolders = ['todos', 'work-projects', 'personal'];
      mockGitlabService.listProjectFolders.mockResolvedValueOnce(expectedFolders);

      const { listProjectFolders } = await import('../gitService');

      const result = await listProjectFolders();

      expect(mockGitlabService.listProjectFolders).toHaveBeenCalledWith({
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
        branch: 'main'
      });
      
      // Check that it logged the result and returned it (lines 421-422)
      expect(mockLogger.log).toHaveBeenCalledWith('gitService: GitLab folders:', expectedFolders);
      expect(result).toEqual(expectedFolders);
    });

    it('should throw error for unsupported Git provider in listProjectFolders', async () => {
      // Mock unsupported provider - covers lines 428-429
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unsupported',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const { listProjectFolders } = await import('../gitService');

      await expect(listProjectFolders())
        .rejects.toThrow('Unsupported Git provider');
    });
  });
});