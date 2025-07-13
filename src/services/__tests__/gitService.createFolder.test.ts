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
  createProjectFolder: vi.fn(),
};
const mockGitlabService = {
  createProjectFolder: vi.fn(),
};

vi.mock('../githubService', () => mockGithubService);
vi.mock('../gitlabService', () => mockGitlabService);

describe('gitService - createProjectFolder Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('createProjectFolder function - error paths', () => {
    it('should throw error for incomplete GitHub settings - missing PAT', async () => {
      // Mock incomplete GitHub settings (missing PAT) - covers lines 440-441
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        owner: 'testowner',
        repo: 'testrepo',
        // pat: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitHub settings - missing owner', async () => {
      // Mock incomplete GitHub settings (missing owner) - covers lines 440-441
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        repo: 'testrepo',
        // owner: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitHub settings - missing repo', async () => {
      // Mock incomplete GitHub settings (missing repo) - covers lines 440-441
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        owner: 'testowner',
        // repo: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings - missing instanceUrl', async () => {
      // Mock incomplete GitLab settings (missing instanceUrl) - covers lines 444-445
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        projectId: 'testproject',
        token: 'testtoken',
        // instanceUrl: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for incomplete GitLab settings - missing projectId', async () => {
      // Mock incomplete GitLab settings (missing projectId) - covers lines 444-445
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        token: 'testtoken',
        // projectId: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for incomplete GitLab settings - missing token', async () => {
      // Mock incomplete GitLab settings (missing token) - covers lines 444-445
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        // token: missing
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should throw error for unsupported Git provider', async () => {
      // Mock unsupported provider - covers lines 457-458
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unsupported',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const { createProjectFolder } = await import('../gitService');

      await expect(createProjectFolder('testfolder'))
        .rejects.toThrow('Unsupported Git provider');
    });

    it('should successfully call GitHub service with complete settings', async () => {
      // Mock complete GitHub settings - covers lines 442
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      mockGithubService.createProjectFolder.mockResolvedValueOnce('success');

      const { createProjectFolder } = await import('../gitService');

      const result = await createProjectFolder('testfolder');

      expect(mockGithubService.createProjectFolder).toHaveBeenCalledWith(
        'testpat',
        'testowner',
        'testrepo',
        'testfolder'
      );
      expect(result).toBe('success');
    });

    it('should successfully call GitLab service with complete settings', async () => {
      // Mock complete GitLab settings - covers lines 447-455
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
      });

      mockGitlabService.createProjectFolder.mockResolvedValueOnce('success');

      const { createProjectFolder } = await import('../gitService');

      const result = await createProjectFolder('testfolder');

      expect(mockGitlabService.createProjectFolder).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: 'testproject',
          token: 'testtoken',
          branch: 'main'
        },
        'testfolder'
      );
      expect(result).toBe('success');
    });
  });
});