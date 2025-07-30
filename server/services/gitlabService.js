// GitLab API service for handling GitLab repository operations
// This service mirrors the functionality of the GitHub service but for GitLab API

import logger from '../logger.js';

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

    // Only log API requests in development
    if (process.env.NODE_ENV === 'development') {
      logger.log('GitLab API request:', options.method || 'GET', url);
    }
    
    const response = await fetch(url, mergedOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      // Sanitize error text to remove potential tokens before logging
      const sanitizedError = errorText.replace(/token[=:]\s*[^\s&]+/gi, 'token=[REDACTED]')
                                      .replace(/authorization[=:]\s*[^\s&]+/gi, 'authorization=[REDACTED]')
                                      .replace(/glpat-[a-zA-Z0-9_-]{20,}/g, '[GITLAB_TOKEN_REDACTED]')
                                      .replace(/private-token[=:]\s*[^\s&]+/gi, 'private-token=[REDACTED]');
      logger.error('GitLab API error:', response.status, sanitizedError);
      
      // Include the error text in the client error message
      const clientError = errorText 
        ? `GitLab API error: ${response.status} ${response.statusText} - ${errorText}`
        : `GitLab API error: ${response.status} ${response.statusText}`;
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
    const validPathPattern = /^[a-zA-Z0-9._/\- &()[\]{}+=@#$%]+$/;
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
    
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      logger.log(`GitLab getFile request: ${endpoint}`);
    }
    
    const response = await this.makeRequest(endpoint, {
      method: 'GET',
      headers: {
        'Private-Token': this.token,
        'Accept': 'application/json'
      }
    });

    // Only log status in development
    if (process.env.NODE_ENV === 'development') {
      logger.log(`GitLab getFile response status: ${response.status}`);
    }
    
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
   * Get commit history for a file with rename detection
   */
  async getFileHistory(filePath, branch = 'main') {
    logger.info(`📍 getFileHistory called for: ${filePath}, branch: ${branch}`);
    try {
      branch = this.validateBranchName(branch);
      filePath = this.validateFilePath(filePath);
      logger.info(`📍 After validation: ${filePath}, branch: ${branch}`);
    
    const allCommits = [];
    const processedCommits = new Set();
    const commitToPathMap = new Map(); // Track which path to use for each commit
    
    // Get initial history for current path
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
    logger.info(`📍 Got ${commits.length} initial commits from GitLab API`);
    
    // First pass: collect all commits and map them to their file paths
    for (const commit of commits) {
      commitToPathMap.set(commit.id, filePath); // Default to current path
    }
    
    // Second pass: Simple rename detection for RECENT commits only (first 5)
    // Older commits will be fetched on-demand when user clicks them
    logger.info(`🔍 Analyzing first 5 commits for rename detection (keep it simple)...`);
    let currentPath = filePath;
    
    const recentCommits = commits.slice(0, 5);
    for (const commit of recentCommits) {
      commitToPathMap.set(commit.id, currentPath);
      
      try {
        const diffEndpoint = `/projects/${this.projectId}/repository/commits/${commit.id}/diff`;
        logger.info(`🔍 Checking recent commit ${commit.id.substring(0, 8)} for renames`);
        const diffResponse = await this.makeRequest(diffEndpoint);
        
        if (diffResponse.ok) {
          const diffs = await diffResponse.json();
          
          for (const diff of diffs) {
            // Simple rename detection: actual git renames or high similarity
            if (diff.new_path === currentPath && diff.old_path && diff.old_path !== diff.new_path) {
              logger.info(`📝 Found rename: ${diff.old_path} → ${diff.new_path}`);
              currentPath = diff.old_path;
              break;
            }
            
            // Check for filename similarity in same directory
            if (diff.new_path && diff.new_path !== currentPath) {
              const currentFileName = currentPath.split('/').pop();
              const diffFileName = diff.new_path.split('/').pop();
              const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
              const diffDir = diff.new_path.substring(0, diff.new_path.lastIndexOf('/') + 1);
              
              if (diffDir === currentDir) {
                const similarity = this.calculateFilenameSimilarity(currentFileName, diffFileName);
                if (similarity >= 0.6) {
                  logger.info(`📝 Found similar file: ${diff.new_path} (${Math.round(similarity * 100)}%)`);
                  currentPath = diff.new_path;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        logger.info(`⚠️ Could not analyze commit ${commit.id.substring(0, 8)}: ${error.message}`);
      }
    }
    
    // Update path mapping for all recent commits based on what we found
    for (let i = 0; i < recentCommits.length; i++) {
      commitToPathMap.set(recentCommits[i].id, currentPath);
    }
    
    // Final pass: update commit paths for older commits after renames
    logger.info(`📋 Commit path mapping:`);
    commits.forEach(commit => {
      const path = commitToPathMap.get(commit.id);
      logger.info(`  ${commit.id.substring(0, 8)}: ${path}`);
    });
    
    // Third pass: Create commit objects (simple approach - trust git history)
    logger.info(`📋 Creating commit objects for ${commits.length} commits`);
    
    for (const commit of commits) {
      if (processedCommits.has(commit.id)) continue;
      
      const historicalPath = commitToPathMap.get(commit.id) || filePath;
      
      // Create commit info - getFileAtCommit will handle validation on-demand
      const commitInfo = {
        sha: commit.id,
        message: commit.message,
        author: commit.author_name,
        date: commit.created_at,
        url: commit.web_url
      };
      
      allCommits.push(commitInfo);
      processedCommits.add(commit.id);
    }
    
    // Sort all commits by date (newest first) and remove duplicates
    const uniqueCommits = allCommits
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((commit, index, array) => 
        index === 0 || array[index - 1].sha !== commit.sha
      );
    
    logger.info(`📋 Final getFileHistory result for ${filePath}: ${uniqueCommits.length} commits included`);
    uniqueCommits.forEach(commit => {
      logger.info(`  - ${commit.sha.substring(0, 8)}: ${commit.message.substring(0, 50)}...`);
    });
    
    return uniqueCommits;
    
    } catch (error) {
      logger.error(`💥 CRITICAL ERROR in getFileHistory: ${error.message}`);
      logger.error(`💥 Stack trace:`, error.stack);
      // Return empty array on error to prevent breaking the UI
      return [];
    }
  }

  /**
   * Calculate filename similarity for rename detection
   * Returns a value between 0 (no similarity) and 1 (identical)
   */
  calculateFilenameSimilarity(filename1, filename2) {
    if (!filename1 || !filename2) return 0;
    if (filename1 === filename2) return 1;
    
    // Remove file extensions and priority prefixes for comparison
    const cleanName1 = filename1.replace(/\.[^.]*$/, '').replace(/^P[1-5]--\d{4}-\d{2}-\d{2}--/, '').toLowerCase();
    const cleanName2 = filename2.replace(/\.[^.]*$/, '').replace(/^P[1-5]--\d{4}-\d{2}-\d{2}--/, '').toLowerCase();
    
    // Method 1: Check for exact match after cleaning
    if (cleanName1 === cleanName2) return 1;
    
    // Method 2: Check for substring containment (one contains the other)
    const longer = cleanName1.length > cleanName2.length ? cleanName1 : cleanName2;
    const shorter = cleanName1.length <= cleanName2.length ? cleanName1 : cleanName2;
    
    if (longer.includes(shorter)) {
      // Give high similarity if one is a substring of the other
      const substringRatio = shorter.length / longer.length;
      if (substringRatio >= 0.3) { // At least 30% of the longer string
        return 0.8; // High similarity for substring matches
      }
    }
    
    // Method 3: Check for common prefix
    let commonPrefixLength = 0;
    const minLength = Math.min(cleanName1.length, cleanName2.length);
    for (let i = 0; i < minLength; i++) {
      if (cleanName1[i] === cleanName2[i]) {
        commonPrefixLength++;
      } else {
        break;
      }
    }
    
    if (commonPrefixLength >= 3) { // At least 3 characters in common prefix
      const prefixRatio = commonPrefixLength / Math.max(cleanName1.length, cleanName2.length);
      if (prefixRatio >= 0.2) { // More lenient - 20% prefix match
        return 0.7; // Good similarity for common prefix
      }
    }
    
    // Method 4: Levenshtein distance as fallback
    const distance = this.levenshteinDistance(cleanName1, cleanName2);
    const maxLength = Math.max(cleanName1.length, cleanName2.length);
    
    if (maxLength === 0) return 1;
    
    const levenshteinSimilarity = 1 - (distance / maxLength);
    return Math.max(levenshteinSimilarity, 0); // Ensure non-negative
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get file content at specific commit with rename detection
   */
  async getFileAtCommit(filePath, sha) {
    filePath = this.validateFilePath(filePath);
    
    // First try with the current file path
    try {
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
    } catch (error) {
      // If 404, the file might have had a different name at this commit
      if (error.message.includes('404')) {
        // Try to find the file's name at this specific commit by examining the commit diff
        try {
          const diffEndpoint = `/projects/${this.projectId}/repository/commits/${sha}/diff`;
          const diffResponse = await this.makeRequest(diffEndpoint);
          const diffs = await diffResponse.json();
          
          // Look for files that might be related to our target file
          const possiblePaths = new Set();
          
          // Extract actual file paths from diff data - GENERIC approach (same as getFileHistory)
          for (const diff of diffs) {
            // Check if this diff affects our target file (either as source or destination of rename)
            const targetFileName = filePath.split('/').pop(); // Get filename from current path
            const targetDir = filePath.substring(0, filePath.lastIndexOf('/') + 1); // Get directory
            
            // Case 1: File was renamed TO our current path (diff.new_path matches our current file)
            if (diff.new_path === filePath) {
              possiblePaths.add(diff.new_path);
            }
            // Case 2: File was renamed FROM our current file (diff.old_path matches our current file)  
            else if (diff.old_path === filePath) {
              possiblePaths.add(diff.old_path);
            }
            // Case 3: Look for files with similar names in the same directory (rename detection)
            else if (diff.new_path && diff.old_path) {
              const diffNewName = diff.new_path.split('/').pop();
              const diffOldName = diff.old_path.split('/').pop();
              const diffDir = diff.new_path.substring(0, diff.new_path.lastIndexOf('/') + 1);
              
              // If the directories match and either filename is similar to our target
              if (diffDir === targetDir) {
                // Check if this could be a rename of our file based on filename similarity
                const similarity = this.calculateFilenameSimilarity(targetFileName, diffNewName) ||
                                 this.calculateFilenameSimilarity(targetFileName, diffOldName);
                
                if (similarity > 0.7) { // 70% similarity threshold
                  possiblePaths.add(diff.new_path);
                  possiblePaths.add(diff.old_path);
                }
              }
            }
            // Case 4: Direct path match (file exists at this commit with current name)
            else if (diff.new_path === filePath || diff.old_path === filePath) {
              possiblePaths.add(diff.new_path || diff.old_path);
            }
            
            // Check for any renames in this commit
            if (diff.renamed_file) {
              // If this commit renames something TO our target path, try the old path
              if (diff.new_path === filePath) {
                possiblePaths.add(diff.old_path);
              }
              // If this commit renames something FROM a path that ends with our filename
              const fileName = filePath.split('/').pop();
              if (diff.old_path.endsWith(fileName) || diff.new_path.endsWith(fileName)) {
                possiblePaths.add(diff.old_path);
                possiblePaths.add(diff.new_path);
              }
            }
            
            // Also check files with similar names (different priorities, etc.)
            const fileBaseName = filePath.split('/').pop();
            if (fileBaseName) {
              // Extract the base pattern (remove priority prefix)
              const basePattern = fileBaseName.replace(/^P[1-5]--/, '');
              if (diff.new_path && diff.new_path.includes(basePattern)) {
                possiblePaths.add(diff.new_path);
              }
              if (diff.old_path && diff.old_path.includes(basePattern)) {
                possiblePaths.add(diff.old_path);
              }
            }
          }
          
          // Try each possible path
          for (const possiblePath of possiblePaths) {
            try {
              const encodedPath = encodeURIComponent(possiblePath);
              const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
              const params = new URLSearchParams({
                ref: sha
              });
              
              const response = await this.makeRequest(`${endpoint}?${params}`);
              const data = await response.json();
              
              const content = Buffer.from(data.content, 'base64').toString('utf-8');
              
              return {
                content,
                sha: data.blob_id,
                filePath: possiblePath, // Track which path was successfully used
                originalPath: filePath, // Track what was originally requested
                historicalPathDiscovered: true // Flag that this was discovered on-demand
              };
            } catch (pathError) {
              // Continue trying other paths
              continue;
            }
          }
          
          // If no alternative paths work, check if we can find any file with similar content
          // by looking at all files modified in this commit
          for (const diff of diffs) {
            if (!diff.deleted_file && diff.new_path) {
              const fileBaseName = filePath.split('/').pop();
              const diffBaseName = diff.new_path.split('/').pop();
              
              // Check for files with similar names using filename similarity algorithm
              if (fileBaseName && diffBaseName) {
                const similarity = this.calculateFilenameSimilarity(fileBaseName, diffBaseName);
                if (similarity >= 0.7) { // 70% similarity threshold
                  try {
                  const encodedPath = encodeURIComponent(diff.new_path);
                  const endpoint = `/projects/${this.projectId}/repository/files/${encodedPath}`;
                  const params = new URLSearchParams({
                    ref: sha
                  });
                  
                  const response = await this.makeRequest(`${endpoint}?${params}`);
                  const data = await response.json();
                  
                  const content = Buffer.from(data.content, 'base64').toString('utf-8');
                  
                  return {
                    content,
                    sha: data.blob_id,
                    filePath: diff.new_path, // Track which path was successfully used
                    originalPath: filePath, // Track what was originally requested
                    foundViaSimilarity: true // Flag that this was found via similarity matching
                  };
                } catch (similarityError) {
                  // Continue trying
                  continue;
                }
                }
              }
            }
          }
        } catch (diffError) {
          // If we can't get diff info, silently continue - this is normal for missing commits/files
          logger.warn(`Could not get commit diff for ${sha}: ${diffError.message}`);
        }
      }
      
      // If all attempts fail, throw error for 404 cases as expected by tests
      if (error.message.includes('404')) {
        logger.warn(`File ${filePath} not found at commit ${sha}`);
        throw new Error('GitLab API error: 404 Not Found - File not found at commit');
      }
      
      // For non-404 errors, still throw them as they indicate real problems
      throw error;
    }
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