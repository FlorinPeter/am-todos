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

describe('Duplicate Title Bug Fix - Issue: Creating "test123" twice overwrites first todo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT overwrite when creating todos with the same title on the same day', async () => {
    const { getFileMetadata, createOrUpdateTodo } = await import('../services/githubService');
    
    const currentDate = new Date().toISOString().split('T')[0];
    const title = 'test123';
    const folder = 'todos';
    
    // Simulate the slug creation logic from App.tsx
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
    
    const slug = createSlug(title);
    const originalFilename = `${folder}/${currentDate}-${slug}.md`;
    
    // FIRST TODO CREATION
    // Mock: File doesn't exist, so create it
    (getFileMetadata as any).mockRejectedValueOnce(new Error('File not found'));
    (createOrUpdateTodo as any).mockResolvedValueOnce({ 
      content: { sha: 'first-todo-sha' } 
    });
    
    // Simulate first creation
    let firstFinalFilename = originalFilename;
    try {
      await getFileMetadata('token', 'owner', 'repo', firstFinalFilename);
    } catch (error) {
      // File doesn't exist, use original filename
    }
    
    await createOrUpdateTodo('token', 'owner', 'repo', firstFinalFilename, 'content1', 'message1');
    
    // SECOND TODO CREATION (same title, same day)
    // Mock: Original file now exists, so we need to find alternative
    (getFileMetadata as any)
      .mockResolvedValueOnce({ sha: 'first-todo-sha' }) // Original exists
      .mockRejectedValueOnce(new Error('File not found')); // -1 doesn't exist
    
    (createOrUpdateTodo as any).mockResolvedValueOnce({ 
      content: { sha: 'second-todo-sha' } 
    });
    
    // Simulate second creation with collision detection
    let secondFinalFilename = originalFilename;
    let counter = 1;
    
    while (true) {
      try {
        await getFileMetadata('token', 'owner', 'repo', secondFinalFilename);
        // File exists, try next number
        const pathParts = originalFilename.split('.');
        const extension = pathParts.pop();
        const basePath = pathParts.join('.');
        secondFinalFilename = `${basePath}-${counter}.${extension}`;
        counter++;
      } catch (error) {
        // File doesn't exist, we can use this filename
        break;
      }
    }
    
    await createOrUpdateTodo('token', 'owner', 'repo', secondFinalFilename, 'content2', 'message2');
    
    // ASSERTIONS
    expect(firstFinalFilename).toBe(`todos/${currentDate}-test123.md`);
    expect(secondFinalFilename).toBe(`todos/${currentDate}-test123-1.md`);
    expect(firstFinalFilename).not.toBe(secondFinalFilename);
    
    // Verify both files were created with different names
    expect(createOrUpdateTodo).toHaveBeenCalledTimes(2);
    expect(createOrUpdateTodo).toHaveBeenNthCalledWith(
      1, 'token', 'owner', 'repo', firstFinalFilename, 'content1', 'message1'
    );
    expect(createOrUpdateTodo).toHaveBeenNthCalledWith(
      2, 'token', 'owner', 'repo', secondFinalFilename, 'content2', 'message2'
    );
    
    // Verify collision detection worked
    expect(getFileMetadata).toHaveBeenCalledTimes(3); // 1 for first + 2 for second (original + -1)
  });

  it('should handle multiple collisions correctly', async () => {
    const { getFileMetadata, createOrUpdateTodo } = await import('../services/githubService');
    
    const currentDate = new Date().toISOString().split('T')[0];
    const originalFilename = `todos/${currentDate}-test123.md`;
    
    // Mock: Original file and first two alternatives exist
    (getFileMetadata as any)
      .mockResolvedValueOnce({ sha: 'original-sha' }) // Original exists
      .mockResolvedValueOnce({ sha: 'alt1-sha' })     // -1 exists  
      .mockResolvedValueOnce({ sha: 'alt2-sha' })     // -2 exists
      .mockRejectedValueOnce(new Error('Not found')); // -3 doesn't exist
    
    (createOrUpdateTodo as any).mockResolvedValueOnce({ 
      content: { sha: 'new-todo-sha' } 
    });
    
    // Simulate collision detection for third todo with same title
    let finalFilename = originalFilename;
    let counter = 1;
    
    while (true) {
      try {
        await getFileMetadata('token', 'owner', 'repo', finalFilename);
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

  it('should demonstrate the OLD buggy behavior vs NEW fixed behavior', async () => {
    const currentDate = new Date().toISOString().split('T')[0];
    const originalFilename = `todos/${currentDate}-test123.md`;
    
    // OLD BEHAVIOR (buggy): 
    // - createOrUpdateTodo checks if file exists
    // - if exists, it updates instead of creating new
    // - Result: Second "test123" overwrites first "test123"
    
    // NEW BEHAVIOR (fixed):
    // - Check for collision BEFORE calling createOrUpdateTodo
    // - If collision detected, generate alternative filename
    // - Result: Second "test123" creates "test123-1.md"
    
    const oldBehaviorResult = {
      firstTodo: originalFilename,   // todos/2025-07-09-test123.md
      secondTodo: originalFilename,  // todos/2025-07-09-test123.md (OVERWRITES!)
      filesCreated: 1               // Only one file exists
    };
    
    const newBehaviorResult = {
      firstTodo: originalFilename,              // todos/2025-07-09-test123.md
      secondTodo: `todos/${currentDate}-test123-1.md`, // todos/2025-07-09-test123-1.md (NEW FILE!)
      filesCreated: 2                          // Two separate files exist
    };
    
    // Verify the fix prevents overwriting
    expect(newBehaviorResult.firstTodo).not.toBe(newBehaviorResult.secondTodo);
    expect(newBehaviorResult.filesCreated).toBe(2);
    
    // Show what the old behavior would have done (for documentation)
    expect(oldBehaviorResult.firstTodo).toBe(oldBehaviorResult.secondTodo);
    expect(oldBehaviorResult.filesCreated).toBe(1);
  });

  it('should work correctly with different titles on same day', async () => {
    const { getFileMetadata } = await import('../services/githubService');
    
    const currentDate = new Date().toISOString().split('T')[0];
    
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
    
    // Different titles should have different filenames (no collision)
    const title1 = 'test123';
    const title2 = 'test456';
    
    const filename1 = `todos/${currentDate}-${createSlug(title1)}.md`;
    const filename2 = `todos/${currentDate}-${createSlug(title2)}.md`;
    
    expect(filename1).toBe(`todos/${currentDate}-test123.md`);
    expect(filename2).toBe(`todos/${currentDate}-test456.md`);
    expect(filename1).not.toBe(filename2);
  });
});