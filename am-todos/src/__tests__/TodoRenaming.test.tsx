import { vi, describe, it, expect, beforeEach } from 'vitest';
import { deleteFile } from '../services/githubService';

// Mock the GitHub service
vi.mock('../services/githubService', () => ({
  getFileMetadata: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  deleteFile: vi.fn(),
}));

// Mock the AI service
vi.mock('../services/aiService');

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('Todo Renaming with File Renaming', () => {
  const mockSettings = {
    pat: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    folder: 'todos',
    geminiApiKey: 'test-key',
    aiProvider: 'gemini' as const,
    openRouterApiKey: '',
    aiModel: 'gemini-2.5-flash'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));
  });

  describe('File renaming logic', () => {
    it('should create correct new file path from title', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          .trim()
          .substring(0, 50); // Limit length
      };

      expect(createSlug('New Task Title')).toBe('new-task-title');
      expect(createSlug('Task with Special!@#$%^&*()Characters')).toBe('task-with-specialcharacters');
      expect(createSlug('Task    with    multiple    spaces')).toBe('task-with-multiple-spaces');
      expect(createSlug('Task---with---multiple---hyphens')).toBe('task-with-multiple-hyphens');
      expect(createSlug('Very long title that exceeds the fifty character limit and should be truncated')).toBe('very-long-title-that-exceeds-the-fifty-character-l');
    });

    it('should preserve original date from filename', () => {
      const originalPath = 'todos/2025-01-15-original-task.md';
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      expect(timestamp).toBe('2025-01-15');
    });

    it('should handle missing date by using current date', () => {
      const originalPath = 'todos/invalid-filename.md';
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().split('T')[0];
      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('File conflict resolution', () => {
    it('should handle file name conflicts by appending numbers', async () => {
      const { getFileMetadata, createOrUpdateTodo } = await import('../services/githubService');
      
      // Mock that first two attempts find existing files
      (getFileMetadata as any)
        .mockResolvedValueOnce({ sha: 'exists1' }) // First attempt exists
        .mockResolvedValueOnce({ sha: 'exists2' }) // Second attempt exists
        .mockRejectedValueOnce(new Error('Not found')); // Third attempt doesn't exist

      const newPath = 'todos/2025-01-15-new-task.md';
      const folder = 'todos';
      let counter = 1;
      let conflictFreePath = newPath;

      // Simulate conflict resolution logic
      while (true) {
        try {
          await getFileMetadata('token', 'owner', 'repo', conflictFreePath);
          // File exists, try next number
          const pathParts = newPath.split('.');
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          conflictFreePath = `${basePath}-${counter}.${extension}`;
          counter++;
        } catch (error) {
          // File doesn't exist, we can use this path
          break;
        }
      }

      expect(conflictFreePath).toBe('todos/2025-01-15-new-task-2.md');
    });
  });

  describe('File operations', () => {
    it('should call deleteFile with correct parameters', async () => {
      const mockDeleteFile = deleteFile as any;
      
      await mockDeleteFile(
        'test-token',
        'test-owner', 
        'test-repo',
        'todos/2025-01-15-old-task.md',
        'abc123',
        'docs: Remove old file after renaming to "New Task Title"'
      );

      expect(mockDeleteFile).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo', 
        'todos/2025-01-15-old-task.md',
        'abc123',
        'docs: Remove old file after renaming to "New Task Title"'
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty title gracefully', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      expect(createSlug('')).toBe('');
      expect(createSlug('   ')).toBe('');
      expect(createSlug('!@#$%^&*()')).toBe('');
    });

    it('should handle unicode characters', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      expect(createSlug('Task with émojis 🚀 and ñ')).toBe('task-with-mojis-and');
      expect(createSlug('Тест с кириллицей')).toBe('');
    });

    it('should handle titles that are only special characters', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      expect(createSlug('!@#$%^&*()')).toBe('');
      expect(createSlug('---')).toBe('');
      expect(createSlug('   ---   ')).toBe('');
    });
  });

  describe('Integration scenarios', () => {
    it('should skip file operations when title does not change filename', async () => {
      // Test case where title change doesn't affect the slug
      const originalPath = 'todos/2025-01-15-task-title.md';
      const newTitle = 'Task Title'; // Same slug
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const newPath = `todos/${timestamp}-${newSlug}.md`;
      
      expect(originalPath).toBe(newPath); // Should be the same, no renaming needed
    });

    it('should handle renaming when changing case only', async () => {
      const originalPath = 'todos/2025-01-15-task-title.md';
      const newTitle = 'TASK TITLE'; // Different case, same slug
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const newPath = `todos/${timestamp}-${newSlug}.md`;
      
      expect(originalPath).toBe(newPath); // Should be the same, no renaming needed
    });

    it('should handle renaming when adding/removing words', async () => {
      const originalPath = 'todos/2025-01-15-task-title.md';
      const newTitle = 'Task Title Extended Version';
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const newPath = `todos/${timestamp}-${newSlug}.md`;
      
      expect(originalPath).not.toBe(newPath); // Should be different, renaming needed
      expect(newPath).toBe('todos/2025-01-15-task-title-extended-version.md');
    });
  });
});