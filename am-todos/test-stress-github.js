#!/usr/bin/env node

// Stress test for GitHub API eventual consistency
// Creates multiple files rapidly to potentially trigger consistency delays

const fetch = require('cross-fetch');

const TEST_CONFIG = {
  token: '***REMOVED***',
  owner: 'FlorinPeter',
  repo: 'todo-test'
};

const GITHUB_API_URL = 'https://api.github.com';
const getApiUrl = (path) => `${GITHUB_API_URL}${path}`;

const getTodos = async (token, owner, repo) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/todos`);
  const headers = { Authorization: `token ${token}` };
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    const files = await response.json();
    return files.filter(file => file.name !== '.gitkeep' && file.name.endsWith('.md'));
  } catch (error) {
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

const generateTestFileName = (index) => {
  const timestamp = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  return `todos/stress-test-${timestamp}-${index}-${randomId}.md`;
};

const createTestContent = (title, index) => {
  return `---
title: '${title}'
createdAt: '${new Date().toISOString()}'
priority: ${(index % 5) + 1}
isArchived: false
chatHistory: []
---

## ${title} #${index}

This is stress test file #${index} for GitHub eventual consistency testing.

- [ ] Task ${index}.1
- [ ] Task ${index}.2
- [ ] Task ${index}.3`;
};

const simulateRetryLogicWithDelay = async (filename, maxRetries = 8, retryDelay = 3000) => {
  let retryCount = 0;
  let attempts = [];
  
  const fetchWithRetry = async () => {
    const startTime = Date.now();
    const githubFiles = await getTodos(TEST_CONFIG.token, TEST_CONFIG.owner, TEST_CONFIG.repo);
    const found = githubFiles.some(file => file.path === filename);
    const duration = Date.now() - startTime;
    
    attempts.push({
      attempt: retryCount + 1,
      found,
      fileCount: githubFiles.length,
      duration,
      timestamp: new Date().toISOString()
    });
    
    if (!found && retryCount < maxRetries) {
      retryCount++;
      console.log(`  Retry ${retryCount}/${maxRetries} - File not found, waiting ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchWithRetry();
    }
    
    return found;
  };
  
  const result = await fetchWithRetry();
  return { found: result, attempts, totalRetries: retryCount };
};

async function stressTestCreation() {
  console.log('\n=== Stress Testing File Creation ===');
  
  const numFiles = 5;
  const createdFiles = [];
  
  try {
    // Create multiple files rapidly
    console.log(`\nCreating ${numFiles} files rapidly...`);
    
    for (let i = 0; i < numFiles; i++) {
      const fileName = generateTestFileName(i);
      const content = createTestContent(`Stress Test Task`, i);
      const commitMessage = `test: Create stress test file ${i}`;
      
      console.log(`Creating file ${i + 1}/${numFiles}: ${fileName.split('/').pop()}`);
      const result = await createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        fileName,
        content,
        commitMessage
      );
      
      createdFiles.push({
        path: fileName,
        sha: result.content.sha,
        index: i
      });
      
      // Small delay between creations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✓ All ${numFiles} files created successfully`);
    
    // Now test retry logic for each file
    console.log('\nTesting retry logic for all files...');
    
    const retryResults = [];
    
    for (const file of createdFiles) {
      console.log(`\nTesting retry logic for file ${file.index + 1}:`);
      const retryResult = await simulateRetryLogicWithDelay(file.path);
      retryResults.push({
        file: file.path,
        ...retryResult
      });
      
      console.log(`  Result: ${retryResult.found ? 'FOUND' : 'NOT FOUND'} after ${retryResult.totalRetries} retries`);
    }
    
    // Analyze results
    console.log('\n📊 Stress Test Results:');
    const foundImmediately = retryResults.filter(r => r.totalRetries === 0).length;
    const requiredRetries = retryResults.filter(r => r.totalRetries > 0).length;
    const notFound = retryResults.filter(r => !r.found).length;
    
    console.log(`Files found immediately: ${foundImmediately}/${numFiles}`);
    console.log(`Files requiring retries: ${requiredRetries}/${numFiles}`);
    console.log(`Files not found: ${notFound}/${numFiles}`);
    
    // Show retry patterns
    if (requiredRetries > 0) {
      console.log('\nRetry patterns:');
      retryResults.filter(r => r.totalRetries > 0).forEach(r => {
        console.log(`  ${r.file.split('/').pop()}: ${r.totalRetries} retries`);
        r.attempts.forEach(a => {
          console.log(`    Attempt ${a.attempt}: ${a.found ? 'FOUND' : 'NOT FOUND'} (${a.duration}ms)`);
        });
      });
    }
    
    // Clean up created files
    console.log('\nCleaning up created files...');
    for (const file of createdFiles) {
      try {
        const deleteResponse = await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${file.path}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `token ${TEST_CONFIG.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `test: Clean up stress test file ${file.index}`,
            sha: file.sha,
          }),
        });
        
        if (deleteResponse.ok) {
          console.log(`  ✓ Deleted ${file.path.split('/').pop()}`);
        } else {
          console.log(`  ✗ Failed to delete ${file.path.split('/').pop()}`);
        }
        
        // Small delay between deletions
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`  ✗ Error deleting ${file.path}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Stress test completed!');
    
    return {
      totalFiles: numFiles,
      foundImmediately,
      requiredRetries,
      notFound,
      retryResults
    };
    
  } catch (error) {
    console.error('\n❌ Stress test failed:', error.message);
    
    // Still try to clean up any created files
    if (createdFiles.length > 0) {
      console.log('Attempting cleanup of created files...');
      for (const file of createdFiles) {
        try {
          await fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${file.path}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${TEST_CONFIG.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `test: Emergency cleanup of stress test file ${file.index}`,
              sha: file.sha,
            }),
          });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    }
    
    throw error;
  }
}

async function testConcurrentOperations() {
  console.log('\n=== Testing Concurrent Operations ===');
  
  try {
    const fileName1 = generateTestFileName(1);
    const fileName2 = generateTestFileName(2);
    const content1 = createTestContent('Concurrent Test 1', 1);
    const content2 = createTestContent('Concurrent Test 2', 2);
    
    console.log('Creating two files concurrently...');
    
    const [result1, result2] = await Promise.all([
      createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        fileName1,
        content1,
        'test: Concurrent creation 1'
      ),
      createOrUpdateTodo(
        TEST_CONFIG.token,
        TEST_CONFIG.owner,
        TEST_CONFIG.repo,
        fileName2,
        content2,
        'test: Concurrent creation 2'
      )
    ]);
    
    console.log('✓ Both files created concurrently');
    
    // Test concurrent retry logic
    console.log('Testing concurrent retry logic...');
    
    const [retry1, retry2] = await Promise.all([
      simulateRetryLogicWithDelay(fileName1),
      simulateRetryLogicWithDelay(fileName2)
    ]);
    
    console.log(`File 1: ${retry1.found ? 'FOUND' : 'NOT FOUND'} after ${retry1.totalRetries} retries`);
    console.log(`File 2: ${retry2.found ? 'FOUND' : 'NOT FOUND'} after ${retry2.totalRetries} retries`);
    
    // Clean up
    console.log('Cleaning up concurrent test files...');
    await Promise.all([
      fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${fileName1}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${TEST_CONFIG.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'test: Clean up concurrent test file 1',
          sha: result1.content.sha,
        }),
      }),
      fetch(`${GITHUB_API_URL}/repos/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}/contents/${fileName2}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${TEST_CONFIG.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'test: Clean up concurrent test file 2',
          sha: result2.content.sha,
        }),
      })
    ]);
    
    console.log('✅ Concurrent operations test completed!');
    
  } catch (error) {
    console.error('\n❌ Concurrent operations test failed:', error.message);
    throw error;
  }
}

// Main test runner
async function runStressTests() {
  console.log('🔥 Starting GitHub Stress Tests');
  console.log(`Repository: ${TEST_CONFIG.owner}/${TEST_CONFIG.repo}`);
  
  try {
    const stressResults = await stressTestCreation();
    await testConcurrentOperations();
    
    console.log('\n🎯 Final Summary:');
    console.log(`Total files tested: ${stressResults.totalFiles}`);
    console.log(`Found immediately: ${stressResults.foundImmediately}`);
    console.log(`Required retries: ${stressResults.requiredRetries}`);
    console.log(`Eventual consistency delays encountered: ${stressResults.requiredRetries > 0 ? 'YES' : 'NO'}`);
    
    if (stressResults.requiredRetries > 0) {
      console.log('\n⚠️  GitHub API showed eventual consistency delays - retry logic is essential!');
    } else {
      console.log('\n✅ GitHub API was consistent - but retry logic still recommended for production!');
    }
    
    console.log('\n🎉 All stress tests completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Stress test suite failed:', error);
    process.exit(1);
  }
}

// Run the stress tests
runStressTests();