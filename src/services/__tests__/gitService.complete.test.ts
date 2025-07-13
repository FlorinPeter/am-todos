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
  getFileAtCommit: vi.fn(),
  getFileMetadata: vi.fn(),
  deleteFile: vi.fn(),
  getFileHistory: vi.fn(),
};
const mockGitlabService = {
  getFileAtCommit: vi.fn(),
  getFileHistory: vi.fn(),
  deleteFile: vi.fn(),
};

vi.mock('../githubService', () => mockGithubService);
vi.mock('../gitlabService', () => mockGitlabService);

describe('gitService - Complete Delegation Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getFileAtCommit function - all delegation paths', () => {
    it('should throw error for incomplete GitHub settings in getFileAtCommit', async () => {
      // Mock incomplete GitHub settings - covers lines 374-375
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        owner: 'testowner',
        repo: 'testrepo',
        // pat: missing
      });

      const { getFileAtCommit } = await import('../gitService');

      await expect(getFileAtCommit('test/path.md', 'abc123'))
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings in getFileAtCommit', async () => {
      // Mock incomplete GitLab settings - covers lines 378-379
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        // token: missing
      });

      const { getFileAtCommit } = await import('../gitService');

      await expect(getFileAtCommit('test/path.md', 'abc123'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should successfully call GitLab service for getFileAtCommit', async () => {
      // Mock complete GitLab settings - covers lines 381-390
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
      });

      mockGitlabService.getFileAtCommit.mockResolvedValueOnce({ content: 'file content' });

      const { getFileAtCommit } = await import('../gitService');

      const result = await getFileAtCommit('test/path.md', 'abc123');

      expect(mockGitlabService.getFileAtCommit).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: 'testproject',
          token: 'testtoken',
          branch: 'main'
        },
        'test/path.md',
        'abc123'
      );
      expect(result).toEqual({ content: 'file content' });
    });

    it('should throw error for unsupported Git provider in getFileAtCommit', async () => {
      // Mock unsupported provider - covers lines 392-393
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unsupported',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const { getFileAtCommit } = await import('../gitService');

      await expect(getFileAtCommit('test/path.md', 'abc123'))
        .rejects.toThrow('Unsupported Git provider');
    });

    it('should successfully call GitHub service for getFileAtCommit', async () => {
      // Test successful GitHub delegation to ensure we're covering the happy path too
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      mockGithubService.getFileAtCommit.mockResolvedValueOnce({ content: 'github content' });

      const { getFileAtCommit } = await import('../gitService');

      const result = await getFileAtCommit('test/path.md', 'abc123');

      expect(mockGithubService.getFileAtCommit).toHaveBeenCalledWith(
        'testpat',
        'testowner', 
        'testrepo',
        'test/path.md',
        'abc123'
      );
      expect(result).toEqual({ content: 'github content' });
    });
  });

  describe('deleteFile function - GitHub delegation with metadata fetch', () => {
    it('should successfully call GitHub service for deleteFile with metadata fetch', async () => {
      // Test the GitHub deleteFile path that requires fetching metadata first (covers lines around 315-317)
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      // Mock the metadata fetch first
      mockGithubService.getFileMetadata.mockResolvedValueOnce({ sha: 'file-sha-123' });
      mockGithubService.deleteFile.mockResolvedValueOnce({ message: 'File deleted' });

      const { deleteFile } = await import('../gitService');

      const result = await deleteFile('test/path.md', 'Delete test file');

      // Should fetch metadata first to get SHA
      expect(mockGithubService.getFileMetadata).toHaveBeenCalledWith(
        'testpat',
        'testowner',
        'testrepo',
        'test/path.md'
      );

      // Then delete with the SHA
      expect(mockGithubService.deleteFile).toHaveBeenCalledWith(
        'testpat',
        'testowner',
        'testrepo',
        'test/path.md',
        'file-sha-123',
        'Delete test file'
      );

      expect(result).toEqual({ message: 'File deleted' });
    });

    it('should throw error for incomplete GitLab settings in deleteFile', async () => {
      // Mock incomplete GitLab settings - covers lines 320-321
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        // token: missing
      });

      const { deleteFile } = await import('../gitService');

      await expect(deleteFile('test/path.md', 'Delete test file'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should successfully call GitLab service for deleteFile', async () => {
      // Test successful GitLab deletion (covers GitLab delegation path)
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
      });

      mockGitlabService.deleteFile.mockResolvedValueOnce({ message: 'GitLab file deleted' });

      const { deleteFile } = await import('../gitService');

      const result = await deleteFile('test/path.md', 'Delete test file');

      expect(mockGitlabService.deleteFile).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: 'testproject',
          token: 'testtoken',
          branch: 'main'
        },
        'test/path.md',
        'Delete test file'
      );

      expect(result).toEqual({ message: 'GitLab file deleted' });
    });

    it('should throw error for unsupported Git provider in deleteFile', async () => {
      // Mock unsupported provider - covers lines 333-334
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unsupported',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const { deleteFile } = await import('../gitService');

      await expect(deleteFile('test/path.md', 'Delete test file'))
        .rejects.toThrow('Unsupported Git provider');
    });
  });

  describe('getFileHistory function - all delegation paths', () => {
    it('should throw error for incomplete GitHub settings in getFileHistory', async () => {
      // Mock incomplete GitHub settings - covers lines 345-346
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        owner: 'testowner',
        repo: 'testrepo',
        // pat: missing
      });

      const { getFileHistory } = await import('../gitService');

      await expect(getFileHistory('test/path.md'))
        .rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitLab settings in getFileHistory', async () => {
      // Mock incomplete GitLab settings - covers lines 349-350
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        // token: missing
      });

      const { getFileHistory } = await import('../gitService');

      await expect(getFileHistory('test/path.md'))
        .rejects.toThrow('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    });

    it('should successfully call GitLab service for getFileHistory', async () => {
      // Mock complete GitLab settings - covers lines 352-360
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        instanceUrl: 'https://gitlab.com',
        projectId: 'testproject',
        token: 'testtoken',
      });

      const expectedHistory = [{ sha: 'abc123', message: 'Initial commit' }];
      mockGitlabService.getFileHistory.mockResolvedValueOnce(expectedHistory);

      const { getFileHistory } = await import('../gitService');

      const result = await getFileHistory('test/path.md');

      expect(mockGitlabService.getFileHistory).toHaveBeenCalledWith(
        {
          instanceUrl: 'https://gitlab.com',
          projectId: 'testproject',
          token: 'testtoken',
          branch: 'main'
        },
        'test/path.md'
      );
      expect(result).toEqual(expectedHistory);
    });

    it('should throw error for unsupported Git provider in getFileHistory', async () => {
      // Mock unsupported provider - covers lines 362-363
      mockLoadSettings.mockReturnValue({
        gitProvider: 'unsupported',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const { getFileHistory } = await import('../gitService');

      await expect(getFileHistory('test/path.md'))
        .rejects.toThrow('Unsupported Git provider');
    });

    it('should successfully call GitHub service for getFileHistory', async () => {
      // Test successful GitHub delegation
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        pat: 'testpat',
        owner: 'testowner',
        repo: 'testrepo',
      });

      const expectedHistory = [{ sha: 'def456', message: 'Second commit' }];
      mockGithubService.getFileHistory.mockResolvedValueOnce(expectedHistory);

      const { getFileHistory } = await import('../gitService');

      const result = await getFileHistory('test/path.md');

      expect(mockGithubService.getFileHistory).toHaveBeenCalledWith(
        'testpat',
        'testowner', 
        'testrepo',
        'test/path.md'
      );
      expect(result).toEqual(expectedHistory);
    });
  });
});