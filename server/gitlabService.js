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
      // Sanitize error text to remove potential tokens before logging
      const sanitizedError = errorText.replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]')
                                      .replace(/authorization[=:]\s*[^\s&]+/gi, 'authorization=[REDACTED]')
                                      .replace(/glpat-[a-zA-Z0-9_-]{20,}/g, '[GITLAB_TOKEN_REDACTED]')
                                      .replace(/private-token[=:]\s*[^\s&]+/gi, 'private-token=[REDACTED]');
      logger.error('GitLab API error:', response.status, sanitizedError);
      
      // Return sanitized error to client as well
      const clientError = `GitLab API error: ${response.status} ${response.statusText}`;
      throw new Error(clientError);
    }

    return response;
  }

  /**
   * Validate Git branch name to prevent command injection
   */
  validateBranchName(branch) {
    if (!branch || typeof branch !== 'string') {
      throw new Error('Invalid branch name: must be a non-empty string');
    }
    
    // Git branch name validation rules
    const validBranchPattern = /^[a-zA-Z0-9._/-]+$/;
    if (!validBranchPattern.test(branch)) {
      throw new Error('Invalid branch name: contains invalid characters');
    }
    
    // Prevent command injection and path traversal
    if (branch.includes('..') || branch.includes(';') || branch.includes('&') || 
        branch.includes('|') || branch.includes('$') || branch.includes('`') ||
        branch.includes('\\') || branch.includes('\n') || branch.includes('\r')) {
      throw new Error('Invalid branch name: contains potentially dangerous characters');
    }
    
    if (branch.length > 250) {
      throw new Error('Invalid branch name: too long');
    }
    
    return branch;
  }

  /**
   * Validate file path to prevent directory traversal attacks
   */
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path: must be a non-empty string');
    }
    
    // Remove leading slashes and normalize path
    const normalizedPath = filePath.replace(/^\/+/, '');
    
    // Check for directory traversal attempts
    if (normalizedPath.includes('..') || normalizedPath.includes('\\') || 
        normalizedPath.includes('%2e%2e') || normalizedPath.includes('%2E%2E') ||
        normalizedPath.includes('%5c') || normalizedPath.includes('%5C') ||
        normalizedPath.includes('\0') || normalizedPath.includes('%00')) {
      throw new Error('Invalid file path: path traversal detected');
    }
    
    // Validate path characters (allow alphanumeric, dots, hyphens, underscores, slashes, spaces, and safe special chars)
    const validPathPattern = /^[a-zA-Z0-9._/ -]+$/;
    if (!validPathPattern.test(normalizedPath)) {
      throw new Error('Invalid file path: contains invalid characters');
    }
    
    // Prevent excessively long paths
    if (normalizedPath.length > 1000) {
      throw new Error('Invalid file path: path too long');
    }
    
    // Prevent files starting with dot (hidden files) except for specific cases
    const pathSegments = normalizedPath.split('/');
    for (const segment of pathSegments) {
      if (segment.startsWith('.') && segment !== '.' && segment !== '..' && 
          !segment.startsWith('.gitkeep') && !segment.startsWith('.md')) {
        throw new Error('Invalid file path: hidden files not allowed');
      }
    }
    
    return normalizedPath;
  }

  /**
   * Get file content from GitLab repository
   */
  async getFile(filePath, branch = 'main') {
    branch = this.validateBranchName(branch);
    filePath = this.validateFilePath(filePath);
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`;
    
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
    // Only log response details in development mode, and sanitize sensitive data
    if (process.env.NODE_ENV === 'development') {
      const sanitizedResponse = responseText.substring(0, 200)
        .replace(/glpat-[a-zA-Z0-9_-]{20,}/g, '[GITLAB_TOKEN_REDACTED]')
        .replace(/private-token[=:]\s*[^\s&]+/gi, 'private-token=[REDACTED]');
      logger.log(`GitLab getFile response text (first 200 chars): ${sanitizedResponse}`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('GitLab getFile JSON parse error:', parseError.message);
      // Only log full response in development and sanitize it
      if (process.env.NODE_ENV === 'development') {
        const sanitizedError = responseText.replace(/glpat-[a-zA-Z0-9_-]{20,}/g, '[GITLAB_TOKEN_REDACTED]')
          .replace(/private-token[=:]\s*[^\s&]+/gi, 'private-token=[REDACTED]');
        logger.error('GitLab getFile sanitized response text:', sanitizedError);
      }
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
    branch = this.validateBranchName(branch);
    filePath = this.validateFilePath(filePath);
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(branch)}`;
    
    const response = await this.makeRequest(endpoint);
    return await response.text();
  }

  /**
   * Validate URL search parameters to prevent injection
   */
  validateSearchParams(params) {
    for (const [key, value] of params.entries()) {
      if (typeof value !== 'string') {
        throw new Error(`Invalid parameter type for ${key}: must be string`);
      }
      
      // Check for potentially dangerous characters
      if (value.includes('\n') || value.includes('\r') || value.includes('\0') ||
          value.includes('&') || value.includes(';') || value.includes('|') ||
          value.includes('`') || value.includes('$') || value.includes('<') ||
          value.includes('>')) {
        throw new Error(`Invalid parameter value for ${key}: contains dangerous characters`);
      }
      
      // Limit parameter length
      if (value.length > 1000) {
        throw new Error(`Invalid parameter value for ${key}: too long`);
      }
    }
    return params;
  }

  /**
   * List files in a directory
   */
  async listFiles(path = '', branch = 'main') {
    branch = this.validateBranchName(branch);
    const endpoint = `/projects/${this.projectId}/repository/tree`;
    const params = new URLSearchParams({
      ref: branch,
      path: path,
      per_page: 100
    });
    
    // Validate URL parameters before making request
    this.validateSearchParams(params);
    
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
   * Validate JSON request body to prevent injection
   */
  validateJsonInput(obj) {
    if (typeof obj !== 'object' || obj === null) {
      throw new Error('Invalid input: must be a non-null object');
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Check for potentially dangerous characters in string values
        if (value.includes('\0') || value.includes('\x00')) {
          throw new Error(`Invalid input: null bytes detected in ${key}`);
        }
        
        // Limit string length to prevent DoS
        if (value.length > 100000) { // 100KB limit for strings
          throw new Error(`Invalid input: ${key} too long`);
        }
      }
      
      // Validate key names
      if (typeof key !== 'string' || key.length > 100 || 
          /[^\w_-]/.test(key)) {
        throw new Error(`Invalid input: invalid key name ${key}`);
      }
    }
    
    return obj;
  }

  /**
   * Create or update a file in GitLab repository
   */
  async createOrUpdateFile(filePath, content, commitMessage, branch = 'main') {
    branch = this.validateBranchName(branch);
    filePath = this.validateFilePath(filePath);
    
    // Validate input strings
    if (typeof content !== 'string') {
      throw new Error('Invalid content: must be a string');
    }
    if (typeof commitMessage !== 'string' || commitMessage.length > 1000) {
      throw new Error('Invalid commit message: must be a string under 1000 characters');
    }
    
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
    
    // Validate JSON request body
    this.validateJsonInput(requestBody);

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
    branch = this.validateBranchName(branch);
    filePath = this.validateFilePath(filePath);
    
    // Validate commit message
    if (typeof commitMessage !== 'string' || commitMessage.length > 1000) {
      throw new Error('Invalid commit message: must be a string under 1000 characters');
    }
    
    const encodedPath = encodeURIComponent(filePath);
    const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
    
    const requestBody = {
      branch,
      commit_message: commitMessage
    };
    
    // Validate JSON request body
    this.validateJsonInput(requestBody);

    const response = await this.makeRequest(endpoint, {
      method: 'DELETE',
      body: JSON.stringify(requestBody)
    });

    // GitLab DELETE operations may return empty response body
    const responseText = await response.text();
    // Only log in development mode and sanitize
    if (process.env.NODE_ENV === 'development') {
      const sanitizedResponse = responseText.replace(/glpat-[a-zA-Z0-9_-]{20,}/g, '[GITLAB_TOKEN_REDACTED]')
        .replace(/private-token[=:]\s*[^\s&]+/gi, 'private-token=[REDACTED]');
      logger.log('GitLab deleteFile response text:', sanitizedResponse);
    }
    
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
    branch = this.validateBranchName(branch);
    filePath = this.validateFilePath(filePath);
    const endpoint = `/projects/${this.projectId}/repository/commits`;
    const params = new URLSearchParams({
      ref_name: branch,
      path: filePath,
      per_page: 20
    });
    
    // Validate URL parameters before making request
    this.validateSearchParams(params);
    
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
    filePath = this.validateFilePath(filePath);
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

  /**
   * Get repository tree (directories and files) using GitLab repository tree API
   */
  async getRepositoryTree(path = '', recursive = false, branch = 'main') {
    branch = this.validateBranchName(branch);
    const endpoint = `/projects/${this.projectId}/repository/tree`;
    const params = new URLSearchParams({
      ref: branch,
      per_page: 100
    });
    
    if (path) {
      params.append('path', path);
    }
    
    if (recursive) {
      params.append('recursive', 'true');
    }
    
    // Validate URL parameters before making request
    this.validateSearchParams(params);
    
    // Only log detailed info in development
    if (process.env.NODE_ENV === 'development') {
      logger.log(`GitLab getRepositoryTree request: ${endpoint}?${params}`);
    }
    
    const response = await this.makeRequest(`${endpoint}?${params}`);
    const data = await response.json();
    
    if (process.env.NODE_ENV === 'development') {
      logger.log(`GitLab getRepositoryTree response: ${data.length} items`);
    }
    
    return data;
  }
}

export default GitLabService;