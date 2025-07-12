// GitLab API service for handling GitLab repository operations
// This service mirrors the functionality of the GitHub service but for GitLab API

import logger from './logger.js';

/**
 * GitLab API wrapper for file operations
 * Handles authentication, Base64 encoding, and API endpoint routing
 */
class GitLabService {
  constructor(instanceUrl, projectId, token) {
    this.instanceUrl = instanceUrl.replace(/\/$/, ''); // Remove trailing slash
    this.projectId = projectId;
    this.token = token;
    this.apiBase = `${this.instanceUrl}/api/v4`;
  }

  /**
   * Make authenticated request to GitLab API
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint}`;
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Private-Token': this.token,
        'Content-Type': 'application/json',
        'User-Agent': 'Agentic-Markdown-Todos'
      }
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...(options.headers || {})
      }
    };

    logger.log('GitLab API request:', options.method || 'GET', url);
    
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GitLab API error:', response.status, errorText);
      throw new Error(`GitLab API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  /**
   * Get file content from GitLab repository
   */
  async getFile(filePath, branch = 'main') {
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}?ref=${branch}`;
    
    logger.log(`GitLab getFile request: ${endpoint}`);
    
    const response = await this.makeRequest(endpoint, {
      method: 'GET',
      headers: {
        'Private-Token': this.token,
        'Accept': 'application/json'
      }
    });

    logger.log(`GitLab getFile response status: ${response.status}`);
    
    const responseText = await response.text();
    logger.log(`GitLab getFile response text (first 200 chars): ${responseText.substring(0, 200)}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('GitLab getFile JSON parse error:', parseError.message);
      logger.error('GitLab getFile full response text:', responseText);
      throw new Error(`Failed to parse GitLab getFile response: ${parseError.message}`);
    }
    
    // GitLab returns content in Base64, decode it
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    return {
      content,
      sha: data.blob_id,
      path: data.file_path,
      name: data.file_name
    };
  }

  /**
   * Get raw file content from GitLab repository
   */
  async getRawFile(filePath, branch = 'main') {
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}/raw?ref=${branch}`;
    
    const response = await this.makeRequest(endpoint);
    return await response.text();
  }

  /**
   * List files in a directory
   */
  async listFiles(path = '', branch = 'main') {
    const endpoint = `/projects/${this.projectId}/repository/tree`;
    const params = new URLSearchParams({
      ref: branch,
      path: path,
      per_page: 100
    });
    
    const response = await this.makeRequest(`${endpoint}?${params}`);
    const files = await response.json();
    
    // Filter to only return files (not directories) and transform to match GitHub format
    return files
      .filter(item => item.type === 'blob')
      .map(file => ({
        name: file.name,
        path: file.path,
        sha: file.id,
        type: 'file'
      }));
  }

  /**
   * Create or update a file in GitLab repository
   */
  async createOrUpdateFile(filePath, content, commitMessage, branch = 'main') {
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
    
    // Check if file exists first
    let fileExists = false;
    try {
      await this.getFile(filePath, branch);
      fileExists = true;
    } catch (error) {
      // File doesn't exist, which is fine for creation
      logger.log('File does not exist, creating new file');
    }

    // Encode content to Base64
    const encodedContent = Buffer.from(content, 'utf-8').toString('base64');
    
    const requestBody = {
      branch,
      content: encodedContent,
      commit_message: commitMessage,
      encoding: 'base64'
    };

    const method = fileExists ? 'PUT' : 'POST';
    
    const response = await this.makeRequest(endpoint, {
      method,
      body: JSON.stringify(requestBody)
    });

    return await response.json();
  }

  /**
   * Delete a file from GitLab repository
   */
  async deleteFile(filePath, commitMessage, branch = 'main') {
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
    
    const requestBody = {
      branch,
      commit_message: commitMessage
    };

    const response = await this.makeRequest(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(requestBody)
    });

    // GitLab DELETE operations may return empty response body
    const responseText = await response.text();
    logger.log('GitLab deleteFile response text:', responseText);
    
    if (responseText.trim() === '') {
      logger.log('GitLab deleteFile: Empty response, file deleted successfully');
      return { deleted: true };
    }
    
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      logger.log('GitLab deleteFile: Non-JSON response, but delete was successful');
      return { deleted: true };
    }
  }

  /**
   * Get project information
   */
  async getProject() {
    const endpoint = `/projects/${this.projectId}`;
    const response = await this.makeRequest(endpoint);
    return await response.json();
  }

  /**
   * Get commit history for a file
   */
  async getFileHistory(filePath, branch = 'main') {
    const endpoint = `/projects/${this.projectId}/repository/commits`;
    const params = new URLSearchParams({
      ref_name: branch,
      path: filePath,
      per_page: 20
    });
    
    const response = await this.makeRequest(`${endpoint}?${params}`);
    const commits = await response.json();
    
    return commits.map(commit => ({
      sha: commit.id,
      message: commit.message,
      author: commit.author_name,
      date: commit.created_at,
      url: commit.web_url
    }));
  }

  /**
   * Get file content at specific commit
   */
  async getFileAtCommit(filePath, sha) {
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
    const params = new URLSearchParams({
      ref: sha
    });
    
    const response = await this.makeRequest(`${endpoint}?${params}`);
    const data = await response.json();
    
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    return {
      content,
      sha: data.blob_id
    };
  }
}

export default GitLabService;