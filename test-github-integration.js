#!/usr/bin/env node

// Direct Node.js test script for GitHub integration
// This bypasses Jest/JSDOM issues and runs directly in Node.js environment

const MockGitHubAPI = require('./test-utils/mock-github-api');

// Test configuration - no real API key needed!
const TEST_CONFIG = {
  token: 'mock_token', // Not used in mock
  owner: 'test-owner',
  repo: 'test-repo'
};

// Initialize mock GitHub API
const mockGitHub = new MockGitHubAPI();
const fetch = mockGitHub.mockFetch.bind(mockGitHub);

const GITHUB_API_URL = 'https://api.github.com';

// Helper functions (copied from githubService.ts)
const getApiUrl = (path) => `${GITHUB_API_URL}${path}`;

const getTodos = async (token, owner, repo) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/todos`);
  const headers = { Authorization: `token ${token}` };
  console.log('Fetching todos from:', url);
  
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('todos/ directory not found, returning empty array');
        return [];
      }
      const errorText = await response.text();
      console.error('GitHub API error response:', errorText);
      throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
    }

    const files = await response.json();
    console.log('Raw files from GitHub:', files.length);
    
    const todoFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    console.log('Filtered todo files:', todoFiles.length);
    return todoFiles;
  } catch (error) {
    console.error('Error fetching todos:', error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.log('Network error, returning empty array');
      return [];
    }
    throw error;
  }
};

const createOrUpdateTodo = async (token, owner, repo, path, content, commitMessage, sha) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
  console.log('GitHub API URL:', url);
  console.log('Commit message:', commitMessage);
  console.log('Content length:', content.length);
  console.log('SHA:', sha || 'none (new file)');
  
  const method = 'PUT';
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  
  // Properly encode content to Base64
  const utf8Bytes = new TextEncoder().encode(content);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  const encodedContent = Buffer.from(binaryString, 'binary').toString('base64');
  
  const body = JSON.stringify({
    message: commitMessage,
    content: encodedContent,
    sha,
  });

  console.log('Sending request to GitHub...');
  const response = await fetch(url, { method, headers, body });
  console.log('GitHub response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitHub API error response:', errorText);
    throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log('GitHub response success');
  return result;
};

const getFileContent = async (token, owner, repo, path) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw' };
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.text();
};

// Mock AI service for testing
const generateCommitMessage = async (description) => {
  return `test: ${description} (automated test)`;
};

// Test helper functions
const generateTestFileName = () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  return `todos/node-test-${timestamp}-${randomId}.md`;
};

const createTestContent = (title) => {
  return `---
title: '${title}'
createdAt: '${new Date().toISOString()}'
priority: 3
isArchived: false
chatHistory: []
---

## ${title}

This is a test task for validating the GitHub integration.

- [ ] First test item
- [ ] Second test item  
- [ ] Third test item`;
};

// Simulated retry logic
const simulateCreationRetryLogic = async (filename) => {
  const maxRetries = 8;
  const retryDelay = 2000; // 2 seconds
  let retryCount = 0;
  let attempts = [];
  
  const fetchWithRetry = async () => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const found = githubFiles.some(file => file.path === filename);
    
    attempts.push({
      attempt: retryCount + 1,
      found,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Retry ${retryCount + 1}/${maxRetries} - Found: ${found}, Total files: ${githubFiles.length}`);
    
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

const simulateDeletionRetryLogic = async (filename, fileSha) => {
  const maxRetries = 8;
  const retryDelay = 2000;
  let retryCount = 0;
  let attempts = [];
  
  // First perform the deletion
  const deleteCommitMessage = await generateCommitMessage(`Delete file ${filename}`);
  console.log('Deleting file:', filename);
  const deleteResponse = await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${filename}`, {
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
  console.log('Delete API call successful');
  
  // Now verify deletion with retry logic
  const verifyDeletion = async () => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const stillExists = githubFiles.some(file => file.path === filename);
    
    attempts.push({
      attempt: retryCount + 1,
      stillExists,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Delete verification ${retryCount + 1}/${maxRetries} - Still exists: ${stillExists}, Total files: ${githubFiles.length}`);
    
    if (stillExists && retryCount < maxRetries) {
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return verifyDeletion();
    }
    
    return !stillExists;
  };
  
  const deletionVerified = await verifyDeletion();
  return { verified: deletionVerified, attempts, totalRetries: retryCount };
};

// Test functions
async function testBasicOperations() {
  console.log('\n=== Testing Basic GitHub Operations ===');
  
  try {
    // Test getTodos
    console.log('\n1. Testing getTodos...');
    const todos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    console.log(`✓ getTodos returned ${todos.length} files`);
    
    // Test file creation
    console.log('\n2. Testing file creation...');
    const testFileName = generateTestFileName();
    const testContent = createTestContent('Test Task for Basic Operations');
    const commitMessage = await generateCommitMessage('Create test file for basic operations');
    
    const createResult = await createOrUpdateTodo(
      TEST_CONFIG.token,
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      testFileName,
      testContent,
      commitMessage
    );
    console.log(`✓ File created with SHA: ${createResult.content.sha}`);
    
    // Test file reading
    console.log('\n3. Testing file reading...');
    const fileContent = await getFileContent(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo, testFileName);
    console.log(`✓ File content retrieved (${fileContent.length} characters)`);
    
    // Test file update
    console.log('\n4. Testing file update...');
    const updatedContent = testContent.replace('First test item', 'Updated first test item');
    const updateCommitMessage = await generateCommitMessage('Update test file');
    const updateResult = await createOrUpdateTodo(
      TEST_CONFIG.token,
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      testFileName,
      updatedContent,
      updateCommitMessage,
      createResult.content.sha
    );
    console.log(`✓ File updated with new SHA: ${updateResult.content.sha}`);
    
    // Test file deletion
    console.log('\n5. Testing file deletion...');
    const deleteCommitMessage = await generateCommitMessage('Delete test file');
    const deleteResponse = await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${testFileName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${TEST_CONFIG.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: deleteCommitMessage,
        sha: updateResult.content.sha,
      }),
    });
    
    if (deleteResponse.ok) {
      console.log('✓ File deleted successfully');
    } else {
      console.log(`✗ File deletion failed: ${deleteResponse.statusText}`);
    }
    
    console.log('\n✅ All basic operations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Basic operations test failed:', error.message);
    throw error;
  }
}

async function testRetryLogic() {
  console.log('\n=== Testing Retry Logic ===');
  
  try {
    // Test creation retry logic
    console.log('\n1. Testing creation retry logic...');
    const testFileName = generateTestFileName();
    const testContent = createTestContent('Test Task for Retry Logic');
    const commitMessage = await generateCommitMessage('Create test file for retry logic');
    
    // Create the file
    const createResult = await createOrUpdateTodo(
      TEST_CONFIG.token,
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      testFileName,
      testContent,
      commitMessage
    );
    console.log(`File created with SHA: ${createResult.content.sha}`);
    
    // Test retry logic
    console.log('Testing creation retry mechanism...');
    const creationRetryResult = await simulateCreationRetryLogic(testFileName);
    console.log(`✓ Creation retry completed - Found: ${creationRetryResult.found}, Retries: ${creationRetryResult.totalRetries}`);
    console.log('Creation attempts:', creationRetryResult.attempts.map(a => `Attempt ${a.attempt}: ${a.found ? 'FOUND' : 'NOT FOUND'}`));
    
    // Test deletion retry logic
    console.log('\n2. Testing deletion retry logic...');
    const deletionRetryResult = await simulateDeletionRetryLogic(testFileName, createResult.content.sha);
    console.log(`✓ Deletion retry completed - Verified: ${deletionRetryResult.verified}, Retries: ${deletionRetryResult.totalRetries}`);
    console.log('Deletion attempts:', deletionRetryResult.attempts.map(a => `Attempt ${a.attempt}: ${a.stillExists ? 'STILL EXISTS' : 'DELETED'}`));
    
    console.log('\n✅ Retry logic tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Retry logic test failed:', error.message);
    throw error;
  }
}

async function testPerformance() {
  console.log('\n=== Testing Performance ===');
  
  const startTime = Date.now();
  
  try {
    const testFileName = generateTestFileName();
    const testContent = createTestContent('Performance Test Task');
    
    // Create
    console.log('Creating file...');
    const createStart = Date.now();
    const commitMessage = await generateCommitMessage('Performance test file creation');
    const createResult = await createOrUpdateTodo(
      TEST_CONFIG.token,
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      testFileName,
      testContent,
      commitMessage
    );
    const createTime = Date.now() - createStart;
    console.log(`✓ Creation took ${createTime}ms`);
    
    // Verify with retry
    console.log('Verifying creation with retry logic...');
    const verifyStart = Date.now();
    const creationRetryResult = await simulateCreationRetryLogic(testFileName);
    const verifyTime = Date.now() - verifyStart;
    console.log(`✓ Verification took ${verifyTime}ms with ${creationRetryResult.totalRetries} retries`);
    
    // Delete with retry
    console.log('Deleting with retry logic...');
    const deleteStart = Date.now();
    const deletionRetryResult = await simulateDeletionRetryLogic(testFileName, createResult.content.sha);
    const deleteTime = Date.now() - deleteStart;
    console.log(`✓ Deletion took ${deleteTime}ms with ${deletionRetryResult.totalRetries} retries`);
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n📊 Performance Summary:');
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Creation: ${createTime}ms`);
    console.log(`Verification: ${verifyTime}ms (${creationRetryResult.totalRetries} retries)`);
    console.log(`Deletion: ${deleteTime}ms (${deletionRetryResult.totalRetries} retries)`);
    
    console.log('\n✅ Performance test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Performance test failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting GitHub Integration Tests (Using Mock API)');
  console.log(`Repository: ${TEST_CONFIG.owner}/${TEST_CONFIG.repo}`);
  console.log('Using mock GitHub API - no real API key needed');
  
  try {
    await testBasicOperations();
    await testRetryLogic();
    await testPerformance();
    
    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();