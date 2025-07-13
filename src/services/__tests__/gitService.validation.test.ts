import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the service dependencies
vi.mock('../githubService', () => ({
  getFileMetadata: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
}));

vi.mock('../gitlabService', () => ({
  getFileMetadata: vi.fn(),
  moveTaskToArchive: vi.fn(),
  moveTaskFromArchive: vi.fn(),
}));

// Mock localStorage to control getGitSettings return values
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

describe('gitService - Validation Error Paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  describe('moveTaskToArchive validation errors', () => {
    it('should throw error for incomplete GitHub settings - missing PAT', async () => {
      // Mock localStorage to return settings with missing PAT
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        provider: 'github',
        // pat missing
        owner: 'testowner',
        repo: 'testrepo'
      }));

      const { moveTaskToArchive } = await import('../gitService');

      await expect(moveTaskToArchive(
        'todos/task.md',
        '# Task content',
        'Archive task',
        'todos'
      )).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitHub settings - missing owner', async () => {
      // Mock localStorage to return settings with missing owner
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        provider: 'github',
        pat: 'token123',
        // owner missing
        repo: 'testrepo'
      }));

      const { moveTaskToArchive } = await import('../gitService');

      await expect(moveTaskToArchive(
        'todos/task.md',
        '# Task content',
        'Archive task',
        'todos'
      )).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });

    it('should throw error for incomplete GitHub settings - missing repo', async () => {
      // Mock localStorage to return settings with missing repo
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        provider: 'github',
        pat: 'token123',
        owner: 'testowner'
        // repo missing
      }));

      const { moveTaskToArchive } = await import('../gitService');

      await expect(moveTaskToArchive(
        'todos/task.md',
        '# Task content',
        'Archive task',
        'todos'
      )).rejects.toThrow('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    });
  });
});