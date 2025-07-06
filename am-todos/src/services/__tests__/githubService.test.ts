import { getTodos, createOrUpdateTodo, ensureTodosDirectory, getFileContent } from '../githubService';

// Mock fetch globally
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Test configuration
const TEST_CONFIG = {
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo'
};

// Helper function to generate unique test file names
const generateTestFileName = () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  return `todos/test-${timestamp}-${randomId}.md`;
};

// Helper function to create test markdown content
const createTestContent = (title: string) => {
  const frontmatter = {
    title,
    createdAt: new Date().toISOString(),
    priority: 3,
    isArchived: false,
    chatHistory: []
  };
  
  const markdownContent = `## ${title}

This is a test task for validating the GitHub integration.

- [ ] First test item
- [ ] Second test item  
- [ ] Third test item`;

  return `---
title: '${frontmatter.title}'
createdAt: '${frontmatter.createdAt}'
priority: ${frontmatter.priority}
isArchived: ${frontmatter.isArchived}
chatHistory: []
---

${markdownContent}`;
};

describe('GitHub Service - Basic Feature Coverage', () => {
  let testFileName: string;
  let testContent: string;
  let createdFileSha: string;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  beforeEach(() => {
    testFileName = generateTestFileName();
    testContent = createTestContent('Test Task for GitHub Integration');
  });

  afterEach(async () => {
    // Clean up: delete test file if it was created
    if (createdFileSha) {
      try {
        const commitMessage = await generateCommitMessage('feat: Clean up test file');
        await fetch(`https://api.github.com/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${testFileName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${TEST_CONFIG.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            sha: createdFileSha,
          }),
        });
        console.log(`Cleaned up test file: ${testFileName}`);
      } catch (error) {
        console.warn(`Failed to clean up test file ${testFileName}:`, error);
      }
      createdFileSha = '';
    }
  });

  describe('ensureTodosDirectory', () => {
    it('should ensure todos directory exists', async () => {
      const commitMessage = await generateCommitMessage('feat: Ensure todos directory for tests');
      await ensureTodosDirectory(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, commitMessage);
      
      // Verify directory exists by fetching it
      const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      expect(Array.isArray(todos)).toBe(true);
    }, 15000);
  });

  describe('getTodos', () => {
    it('should return an array of todo files', async () => {
      const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      expect(Array.isArray(todos)).toBe(true);
      todos.forEach(todo => {
        expect(todo).toHaveProperty('name');
        expect(todo).toHaveProperty('path');
        expect(todo).toHaveProperty('sha');
        expect(todo.name.endsWith('.md')).toBe(true);
        expect(todo.path.startsWith('todos/')).toBe(true);
      });
    }, 10000);

    it('should filter out .gitkeep files', async () => {
      const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      
      const gitkeepFiles = todos.filter(todo => todo.name === '.gitkeep');
      expect(gitkeepFiles).toHaveLength(0);
    }, 10000);
  });

  describe('createOrUpdateTodo', () => {
    it('should create a new todo file successfully', async () => {
      const commitMessage = await generateCommitMessage(`feat: Create test todo "${testFileName}"`);
      
      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );

      expect(result).toHaveProperty('content');
      expect(result.content).toHaveProperty('sha');
      createdFileSha = result.content.sha;

      // Verify file was created by fetching todos
      const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      const createdTodo = todos.find(todo => todo.path === testFileName);
      expect(createdTodo).toBeDefined();
      expect(createdTodo?.name).toBe(testFileName.split('/').pop());
    }, 15000);

    it('should update an existing todo file', async () => {
      // First create a file
      const createCommitMessage = await generateCommitMessage(`feat: Create test todo for update test`);
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        createCommitMessage
      );
      createdFileSha = createResult.content.sha;

      // Then update it
      const updatedContent = testContent.replace('First test item', 'Updated first test item');
      const updateCommitMessage = await generateCommitMessage(`feat: Update test todo "${testFileName}"`);
      
      const updateResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        updatedContent,
        updateCommitMessage,
        createdFileSha
      );

      expect(updateResult.content.sha).not.toBe(createdFileSha);
      createdFileSha = updateResult.content.sha;

      // Verify content was updated
      const fileContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
      expect(fileContent).toContain('Updated first test item');
    }, 20000);
  });

  describe('getFileContent', () => {
    it('should retrieve file content correctly', async () => {
      // First create a file
      const commitMessage = await generateCommitMessage(`feat: Create test todo for content retrieval`);
      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = result.content.sha;

      // Then retrieve its content
      const retrievedContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
      
      expect(retrievedContent).toBe(testContent);
      expect(retrievedContent).toContain('Test Task for GitHub Integration');
      expect(retrievedContent).toContain('First test item');
    }, 15000);
  });

  describe('End-to-End Workflow', () => {
    it('should complete full create-read-update-delete cycle', async () => {
      // 1. Create
      const createCommitMessage = await generateCommitMessage(`feat: Create test todo for E2E test`);
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        createCommitMessage
      );
      createdFileSha = createResult.content.sha;
      expect(createdFileSha).toBeDefined();

      // 2. Read
      let todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      let createdTodo = todos.find(todo => todo.path === testFileName);
      expect(createdTodo).toBeDefined();

      const fileContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
      expect(fileContent).toBe(testContent);

      // 3. Update
      const updatedContent = testContent.replace('- [ ] First test item', '- [x] First test item');
      const updateCommitMessage = await generateCommitMessage(`feat: Update test todo checkbox`);
      const updateResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        updatedContent,
        updateCommitMessage,
        createdFileSha
      );
      createdFileSha = updateResult.content.sha;

      // Verify update
      const updatedFileContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
      expect(updatedFileContent).toContain('- [x] First test item');

      // 4. Delete
      const deleteCommitMessage = await generateCommitMessage(`feat: Delete test todo for E2E test`);
      const deleteResponse = await fetch(`https://api.github.com/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${testFileName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${TEST_CONFIG.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: deleteCommitMessage,
          sha: createdFileSha,
        }),
      });

      expect(deleteResponse.ok).toBe(true);
      createdFileSha = ''; // Clear so afterEach doesn't try to delete again

      // Verify deletion
      todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
      const deletedTodo = todos.find(todo => todo.path === testFileName);
      expect(deletedTodo).toBeUndefined();
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const nonExistentPath = 'todos/non-existent-file.md';
      
      await expect(getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, nonExistentPath))
        .rejects.toThrow('GitHub API error');
    }, 10000);

    it('should handle invalid SHA for update', async () => {
      const invalidSha = 'invalid-sha-value';
      const commitMessage = await generateCommitMessage('feat: Test invalid SHA handling');
      
      await expect(createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage,
        invalidSha
      )).rejects.toThrow();
    }, 15000);
  });

  describe('Unicode and Special Character Handling', () => {
    it('should handle Unicode characters in content', async () => {
      const unicodeContent = createTestContent('Test with Unicode: 🚀 émojis and ñoñó characters');
      const commitMessage = await generateCommitMessage('feat: Test Unicode character handling');
      
      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        unicodeContent,
        commitMessage
      );
      createdFileSha = result.content.sha;

      // Verify Unicode content is preserved
      const retrievedContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
      expect(retrievedContent).toContain('🚀 émojis and ñoñó');
    }, 15000);
  });
});