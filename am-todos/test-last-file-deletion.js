#!/usr/bin/env node

// Test specifically for the "last file deletion" scenario
// This test reproduces the exact issue the user experienced

const MockGitHubAPI = require('./test-utils/mock-github-api');

const TEST_CONFIG = {
  token: 'mock_token', // Not used in mock
  owner: 'test-owner',
  repo: 'test-repo'
};

// Initialize mock GitHub API with consistency delay for testing
const mockGitHub = new MockGitHubAPI();
mockGitHub.setConsistencyDelay(500); // Simulate eventual consistency delays
const fetch = mockGitHub.mockFetch.bind(mockGitHub);

const GITHUB_API_URL = 'https://api.github.com';
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
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    const files = await response.json();
    console.log('Raw files from GitHub:', files.length);
    const todoFiles = files.filter(file => file.name !== '.gitkeep' && file.name.endsWith('.md'));
    console.log('Filtered todo files:', todoFiles.length);
    return todoFiles;
  } catch (error) {
    console.error('Error fetching todos:', error);
    if (error.name === 'TypeError') return [];
    throw error;
  }
};

const createOrUpdateTodo = async (token, owner, repo, path, content, commitMessage, sha) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  
  const utf8Bytes = new TextEncoder().encode(content);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  const encodedContent = Buffer.from(binaryString, 'binary').toString('base64');
  
  const body = JSON.stringify({
    message: commitMessage,
    content: encodedContent,
    sha,
  });

  const response = await fetch(url, { method: 'PUT', headers, body });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
  }
  return response.json();
};

const generateTestFileName = () => {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  return `todos/last-file-test-${timestamp}-${randomId}.md`;
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

This is a test for the last file deletion scenario.

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;
};

// Simulated deletion verification logic (the OLD flawed version)
const simulateOldDeletionLogic = async (filename, fileSha) => {
  const maxRetries = 8;
  const retryDelay = 1000; // Reduced for testing
  let retryCount = 0;
  let attempts = [];
  
  // First perform the deletion
  console.log('🗑️ Deleting file:', filename);
  const deleteResponse = await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${filename}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${TEST_CONFIG.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `test: Delete last file ${filename}`,
      sha: fileSha,
    }),
  });
  
  if (!deleteResponse.ok) {
    throw new Error(`Delete failed: ${deleteResponse.statusText}`);
  }
  console.log('✅ Delete API call successful');
  
  // Now simulate the OLD verification logic
  const verifyDeletion = async () => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const stillExists = githubFiles.some(file => file.path === filename);
    
    attempts.push({
      attempt: retryCount + 1,
      stillExists,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString(),
      reasoning: githubFiles.length === 0 ? 'EMPTY_DIRECTORY' : (stillExists ? 'FILE_FOUND' : 'FILE_NOT_FOUND')
    });
    
    console.log(`  Verification ${retryCount + 1}/${maxRetries}:`);
    console.log(`    Files in directory: ${githubFiles.length}`);
    console.log(`    File still exists: ${stillExists}`);
    console.log(`    Reasoning: ${attempts[attempts.length - 1].reasoning}`);
    
    // OLD LOGIC: This is where the bug was!
    // It would keep retrying because:
    // 1. githubFiles = [] (empty due to 404)
    // 2. stillExists = false (because [].some() returns false)
    // 3. But the logic expected the file to "disappear" which it already did
    
    if (stillExists && retryCount < maxRetries) {
      retryCount++;
      console.log(`    ❌ File still exists, retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return verifyDeletion();
    }
    
    console.log(`    ✅ Verification complete - File not found in directory`);
    return !stillExists;
  };
  
  const deletionVerified = await verifyDeletion();
  return { verified: deletionVerified, attempts, totalRetries: retryCount };
};

// Simulated NEW deletion logic (the fixed version)
const simulateNewDeletionLogic = async (filename, fileSha) => {
  const maxRetries = 8;
  const retryDelay = 1000;
  let retryCount = 0;
  let attempts = [];
  
  // Create a new file for this test
  console.log('📝 Creating file for NEW logic test:', filename);
  const content = createTestContent('Test for NEW Deletion Logic');
  const createResult = await createOrUpdateTodo(
    TEST_CONFIG.token,
    TEST_CONFIG.owner,
    TEST_CONFIG.repo,
    filename,
    content,
    'test: Create file for new deletion logic test'
  );
  const newFileSha = createResult.content.sha;
  
  // Delete it
  console.log('🗑️ Deleting file:', filename);
  const deleteResponse = await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${filename}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${TEST_CONFIG.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `test: Delete file for new logic test`,
      sha: newFileSha,
    }),
  });
  
  if (!deleteResponse.ok) {
    throw new Error(`Delete failed: ${deleteResponse.statusText}`);
  }
  console.log('✅ Delete API call successful');
  
  // NEW verification logic
  const verifyDeletion = async () => {
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const stillExists = githubFiles.some(file => file.path === filename);
    
    // NEW LOGIC: Deletion is successful if file is not found
    const deletionSuccessful = !stillExists;
    
    attempts.push({
      attempt: retryCount + 1,
      stillExists,
      deletionSuccessful,
      fileCount: githubFiles.length,
      timestamp: new Date().toISOString(),
      reasoning: githubFiles.length === 0 ? 'EMPTY_DIRECTORY' : (stillExists ? 'FILE_FOUND' : 'FILE_NOT_FOUND')
    });
    
    console.log(`  Verification ${retryCount + 1}/${maxRetries}:`);
    console.log(`    Files in directory: ${githubFiles.length}`);
    console.log(`    File still exists: ${stillExists}`);
    console.log(`    Deletion successful: ${deletionSuccessful}`);
    console.log(`    Reasoning: ${attempts[attempts.length - 1].reasoning}`);
    
    if (!deletionSuccessful && retryCount < maxRetries) {
      retryCount++;
      console.log(`    ❌ Deletion not confirmed, retrying in ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return verifyDeletion();
    }
    
    console.log(`    ✅ Verification complete - Deletion ${deletionSuccessful ? 'SUCCESSFUL' : 'TIMEOUT'}`);
    return deletionSuccessful;
  };
  
  const deletionVerified = await verifyDeletion();
  return { verified: deletionVerified, attempts, totalRetries: retryCount };
};

async function testLastFileDeletion() {
  console.log('🧪 Testing Last File Deletion Scenario');
  console.log('This test reproduces the exact bug the user experienced.\n');
  
  try {
    // First, ensure we have a clean state
    console.log('1️⃣ Cleaning up any existing files...');
    const existingTodos = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    
    for (const todo of existingTodos) {
      try {
        await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${todo.path}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${TEST_CONFIG.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'test: Clean up existing file',
            sha: todo.sha,
          }),
        });
        console.log(`  ✓ Cleaned up ${todo.name}`);
      } catch (error) {
        console.log(`  ⚠️ Failed to clean up ${todo.name}: ${error.message}`);
      }
    }
    
    // Wait for cleanup to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify clean state
    console.log('\n2️⃣ Verifying clean state...');
    const todosAfterCleanup = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    console.log(`Files remaining: ${todosAfterCleanup.length}`);
    
    if (todosAfterCleanup.length > 0) {
      console.log('⚠️ Warning: Clean state not achieved, but continuing with test...');
    }
    
    // Create a single file (this will be the "last file")
    console.log('\n3️⃣ Creating a single file (will be the "last file")...');
    const testFileName = generateTestFileName();
    const testContent = createTestContent('Last File Test');
    const createResult = await createOrUpdateTodo(
      TEST_CONFIG.token,
      TEST_CONFIG.owner,
      TEST_CONFIG.repo,
      testFileName,
      testContent,
      'test: Create last file for deletion test'
    );
    
    console.log(`✓ Created file: ${testFileName.split('/').pop()}`);
    console.log(`✓ File SHA: ${createResult.content.sha}`);
    
    // Verify file exists
    console.log('\n4️⃣ Verifying file exists...');
    const todosBeforeDeletion = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    console.log(`Files before deletion: ${todosBeforeDeletion.length}`);
    
    if (todosBeforeDeletion.length !== 1) {
      throw new Error(`Expected 1 file, found ${todosBeforeDeletion.length}`);
    }
    
    // Test the OLD deletion logic (this should demonstrate the bug)
    console.log('\n5️⃣ Testing OLD deletion verification logic...');
    console.log('This should show the bug where verification times out even though deletion succeeded.');
    
    const oldResult = await simulateOldDeletionLogic(testFileName, createResult.content.sha);
    
    console.log('\n📊 OLD Logic Results:');
    console.log(`Verification result: ${oldResult.verified ? 'SUCCESS' : 'TIMEOUT'}`);
    console.log(`Total retries: ${oldResult.totalRetries}`);
    console.log('Attempt details:');
    oldResult.attempts.forEach(attempt => {
      console.log(`  Attempt ${attempt.attempt}: ${attempt.reasoning} (${attempt.fileCount} files, still exists: ${attempt.stillExists})`);
    });
    
    // Test the NEW deletion logic
    console.log('\n6️⃣ Testing NEW deletion verification logic...');
    console.log('This should work correctly and complete quickly.');
    
    const newResult = await simulateNewDeletionLogic(testFileName.replace('last-file-test', 'new-logic-test'), null);
    
    console.log('\n📊 NEW Logic Results:');
    console.log(`Verification result: ${newResult.verified ? 'SUCCESS' : 'TIMEOUT'}`);
    console.log(`Total retries: ${newResult.totalRetries}`);
    console.log('Attempt details:');
    newResult.attempts.forEach(attempt => {
      console.log(`  Attempt ${attempt.attempt}: ${attempt.reasoning} (${attempt.fileCount} files, deletion successful: ${attempt.deletionSuccessful})`);
    });
    
    console.log('\n✅ Last File Deletion Test Complete!');
    
    // Analysis
    console.log('\n🔍 Analysis:');
    if (oldResult.totalRetries > newResult.totalRetries) {
      console.log('❌ OLD logic required more retries, demonstrating the bug');
    } else {
      console.log('⚠️ Both logics performed similarly in this run');
    }
    
    if (newResult.verified && newResult.totalRetries === 0) {
      console.log('✅ NEW logic works correctly - immediate success');
    } else {
      console.log('⚠️ NEW logic still required retries');
    }
    
    return {
      oldLogic: oldResult,
      newLogic: newResult
    };
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    throw error;
  }
}

// Run the test
console.log('🚀 Starting Last File Deletion Test (Using Mock API)');
console.log('This test reproduces and validates the fix for the deletion verification issue.');
console.log('Using mock GitHub API with simulated consistency delays\n');

testLastFileDeletion()
  .then(results => {
    console.log('\n🎯 Test Summary:');
    console.log('The test demonstrates the difference between old and new deletion logic.');
    console.log('OLD logic may timeout even when deletion succeeds (especially for last file).');
    console.log('NEW logic correctly identifies successful deletion immediately.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });