import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getTodos, createOrUpdateTodo } from '../services/githubService';
import { generateCommitMessage } from '../services/aiService';

// Mock the AI service to prevent settings errors
vi.mock('../services/aiService', () => ({
  generateCommitMessage: vi.fn().mockResolvedValue('test: Add retry test file')
}));

// Test configuration
const TEST_CONFIG = {
  token: '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',
  owner: 'FlorinPeter',
  repo: 'todo-test'
};

// Helper function to generate unique test file names
const generateTestFileName = () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  return `todos/retry-test-${timestamp}-${randomId}.md`;
};

// Helper function to create test content
const createTestContent = (title: string) => {
  return `---
title: '${title}'
createdAt: '${new Date().toISOString()}'
priority: 3
isArchived: false
chatHistory: []
---

## ${title}

This is a test for retry logic validation.

- [ ] Test retry mechanism
- [ ] Validate eventual consistency
- [ ] Ensure proper error handling`;
};

// Simulated retry logic similar to App.tsx
const simulateCreationRetryLogic = async (filename: string, expectedContent: string) => {
  const maxRetries = 8;
  const retryDelay = 1000; // Reduced for testing (1 second instead of 3)
  let retryCount = 0;
  let attempts: Array<{ attempt: number; found: boolean; fileCount: number; timestamp: string }> = [];
  
  const fetchWithRetry = async (): Promise<boolean> => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const found = githubFiles.some(file => file.path === filename);
    
    attempts.push({
      attempt: retryCount + 1,
      found,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString()
    });
    
    if (!found && retryCount < maxRetries) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchWithRetry();
    }
    
    return found;
  };
  
  const result = await fetchWithRetry();
  return { found: result, attempts, totalRetries: retryCount };
};

// Simulated deletion retry logic
const simulateDeletionRetryLogic = async (filename: string, fileSha: string) => {
  const maxRetries = 8;
  const retryDelay = 1000; // Reduced for testing
  let retryCount = 0;
  let attempts: Array<{ attempt: number; stillExists: boolean; fileCount: number; timestamp: string }> = [];
  
  // First perform the deletion
  const deleteCommitMessage = await generateCommitMessage(`test: Delete file ${filename}`);
  const deleteResponse = await fetch(`https://api.github.com/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${filename}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${TEST_CONFIG.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: deleteCommitMessage,
      sha: fileSha,
    }),
  });
  
  if (!deleteResponse.ok) {
    throw new Error(`Delete failed: ${deleteResponse.statusText}`);
  }
  
  // Now verify deletion with retry logic
  const verifyDeletion = async (): Promise<boolean> => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const stillExists = githubFiles.some(file => file.path === filename);
    
    attempts.push({
      attempt: retryCount + 1,
      stillExists,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString()
    });
    
    if (stillExists && retryCount < maxRetries) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return verifyDeletion();
    }
    
    return !stillExists; // Return true if deletion was verified (file no longer exists)
  };
  
  const deletionVerified = await verifyDeletion();
  return { verified: deletionVerified, attempts, totalRetries: retryCount };
};

describe('Retry Logic Integration Tests', () => {
  let testFileName: string;
  let createdFileSha: string;

  beforeEach(() => {
    testFileName = generateTestFileName();
  });

  afterEach(async () => {
    // Clean up any remaining files
    if (createdFileSha) {
      try {
        const commitMessage = await generateCommitMessage('test: Clean up retry test file');
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
      } catch (error) {
        console.warn(`Failed to clean up test file: ${error}`);
      }
      createdFileSha = '';
    }
  });

  describe('Creation Retry Logic', () => {
    it('should eventually find newly created file within retry attempts', async () => {
      const testContent = createTestContent('Retry Logic Test - Creation');
      
      // Create the file
      const commitMessage = await generateCommitMessage('test: Create file for retry logic test');
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = createResult.content.sha;
      
      // Test retry logic
      const retryResult = await simulateCreationRetryLogic(testFileName, testContent);
      
      expect(retryResult.found).toBe(true);
      expect(retryResult.attempts.length).toBeGreaterThan(0);
      expect(retryResult.attempts[retryResult.attempts.length - 1].found).toBe(true);
      
      console.log('Creation retry attempts:', retryResult.attempts);
      console.log(`File found after ${retryResult.totalRetries} retries`);
    }, 30000);
    
    it('should track retry attempts with timestamps', async () => {
      const testContent = createTestContent('Retry Logic Test - Timestamps');
      
      // Create the file
      const commitMessage = await generateCommitMessage('test: Create file for timestamp tracking test');
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = createResult.content.sha;
      
      // Test retry logic
      const retryResult = await simulateCreationRetryLogic(testFileName, testContent);
      
      // Verify timestamps show progression
      expect(retryResult.attempts.length).toBeGreaterThan(0);
      
      for (let i = 1; i < retryResult.attempts.length; i++) {
        const prevTime = new Date(retryResult.attempts[i - 1].timestamp);
        const currTime = new Date(retryResult.attempts[i].timestamp);
        expect(currTime.getTime()).toBeGreaterThan(prevTime.getTime());
      }
      
      console.log('Retry timing analysis:', retryResult.attempts.map(a => ({
        attempt: a.attempt,
        found: a.found,
        timestamp: a.timestamp
      })));
    }, 30000);
  });

  describe('Deletion Retry Logic', () => {
    it('should verify file deletion within retry attempts', async () => {
      const testContent = createTestContent('Retry Logic Test - Deletion');
      
      // Create the file first
      const commitMessage = await generateCommitMessage('test: Create file for deletion retry test');
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = createResult.content.sha;
      
      // Test deletion retry logic
      const deleteResult = await simulateDeletionRetryLogic(testFileName, createdFileSha);
      createdFileSha = ''; // Clear so afterEach doesn't try to delete again
      
      expect(deleteResult.verified).toBe(true);
      expect(deleteResult.attempts.length).toBeGreaterThan(0);
      expect(deleteResult.attempts[deleteResult.attempts.length - 1].stillExists).toBe(false);
      
      console.log('Deletion retry attempts:', deleteResult.attempts);
      console.log(`Deletion verified after ${deleteResult.totalRetries} retries`);
    }, 30000);
    
    it('should handle eventual consistency delays gracefully', async () => {
      const testContent = createTestContent('Retry Logic Test - Eventual Consistency');
      
      // Create the file
      const commitMessage = await generateCommitMessage('test: Create file for eventual consistency test');
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = createResult.content.sha;
      
      // Test deletion with retry logic
      const deleteResult = await simulateDeletionRetryLogic(testFileName, createdFileSha);
      createdFileSha = '';
      
      // Analyze the retry pattern
      const initialAttempts = deleteResult.attempts.filter(a => a.stillExists);
      const successfulAttempts = deleteResult.attempts.filter(a => !a.stillExists);
      
      console.log(`Initial attempts where file still existed: ${initialAttempts.length}`);
      console.log(`Successful attempts where file was gone: ${successfulAttempts.length}`);
      console.log('Full attempt log:', deleteResult.attempts);
      
      expect(deleteResult.verified).toBe(true);
      expect(successfulAttempts.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Performance Analysis', () => {
    it('should complete operations within reasonable time limits', async () => {
      const testContent = createTestContent('Performance Test');
      const startTime = Date.now();
      
      // Create
      const commitMessage = await generateCommitMessage('test: Performance test file');
      const createResult = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        testFileName,
        testContent,
        commitMessage
      );
      createdFileSha = createResult.content.sha;
      const createTime = Date.now();
      
      // Verify creation with retry
      const creationRetryResult = await simulateCreationRetryLogic(testFileName, testContent);
      const verifyCreateTime = Date.now();
      
      // Delete with retry
      const deleteResult = await simulateDeletionRetryLogic(testFileName, createdFileSha);
      createdFileSha = '';
      const deleteTime = Date.now();
      
      const timings = {
        creation: createTime - startTime,
        creationVerification: verifyCreateTime - createTime,
        deletion: deleteTime - verifyCreateTime,
        total: deleteTime - startTime
      };
      
      console.log('Performance timings (ms):', timings);
      console.log('Creation retry stats:', {
        attempts: creationRetryResult.attempts.length,
        retries: creationRetryResult.totalRetries
      });
      console.log('Deletion retry stats:', {
        attempts: deleteResult.attempts.length,
        retries: deleteResult.totalRetries
      });
      
      // Verify operations complete within reasonable time (30 seconds total)
      expect(timings.total).toBeLessThan(30000);
      expect(creationRetryResult.found).toBe(true);
      expect(deleteResult.verified).toBe(true);
    }, 35000);
  });
});