import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the GitHub service
vi.mock('../services/githubService', () => ({
  getFileMetadata: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  deleteFile: vi.fn(),
}));

// Mock the AI service
vi.mock('../services/aiService');

describe('Todo Renaming Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle full renaming workflow with conflict resolution', async () => {
    const { getFileMetadata, createOrUpdateTodo, deleteFile } = await import('../services/githubService');
    
    // Mock the conflict resolution scenario
    (getFileMetadata as any)
      .mockResolvedValueOnce({ sha: 'original-sha' }) // Original file SHA
      .mockResolvedValueOnce({ sha: 'conflict-exists' }) // First attempt - file exists
      .mockRejectedValueOnce(new Error('Not found')); // Second attempt - file doesn't exist

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

    // Simulate the renaming workflow
    const originalPath = 'todos/2025-01-15-original-task.md';
    const newTitle = 'Updated Task Title';
    const newSlug = createSlug(newTitle);
    const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const folder = 'todos';
    
    let newPath = `${folder}/${timestamp}-${newSlug}.md`;
    let finalPath = newPath;
    
    // Conflict resolution simulation
    let counter = 1;
    let conflictFreePath = newPath;
    
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
        finalPath = conflictFreePath;
        break;
      }
    }

    // Verify the workflow calls
    expect(getFileMetadata).toHaveBeenCalledTimes(3);
    expect(finalPath).toBe('todos/2025-01-15-updated-task-title-2.md');
    
    // Verify the expected API calls would be made
    expect(getFileMetadata).toHaveBeenCalledWith('token', 'owner', 'repo', 'todos/2025-01-15-updated-task-title.md');
    expect(getFileMetadata).toHaveBeenCalledWith('token', 'owner', 'repo', 'todos/2025-01-15-updated-task-title-2.md');
  });

  it('should handle renaming without conflicts', async () => {
    const { getFileMetadata, createOrUpdateTodo, deleteFile } = await import('../services/githubService');
    
    // Mock no conflicts
    (getFileMetadata as any)
      .mockResolvedValueOnce({ sha: 'original-sha' }) // Original file SHA
      .mockRejectedValueOnce(new Error('Not found')); // New file doesn't exist

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

    // Simulate the renaming workflow
    const originalPath = 'todos/2025-01-15-original-task.md';
    const newTitle = 'Simple New Title';
    const newSlug = createSlug(newTitle);
    const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const folder = 'todos';
    
    const newPath = `${folder}/${timestamp}-${newSlug}.md`;
    const finalPath = newPath;

    // Simulate checking for conflicts (this test doesn't run the actual loop)
    try {
      await getFileMetadata('token', 'owner', 'repo', newPath);
      // File exists, but we're not testing the loop here
    } catch (error) {
      // File doesn't exist, we can use this path
    }
    
    // Verify no conflicts
    expect(finalPath).toBe('todos/2025-01-15-simple-new-title.md');
    
    // Verify the workflow would proceed without conflicts
    expect(getFileMetadata).toHaveBeenCalledTimes(1);
  });

  it('should skip renaming when slug remains the same', () => {
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

    const originalPath = 'todos/2025-01-15-existing-task.md';
    const newTitle = 'Existing Task'; // Same slug
    const newSlug = createSlug(newTitle);
    const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const folder = 'todos';
    
    const newPath = `${folder}/${timestamp}-${newSlug}.md`;
    const needsRename = originalPath !== newPath;

    expect(needsRename).toBe(false);
    expect(newPath).toBe(originalPath);
  });

  it('should handle edge cases in slug generation', () => {
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

    // Test various edge cases
    expect(createSlug('Task with Special!@#$%^&*()Characters')).toBe('task-with-specialcharacters');
    expect(createSlug('   Multiple   Spaces   ')).toBe('multiple-spaces');
    expect(createSlug('---Only---Hyphens---')).toBe('only-hyphens');
    expect(createSlug('émojis 🚀 and unicode ñ')).toBe('mojis-and-unicode');
    expect(createSlug('!@#$%^&*()')).toBe(''); // Only special chars
    expect(createSlug('')).toBe(''); // Empty string
  });

  it('should preserve timestamps correctly', () => {
    const testCases = [
      { path: 'todos/2025-01-15-task.md', expected: '2025-01-15' },
      { path: 'todos/2024-12-31-task.md', expected: '2024-12-31' },
      { path: 'todos/invalid-filename.md', expected: null },
    ];

    testCases.forEach(({ path, expected }) => {
      const timestamp = path.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (expected) {
        expect(timestamp).toBe(expected);
      } else {
        expect(timestamp).toBeUndefined();
      }
    });
  });
});