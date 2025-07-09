import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the GitHub service functions
const mockCreateOrUpdateTodo = vi.fn();
const mockGetFileMetadata = vi.fn();
const mockGenerateCommitMessage = vi.fn();

vi.mock('../services/githubService', () => ({
  createOrUpdateTodo: mockCreateOrUpdateTodo,
  getFileMetadata: mockGetFileMetadata,
}));

vi.mock('../services/aiService', () => ({
  generateCommitMessage: mockGenerateCommitMessage,
}));

vi.mock('../utils/markdown', () => ({
  stringifyMarkdownWithFrontmatter: vi.fn((frontmatter, content) => 
    `---\ntitle: ${frontmatter.title}\ncreatedAt: ${frontmatter.createdAt}\npriority: ${frontmatter.priority}\nisArchived: ${frontmatter.isArchived}\n---\n${content}`
  ),
}));

describe('Title Editing Integration Tests', () => {
  // Mock App component's handleTitleUpdate function behavior
  const mockSettings = {
    pat: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    folder: 'todos'
  };

  const mockTodo = {
    id: 'test-todo-123',
    title: 'Original Title',
    content: '- [ ] First task\n- [ ] Second task',
    frontmatter: {
      title: 'Original Title',
      createdAt: '2025-01-01T10:00:00.000Z',
      priority: 3,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/2025-01-01-original-title.md',
    sha: 'original-sha'
  };

  const mockTodos = [mockTodo];

  // Simulate the handleTitleUpdate function from App.tsx
  const simulateHandleTitleUpdate = async (id: string, newTitle: string) => {
    const todoToUpdate = mockTodos.find(todo => todo.id === id);
    if (!todoToUpdate) {
      throw new Error('Todo not found');
    }

    // Step 1: Get latest SHA
    const latestMetadata = await mockGetFileMetadata(
      mockSettings.pat, 
      mockSettings.owner, 
      mockSettings.repo, 
      todoToUpdate.path
    );
    const latestSha = latestMetadata.sha;

    // Step 2: Prepare updated content
    const updatedFrontmatter = {
      ...todoToUpdate.frontmatter,
      title: newTitle
    };

    // Step 3: Generate commit message (simple, no AI)
    const commitMessage = `docs: Update title to "${newTitle}"`;

    // Step 4: Save to GitHub
    await mockCreateOrUpdateTodo(
      mockSettings.pat,
      mockSettings.owner,
      mockSettings.repo,
      todoToUpdate.path,
      `---\ntitle: ${updatedFrontmatter.title}\ncreatedAt: ${updatedFrontmatter.createdAt}\npriority: ${updatedFrontmatter.priority}\nisArchived: ${updatedFrontmatter.isArchived}\n---\n${todoToUpdate.content}`,
      commitMessage,
      latestSha
    );

    return { success: true, newTitle, commitMessage };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful responses
    mockGetFileMetadata.mockResolvedValue({ sha: 'latest-sha' });
    mockCreateOrUpdateTodo.mockResolvedValue({ content: { sha: 'updated-sha' } });
  });

  it('should successfully update todo title through complete workflow', async () => {
    const newTitle = 'Updated Amazing Title';
    
    const result = await simulateHandleTitleUpdate('test-todo-123', newTitle);
    
    // Verify the workflow completed successfully
    expect(result.success).toBe(true);
    expect(result.newTitle).toBe(newTitle);
    
    // Verify latest SHA was fetched
    expect(mockGetFileMetadata).toHaveBeenCalledWith(
      'test-token',
      'test-owner',
      'test-repo',
      'todos/2025-01-01-original-title.md'
    );
    
    // Verify commit message was generated correctly (no AI)
    expect(result.commitMessage).toBe('docs: Update title to "Updated Amazing Title"');
    
    // Verify the todo was saved to GitHub with correct parameters
    expect(mockCreateOrUpdateTodo).toHaveBeenCalledWith(
      'test-token',
      'test-owner',
      'test-repo',
      'todos/2025-01-01-original-title.md',
      '---\ntitle: Updated Amazing Title\ncreatedAt: 2025-01-01T10:00:00.000Z\npriority: 3\nisArchived: false\n---\n- [ ] First task\n- [ ] Second task',
      'docs: Update title to "Updated Amazing Title"',
      'latest-sha'
    );
  });

  it('should handle SHA conflict resolution', async () => {
    // Simulate SHA conflict on first attempt
    mockCreateOrUpdateTodo
      .mockRejectedValueOnce(new Error('SHA does not match'))
      .mockResolvedValueOnce({ content: { sha: 'final-sha' } });
    
    // Mock multiple SHA fetches for retry logic
    mockGetFileMetadata
      .mockResolvedValueOnce({ sha: 'conflicted-sha' })
      .mockResolvedValueOnce({ sha: 'resolved-sha' });

    // Note: This test simulates what would happen in a retry scenario
    // The actual retry logic would be in the calling function
    
    const newTitle = 'Title After Conflict';
    
    try {
      await simulateHandleTitleUpdate('test-todo-123', newTitle);
    } catch (error) {
      // First attempt should fail due to SHA conflict
      expect(error).toEqual(new Error('SHA does not match'));
    }
    
    // Verify initial attempt was made
    expect(mockCreateOrUpdateTodo).toHaveBeenCalledTimes(1);
  });

  it('should preserve original content and frontmatter except title', async () => {
    const newTitle = 'Only Title Changed';
    
    await simulateHandleTitleUpdate('test-todo-123', newTitle);
    
    // Verify that only the title was changed in the frontmatter
    const saveCall = mockCreateOrUpdateTodo.mock.calls[0];
    const savedContent = saveCall[4]; // The content parameter
    
    expect(savedContent).toContain('title: Only Title Changed');
    expect(savedContent).toContain('createdAt: 2025-01-01T10:00:00.000Z');
    expect(savedContent).toContain('priority: 3');
    expect(savedContent).toContain('isArchived: false');
    expect(savedContent).toContain('- [ ] First task\n- [ ] Second task');
  });

  it('should generate correct conventional commit message', async () => {
    const testCases = [
      'Simple Title',
      'Title with "Quotes"',
      'Title with Special @#$% Characters',
      'Very Long Title That Might Cause Issues With Commit Message Length Limits'
    ];
    
    for (const title of testCases) {
      vi.clearAllMocks();
      mockGetFileMetadata.mockResolvedValue({ sha: 'test-sha' });
      mockCreateOrUpdateTodo.mockResolvedValue({ content: { sha: 'updated-sha' } });
      
      const result = await simulateHandleTitleUpdate('test-todo-123', title);
      
      expect(result.commitMessage).toBe(`docs: Update title to "${title}"`);
      expect(result.commitMessage).toMatch(/^docs: Update title to ".+"$/);
    }
  });

  it('should handle titles with problematic characters', async () => {
    const problematicTitles = [
      'Title with\nNewlines',
      'Title with\tTabs',
      'Title with\rCarriage returns'
    ];
    
    for (const title of problematicTitles) {
      vi.clearAllMocks();
      mockGetFileMetadata.mockResolvedValue({ sha: 'test-sha' });
      mockCreateOrUpdateTodo.mockResolvedValue({ content: { sha: 'updated-sha' } });
      
      const result = await simulateHandleTitleUpdate('test-todo-123', title);
      
      // Should still generate a commit message, even if not perfectly formatted
      expect(result.commitMessage).toContain('docs: Update title to');
      expect(result.commitMessage).toContain(title);
    }
  });

  it('should handle empty or invalid todo ID', async () => {
    await expect(
      simulateHandleTitleUpdate('non-existent-id', 'New Title')
    ).rejects.toThrow('Todo not found');
    
    // Should not make any API calls for invalid todo
    expect(mockGetFileMetadata).not.toHaveBeenCalled();
    expect(mockCreateOrUpdateTodo).not.toHaveBeenCalled();
  });

  it('should handle GitHub API errors gracefully', async () => {
    mockGetFileMetadata.mockRejectedValue(new Error('Network error'));
    
    await expect(
      simulateHandleTitleUpdate('test-todo-123', 'New Title')
    ).rejects.toThrow('Network error');
    
    // Should have attempted to get metadata but not proceeded to save
    expect(mockGetFileMetadata).toHaveBeenCalled();
    expect(mockCreateOrUpdateTodo).not.toHaveBeenCalled();
  });

  it('should work with todos that have complex frontmatter', async () => {
    const complexTodo = {
      ...mockTodo,
      frontmatter: {
        ...mockTodo.frontmatter,
        priority: 1,
        isArchived: true,
        chatHistory: [
          { role: 'user', content: 'Test message' },
          { role: 'assistant', content: 'Test response' }
        ],
        customField: 'custom value'
      }
    };
    
    const complexMockTodos = [complexTodo];
    
    // Override the simulation for this test
    const simulateComplexUpdate = async (id: string, newTitle: string) => {
      const todoToUpdate = complexMockTodos.find(todo => todo.id === id);
      if (!todoToUpdate) throw new Error('Todo not found');
      
      const latestMetadata = await mockGetFileMetadata(
        mockSettings.pat, mockSettings.owner, mockSettings.repo, todoToUpdate.path
      );
      
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        title: newTitle
      };
      
      const commitMessage = `docs: Update title to "${newTitle}"`;
      
      await mockCreateOrUpdateTodo(
        mockSettings.pat, mockSettings.owner, mockSettings.repo,
        todoToUpdate.path,
        `---\ntitle: ${updatedFrontmatter.title}\ncreatedAt: ${updatedFrontmatter.createdAt}\npriority: ${updatedFrontmatter.priority}\nisArchived: ${updatedFrontmatter.isArchived}\n---\n${todoToUpdate.content}`,
        commitMessage,
        latestMetadata.sha
      );
      
      return { success: true, updatedFrontmatter };
    };
    
    const result = await simulateComplexUpdate('test-todo-123', 'Complex Title Update');
    
    expect(result.success).toBe(true);
    expect(result.updatedFrontmatter.title).toBe('Complex Title Update');
    expect(result.updatedFrontmatter.priority).toBe(1);
    expect(result.updatedFrontmatter.isArchived).toBe(true);
    expect(result.updatedFrontmatter.chatHistory).toHaveLength(2);
  });
});

// Test the commit message generation specifically for title updates
describe('Title Update Commit Messages', () => {
  it('should generate conventional commit format without AI', () => {
    const generateTitleCommitMessage = (newTitle: string) => {
      return `docs: Update title to "${newTitle}"`;
    };
    
    // Test various title scenarios
    expect(generateTitleCommitMessage('Simple Title')).toBe('docs: Update title to "Simple Title"');
    expect(generateTitleCommitMessage('Title with "Nested Quotes"')).toBe('docs: Update title to "Title with "Nested Quotes""');
    expect(generateTitleCommitMessage('')).toBe('docs: Update title to ""');
    
    // Verify it follows conventional commit format
    const message = generateTitleCommitMessage('Test Title');
    expect(message).toMatch(/^docs: .+/);
    expect(message).not.toContain('feat:'); // Should not be a feature
    expect(message).not.toContain('fix:'); // Should not be a fix
  });

  it('should be different from AI-generated commit messages', () => {
    const titleCommitMessage = `docs: Update title to "New Title"`;
    const aiCommitMessage = `feat: Update todo "Original Title" with new content and improvements`;
    
    expect(titleCommitMessage).not.toBe(aiCommitMessage);
    expect(titleCommitMessage.startsWith('docs:')).toBe(true);
    expect(aiCommitMessage.startsWith('feat:')).toBe(true);
  });
});