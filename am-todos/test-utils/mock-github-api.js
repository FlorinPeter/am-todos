// Mock GitHub API implementation for tests
// This eliminates the need for real GitHub API keys in test files

class MockGitHubAPI {
  constructor() {
    this.files = new Map(); // path -> { name, path, sha, content }
    this.requestCount = 0;
    this.consistencyDelay = 0; // Simulate eventual consistency
  }

  // Set artificial delay to simulate eventual consistency
  setConsistencyDelay(ms) {
    this.consistencyDelay = ms;
  }

  // Helper to generate mock SHA
  generateSHA() {
    return Math.random().toString(36).substring(2, 15);
  }

  // Mock the GitHub API endpoint: GET /repos/{owner}/{repo}/contents/{path}
  async mockGetContents(path) {
    this.requestCount++;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (path === 'todos') {
      // Return all files in todos directory
      const todoFiles = Array.from(this.files.values())
        .filter(file => file.path.startsWith('todos/') && file.name.endsWith('.md'))
        .map(file => ({
          name: file.name,
          path: file.path,
          sha: file.sha,
          type: 'file'
        }));
      
      if (todoFiles.length === 0) {
        // Return 404 if no files (simulates empty directory)
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      
      return { ok: true, json: () => Promise.resolve(todoFiles) };
    } else {
      // Return specific file content
      const file = this.files.get(path);
      if (!file) {
        return { ok: false, status: 404, statusText: 'Not Found' };
      }
      
      return { 
        ok: true, 
        text: () => Promise.resolve(file.content),
        json: () => Promise.resolve({
          name: file.name,
          path: file.path,
          sha: file.sha,
          content: Buffer.from(file.content).toString('base64')
        })
      };
    }
  }

  // Mock the GitHub API endpoint: PUT /repos/{owner}/{repo}/contents/{path}
  async mockCreateOrUpdateFile(path, requestBody) {
    this.requestCount++;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const { message, content, sha } = JSON.parse(requestBody);
    
    // Validate SHA for updates
    if (sha) {
      const existingFile = this.files.get(path);
      if (!existingFile || existingFile.sha !== sha) {
        return { 
          ok: false, 
          status: 409, 
          statusText: 'Conflict',
          text: () => Promise.resolve('SHA mismatch')
        };
      }
    }
    
    // Decode base64 content
    const decodedContent = Buffer.from(content, 'base64').toString('utf8');
    const fileName = path.split('/').pop();
    const newSHA = this.generateSHA();
    
    // Store file with artificial delay for consistency testing
    setTimeout(() => {
      this.files.set(path, {
        name: fileName,
        path: path,
        sha: newSHA,
        content: decodedContent
      });
    }, this.consistencyDelay);
    
    return {
      ok: true,
      json: () => Promise.resolve({
        content: {
          name: fileName,
          path: path,
          sha: newSHA
        },
        commit: {
          sha: this.generateSHA(),
          message: message
        }
      })
    };
  }

  // Mock the GitHub API endpoint: DELETE /repos/{owner}/{repo}/contents/{path}
  async mockDeleteFile(path, requestBody) {
    this.requestCount++;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 120));
    
    const { message, sha } = JSON.parse(requestBody);
    
    const existingFile = this.files.get(path);
    if (!existingFile) {
      return { ok: false, status: 404, statusText: 'Not Found' };
    }
    
    if (existingFile.sha !== sha) {
      return { 
        ok: false, 
        status: 409, 
        statusText: 'Conflict',
        text: () => Promise.resolve('SHA mismatch')
      };
    }
    
    // Delete file with artificial delay for consistency testing
    setTimeout(() => {
      this.files.delete(path);
    }, this.consistencyDelay);
    
    return {
      ok: true,
      json: () => Promise.resolve({
        commit: {
          sha: this.generateSHA(),
          message: message
        }
      })
    };
  }

  // Mock fetch function that intercepts GitHub API calls
  mockFetch(url, options = {}) {
    const { method = 'GET', headers = {}, body } = options;
    
    // Parse GitHub API URL
    const githubApiMatch = url.match(/https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)\/contents\/(.+)/);
    if (!githubApiMatch) {
      return Promise.reject(new Error('Invalid GitHub API URL'));
    }
    
    const [, owner, repo, path] = githubApiMatch;
    
    // Route to appropriate mock method
    if (method === 'GET') {
      return this.mockGetContents(path);
    } else if (method === 'PUT') {
      return this.mockCreateOrUpdateFile(path, body);
    } else if (method === 'DELETE') {
      return this.mockDeleteFile(path, body);
    }
    
    return Promise.reject(new Error(`Unsupported method: ${method}`));
  }

  // Reset mock state
  reset() {
    this.files.clear();
    this.requestCount = 0;
    this.consistencyDelay = 0;
  }

  // Get current state for testing
  getState() {
    return {
      fileCount: this.files.size,
      files: Array.from(this.files.values()),
      requestCount: this.requestCount
    };
  }
}

module.exports = MockGitHubAPI;