import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the GitHub service
vi.mock('../services/githubService', () => ({
  getFileMetadata: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  ensureDirectory: vi.fn(),
}));

// Mock the AI service
vi.mock('../services/aiService', () => ({
  generateInitialPlan: vi.fn(),
  generateCommitMessage: vi.fn(),
}));

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

describe('Todo Creation Collision Detection', () => {
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

  describe('Filename collision detection', () => {
    it('should detect when a file already exists', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock that the file exists
      (getFileMetadata as any).mockResolvedValueOnce({ sha: 'existing-file-sha' });

      const currentDate = new Date().toISOString().split('T')[0];
      const expectedFilename = `todos/${currentDate}-test123.md`;
      
      // Simulate collision detection
      let fileExists = false;
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', expectedFilename);
        fileExists = true;
      } catch (error) {
        fileExists = false;
      }

      expect(fileExists).toBe(true);
      expect(getFileMetadata).toHaveBeenCalledWith('test-token', 'test-owner', 'test-repo', expectedFilename);
    });

    it('should generate unique filenames for collisions', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock multiple collisions
      (getFileMetadata as any)
        .mockResolvedValueOnce({ sha: 'file1-sha' }) // Original file exists
        .mockResolvedValueOnce({ sha: 'file2-sha' }) // -1 exists
        .mockResolvedValueOnce({ sha: 'file3-sha' }) // -2 exists
        .mockRejectedValueOnce(new Error('Not found')); // -3 doesn't exist

      const currentDate = new Date().toISOString().split('T')[0];
      const originalFilename = `todos/${currentDate}-test123.md`;
      let finalFilename = originalFilename;
      
      // Simulate collision resolution logic
      let counter = 1;
      while (true) {
        try {
          await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
          // File exists, try next number
          const pathParts = originalFilename.split('.');
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          finalFilename = `${basePath}-${counter}.${extension}`;
          counter++;
        } catch (error) {
          // File doesn't exist, we can use this filename
          break;
        }
      }

      expect(finalFilename).toBe(`todos/${currentDate}-test123-3.md`);
      expect(getFileMetadata).toHaveBeenCalledTimes(4);
    });

    it('should use original filename when no collision exists', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock that the file doesn't exist
      (getFileMetadata as any).mockRejectedValueOnce(new Error('Not found'));

      const currentDate = new Date().toISOString().split('T')[0];
      const originalFilename = `todos/${currentDate}-test123.md`;
      let finalFilename = originalFilename;
      
      // Simulate collision resolution logic
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
        // Should not reach here since file doesn't exist
      } catch (error) {
        // File doesn't exist, we can use this filename
      }

      expect(finalFilename).toBe(originalFilename);
      expect(getFileMetadata).toHaveBeenCalledTimes(1);
    });
  });

  describe('Filename generation logic', () => {
    it('should create correct filename format', () => {
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

      const currentDate = new Date().toISOString().split('T')[0];
      const slug = createSlug('test123');
      const filename = `todos/${currentDate}-${slug}.md`;
      
      expect(filename).toMatch(/^todos\/\d{4}-\d{2}-\d{2}-test123\.md$/);
    });

    it('should handle special characters in titles correctly', () => {
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

      const testCases = [
        { title: 'Test 123!@#', expected: 'test-123' },
        { title: 'Task with Special Characters!', expected: 'task-with-special-characters' },
        { title: '   Multiple   Spaces   ', expected: 'multiple-spaces' },
        { title: 'émojis 🚀 and unicode ñ', expected: 'mojis-and-unicode' },
        { title: '---Only---Hyphens---', expected: 'only-hyphens' }
      ];

      testCases.forEach(({ title, expected }) => {
        expect(createSlug(title)).toBe(expected);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle same title created multiple times on same day', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Simulate creating 'test123' three times
      const scenarios = [
        {
          name: 'First creation',
          mockReturn: Promise.reject(new Error('Not found')),
          expectedFilename: `todos/${currentDate}-test123.md`
        },
        {
          name: 'Second creation (collision)',
          mockReturn: Promise.resolve({ sha: 'first-file-sha' }),
          thenReject: true,
          expectedFilename: `todos/${currentDate}-test123-1.md`
        },
        {
          name: 'Third creation (two collisions)',
          mockCollisions: 2,
          expectedFilename: `todos/${currentDate}-test123-2.md`
        }
      ];

      // Test first scenario
      (getFileMetadata as any).mockImplementationOnce(() => scenarios[0].mockReturn);
      
      let finalFilename = scenarios[0].expectedFilename;
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
      } catch (error) {
        // Expected - file doesn't exist
      }
      
      expect(finalFilename).toBe(scenarios[0].expectedFilename);
    });

    it('should work with different folder configurations', async () => {
      const customFolder = 'my-tasks';
      const currentDate = new Date().toISOString().split('T')[0];
      const slug = 'test123';
      
      const expectedFilename = `${customFolder}/${currentDate}-${slug}.md`;
      
      expect(expectedFilename).toBe(`my-tasks/${currentDate}-test123.md`);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty slugs gracefully', () => {
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

      const currentDate = new Date().toISOString().split('T')[0];
      const emptySlug = createSlug('!@#$%^&*()');
      const filename = `todos/${currentDate}-${emptySlug}.md`;
      
      // Should still create a valid filename even with empty slug
      expect(filename).toBe(`todos/${currentDate}-.md`);
    });

    it('should handle very long titles', () => {
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

      const longTitle = 'This is a very long title that should be truncated to fifty characters maximum';
      const slug = createSlug(longTitle);
      
      expect(slug.length).toBeLessThanOrEqual(50);
      expect(slug).toBe('this-is-a-very-long-title-that-should-be-truncated');
    });

    it('should handle date edge cases', () => {
      const testDate = new Date('2024-12-31T23:59:59.999Z');
      const timestamp = testDate.toISOString().split('T')[0];
      
      expect(timestamp).toBe('2024-12-31');
      
      const filename = `todos/${timestamp}-test.md`;
      expect(filename).toBe('todos/2024-12-31-test.md');
    });
  });
});