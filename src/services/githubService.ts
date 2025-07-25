import logger from '../utils/logger';
import { fetchWithTimeout, TIMEOUT_VALUES } from '../utils/fetchWithTimeout';
import { parseRateLimitError, showRateLimitNotification } from '../utils/rateLimitHandler';
import { parseFilenameMetadata, parseLegacyFilenameMetadata, generateFilename } from '../utils/filenameMetadata';
import { parseMarkdownWithMetadata, stringifyMarkdownWithMetadata } from '../utils/markdown';
import { Todo } from '../types';

// Always use relative URLs - let infrastructure handle routing
// Development: Vite proxy routes /api/* to localhost:3001/api/*
// Production: Same origin serves both frontend and backend
const BACKEND_URL = '';

logger.log('GitHub Service using relative URLs for all environments');

// Request deduplication and caching system
interface CacheEntry {
  promise: Promise<any>;
  timestamp: number;
  data?: any;
}

// In-flight request cache to prevent duplicate simultaneous requests
const inFlightRequests = new Map<string, Promise<any>>();

// Response cache with TTL for frequently accessed data
const responseCache = new Map<string, CacheEntry>();

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  LIST_FILES: 30000,      // 30 seconds for file listings
  LIST_FOLDERS: 60000,    // 1 minute for folder discovery
  FILE_CONTENT: 10000,    // 10 seconds for file content
  DEFAULT: 5000           // 5 seconds default
};

// Generate cache key from request parameters
const getCacheKey = (path: string, method: string, owner?: string, repo?: string) => {
  const keyData = { path, method, owner, repo };
  return JSON.stringify(keyData);
};

// Get cache TTL based on request type
const getCacheTTL = (path: string): number => {
  if (path.includes('/contents/')) return CACHE_TTL.FILE_CONTENT;
  if (path.includes('/repos/') && path.endsWith('/contents')) return CACHE_TTL.LIST_FILES;
  if (path.includes('/repos/') && !path.includes('/contents/')) return CACHE_TTL.LIST_FOLDERS;
  return CACHE_TTL.DEFAULT;
};

// Check if cached response is still valid
const isCacheValid = (entry: CacheEntry, ttl: number): boolean => {
  return Date.now() - entry.timestamp < ttl;
};

// Invalidate cache entries based on pattern matching
const invalidateCache = (pattern: string) => {
  const keysToDelete: string[] = [];
  
  for (const [key] of responseCache.entries()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    responseCache.delete(key);
  }
  
  if (keysToDelete.length > 0) {
    logger.log('GitHub cache invalidated:', keysToDelete.length, 'entries for pattern:', pattern);
  }
};


interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  content: string;
  type?: string;
}

const makeGitHubRequest = async (path: string, method = 'GET', headers = {}, body?: any, owner?: string, repo?: string) => {
  const cacheKey = getCacheKey(path, method, owner, repo);
  const ttl = getCacheTTL(path);
  
  // Check for valid cached response (for read operations only)
  const isReadOperation = method === 'GET';
  if (isReadOperation && responseCache.has(cacheKey)) {
    const cachedEntry = responseCache.get(cacheKey)!;
    if (isCacheValid(cachedEntry, ttl)) {
      logger.log('GitHub request served from cache:', path);
      // Return a mock response with cached data
      return {
        ok: true,
        status: 200,
        json: async () => cachedEntry.data
      } as Response;
    } else {
      // Remove expired cache entry
      responseCache.delete(cacheKey);
    }
  }
  
  // Check for in-flight request
  if (inFlightRequests.has(cacheKey)) {
    logger.log('GitHub request deduplicated (in-flight):', path);
    const inFlightResponse = await inFlightRequests.get(cacheKey)!;
    return inFlightResponse;
  }
  
  // Create new request promise
  const requestPromise = makeActualGitHubRequest(path, method, headers, body, owner, repo);
  
  // Store in-flight request
  inFlightRequests.set(cacheKey, requestPromise);
  
  try {
    const response = await requestPromise;
    
    // Cache successful read operations
    if (isReadOperation && response.ok) {
      const responseData = await response.clone().json();
      responseCache.set(cacheKey, {
        promise: requestPromise,
        timestamp: Date.now(),
        data: responseData
      });
    }
    
    return response;
  } finally {
    // Remove from in-flight cache
    inFlightRequests.delete(cacheKey);
  }
};

const makeActualGitHubRequest = async (path: string, method = 'GET', headers = {}, body?: any, owner?: string, repo?: string) => {
  const proxyUrl = `${BACKEND_URL}/api/github`;
  logger.log('Making proxy request to:', proxyUrl);
  logger.log('Proxy request data:', { path, method, headers: Object.keys(headers), owner, repo });
  
  const response = await fetchWithTimeout(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      method,
      headers,
      body,
      owner,
      repo
    }),
    timeout: TIMEOUT_VALUES.NORMAL,
  });
  
  logger.log('Proxy response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Proxy error:', errorText);
    
    const error = new Error(`GitHub API proxy error: ${response.statusText} - ${errorText}`);
    
    // Check for rate limit errors and show user-friendly message
    const rateLimitInfo = parseRateLimitError(error, 'github');
    if (rateLimitInfo.isRateLimited) {
      showRateLimitNotification(rateLimitInfo);
    }
    
    throw error;
  }
  
  return response;
};

/**
 * Create a new todo with filename-based metadata
 */
export const createTodo = async (
  token: string,
  owner: string,
  repo: string,
  title: string,
  content: string,
  priority: number = 3,
  folder: string = 'todos'
) => {
  logger.log('🆕 Creating todo with filename metadata:', { title, priority, folder });
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = generateFilename(priority, date, title);
  const path = `${folder}/${filename}`;
  
  // Create content with minimal frontmatter
  const frontmatter = { tags: [] };
  const fullContent = stringifyMarkdownWithMetadata(frontmatter, content);
  
  const commitMessage = `feat: Add new todo "${title}" (Priority ${priority})`;
  
  logger.log('✅ NEW FORMAT: Creating file with metadata in filename:', filename);
  
  return createOrUpdateTodo(token, owner, repo, path, fullContent, commitMessage);
};

/**
 * Legacy function for updating existing todos (kept for backward compatibility)
 */
export const createOrUpdateTodo = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  commitMessage: string,
  sha?: string
) => {
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
  logger.log('GitHub API path:', apiPath);
  logger.log('Commit message:', commitMessage);
  logger.log('Content length:', content.length);
  logger.log('SHA:', sha || 'none (new file)');
  
  // Check if file already exists if no SHA is provided
  if (!sha) {
    try {
      logger.log('Checking if file already exists...');
      const existingFile = await getFileMetadata(token, owner, repo, path);
      logger.log('File exists, using existing SHA:', existingFile.sha);
      sha = existingFile.sha;
    } catch (error) {
      logger.log('File does not exist, creating new file');
    }
  }
  
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  
  // Properly encode content to Base64 (handles Unicode characters)
  const utf8Bytes = new TextEncoder().encode(content);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  const encodedContent = btoa(binaryString);
  
  const requestBody: any = {
    message: commitMessage,
    content: encodedContent,
  };
  
  // Only include SHA if we have one
  if (sha) {
    requestBody.sha = sha;
  }

  logger.log('Sending request to GitHub via proxy...');
  const response = await makeGitHubRequest(apiPath, 'PUT', headers, requestBody, owner, repo);
  logger.log('GitHub response status:', response.status);

  const result = await response.json();
  logger.log('GitHub response:', result);
  
  // Invalidate relevant caches after successful write
  const folder = path.split('/')[0];
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents/${folder}"`);
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents/${path}"`);
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents"`);
  
  return result;
};

export const ensureDirectory = async (token: string, owner: string, repo: string, folder: string, commitMessage?: string) => {
  // Check if directory exists
  const checkPath = `/repos/${owner}/${repo}/contents/${folder}`;
  const headers = { Authorization: `token ${token}` };
  
  try {
    await makeGitHubRequest(checkPath, 'GET', headers, undefined, owner, repo);
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    logger.log(`${folder}/ directory not found, creating it...`);
    const createPath = `/repos/${owner}/${repo}/contents/${folder}/.gitkeep`;
    const createBody = {
      message: commitMessage || `feat: Create ${folder} directory`,
      content: btoa(`# This file ensures the ${folder} directory exists\\n`),
    };

    const createResponse = await makeGitHubRequest(createPath, 'PUT', {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    }, createBody, owner, repo);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logger.error(`Failed to create ${folder} directory:`, errorText);
      throw new Error(`Failed to create ${folder} directory: ${createResponse.statusText}`);
    }
    
    logger.log(`${folder}/ directory created successfully`);
  }
};

// Backward compatibility wrapper
export const ensureTodosDirectory = async (token: string, owner: string, repo: string, commitMessage?: string) => {
  return ensureDirectory(token, owner, repo, 'todos', commitMessage);
};

export const getTodos = async (token: string, owner: string, repo: string, folder: string = 'todos', includeArchived = false): Promise<Todo[]> => {
  const apiPath = includeArchived ? `/repos/${owner}/${repo}/contents/${folder}/archive` : `/repos/${owner}/${repo}/contents/${folder}`;
  const headers = { 
    Authorization: `token ${token}`,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  logger.log('🚀 PERFORMANCE BOOST: Fetching todos from:', apiPath);
  
  try {
    const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);

    if (!response.ok) {
      if (response.status === 404) {
        logger.log('todos/ directory not found, returning empty array');
        return [];
      }
      const errorText = await response.text();
      logger.error('GitHub API error response:', errorText);
      throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
    }

    const files: GitHubFile[] = await response.json();
    logger.log('🚀 MASSIVE PERFORMANCE IMPROVEMENT: Got', files.length, 'files with NO individual requests!');
    
    // Filter markdown files
    const markdownFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    
    logger.log('Processing', markdownFiles.length, 'markdown files');
    
    // 🚀 PERFORMANCE OPTIMIZED: Parse metadata from filenames - minimal API calls!
    const todos: Todo[] = [];
    
    for (const file of markdownFiles) {
      // Try new format first (P{priority}--{date}--{title}.md)
      const newFormatMetadata = parseFilenameMetadata(file.name);
      
      if (newFormatMetadata) {
        // ✅ New format: ALL metadata from filename - ZERO additional API calls!
        logger.log('✅ NEW FORMAT: GitHub metadata from filename only:', file.name);
        
        const todo: Todo = {
          id: file.sha,
          title: newFormatMetadata.displayTitle,
          content: '', // Will be loaded on-demand only when editing
          frontmatter: { tags: [] }, // Default tags, loaded on-demand when editing
          path: file.path,
          sha: file.sha,
          priority: newFormatMetadata.priority,
          createdAt: newFormatMetadata.date + 'T00:00:00.000Z',
          isArchived: includeArchived
        };
        
        todos.push(todo);
      } else {
        // Try legacy format with performance optimization (YYYY-MM-DD-title.md)
        const legacyMetadata = parseLegacyFilenameMetadata(file.name);
        
        if (legacyMetadata) {
          // ✅ Legacy format with performance optimization - NO content fetch needed!
          logger.log('🚀 LEGACY OPTIMIZED: GitHub metadata from legacy filename without content fetch:', file.name);
          
          const todo: Todo = {
            id: file.sha,
            title: legacyMetadata.displayTitle,
            content: '', // Will be loaded on-demand only when editing
            frontmatter: { tags: [] }, // Default tags, loaded on-demand when editing
            path: file.path,
            sha: file.sha,
            priority: legacyMetadata.priority, // Default P3 for legacy files
            createdAt: legacyMetadata.date + 'T00:00:00.000Z',
            isArchived: includeArchived
          };
          
          todos.push(todo);
        } else {
          // 🔄 Fallback: Unknown format - needs content fetch (rare case)
          logger.log('⚠️ UNKNOWN FORMAT: Fetching GitHub content for metadata:', file.name);
          
          try {
            const content = await getFileContent(token, owner, repo, file.path);
            const parsed = parseMarkdownWithMetadata(content, file.name, includeArchived);
            
            const todo: Todo = {
              id: file.sha,
              title: parsed.title,
              content, // Already fetched for unknown format files
              frontmatter: parsed.frontmatter,
              path: file.path,
              sha: file.sha,
              priority: parsed.priority ?? 3,
              createdAt: parsed.createdAt,
              isArchived: includeArchived
            };
            
            todos.push(todo);
          } catch (error) {
            logger.error('Error processing unknown format GitHub file:', file.name, error);
            // Continue processing other files
          }
        }
      }
    }
    
    logger.log('🎉 PERFORMANCE SUCCESS: Processed', todos.length, 'todos with minimal API calls!');
    return todos;
    
  } catch (error) {
    logger.error('Error fetching todos:', error);
    // Handle network errors more gracefully
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Load failed'))) {
      logger.log('Network error detected, retrying once...');
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Recursive retry with same performance benefits
        return await getTodos(token, owner, repo, folder, includeArchived);
      } catch (retryError) {
        logger.error('Retry also failed:', retryError);
        return [];
      }
    }
    return [];
  }
};

export const getFileContent = async (token: string, owner: string, repo: string, path: string) => {
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
  const headers = { 
    Authorization: `token ${token}`, 
    Accept: 'application/vnd.github.raw',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.text();
};

export const getFileMetadata = async (token: string, owner: string, repo: string, path: string) => {
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
  const headers = { 
    Authorization: `token ${token}`,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const metadata = await response.json();
  return {
    sha: metadata.sha,
    content: atob(metadata.content),
    path: metadata.path,
    name: metadata.name
  };
};

export const ensureArchiveDirectory = async (token: string, owner: string, repo: string, folder: string = 'todos') => {
  const checkPath = `/repos/${owner}/${repo}/contents/${folder}/archive`;
  const headers = { Authorization: `token ${token}` };
  
  try {
    await makeGitHubRequest(checkPath, 'GET', headers, undefined, owner, repo);
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    logger.log(`${folder}/archive/ directory not found, creating it...`);
    const createPath = `/repos/${owner}/${repo}/contents/${folder}/archive/.gitkeep`;
    const createBody = {
      message: `feat: Create ${folder}/archive directory`,
      content: btoa('# This file ensures the archive directory exists\\n'),
    };

    const createResponse = await makeGitHubRequest(createPath, 'PUT', {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    }, createBody, owner, repo);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      logger.error(`Failed to create ${folder}/archive directory:`, errorText);
      throw new Error(`Failed to create ${folder}/archive directory: ${createResponse.statusText}`);
    }
    
    logger.log(`${folder}/archive/ directory created successfully`);
  }
};

export const moveTaskToArchive = async (
  token: string,
  owner: string,
  repo: string,
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  logger.log('Moving task to archive:', currentPath);
  
  // Ensure archive directory exists
  await ensureArchiveDirectory(token, owner, repo, folder);
  
  // Get current file SHA for deletion
  const currentFile = await getFileMetadata(token, owner, repo, currentPath);
  
  // Determine new path in archive
  const fileName = currentPath.split('/').pop();
  const archivePath = `${folder}/archive/${fileName}`;
  
  // Create file in archive
  logger.log('Creating archived file at:', archivePath);
  await createOrUpdateTodo(token, owner, repo, archivePath, content, commitMessage);
  
  // Delete from original location
  logger.log('Deleting original file at:', currentPath);
  await deleteFile(token, owner, repo, currentPath, currentFile.sha, `Archive: Remove ${fileName} from active ${folder}`);
  
  return archivePath;
};

export const moveTaskFromArchive = async (
  token: string,
  owner: string,
  repo: string,
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  logger.log('Moving task from archive:', currentPath);
  
  // Get current file SHA for deletion
  const currentFile = await getFileMetadata(token, owner, repo, currentPath);
  
  // Determine new path in active folder
  const fileName = currentPath.split('/').pop();
  const activePath = `${folder}/${fileName}`;
  
  // Create file in active folder
  logger.log('Creating unarchived file at:', activePath);
  await createOrUpdateTodo(token, owner, repo, activePath, content, commitMessage);
  
  // Delete from archive location
  logger.log('Deleting archived file at:', currentPath);
  await deleteFile(token, owner, repo, currentPath, currentFile.sha, `Unarchive: Remove ${fileName} from ${folder}/archive`);
  
  return activePath;
};

export const deleteFile = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
  commitMessage: string
) => {
  const apiPath = `/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  
  const requestBody = {
    message: commitMessage,
    sha: sha,
  };

  logger.log('Deleting file via proxy:', apiPath);
  const response = await makeGitHubRequest(apiPath, 'DELETE', headers, requestBody, owner, repo);
  
  logger.log('File deleted successfully:', path);
  
  // Invalidate relevant caches after successful deletion
  const folder = path.split('/')[0];
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents/${folder}"`);
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents/${path}"`);
  invalidateCache(`"path":"/repos/${owner}/${repo}/contents"`);
  
  return await response.json();
};

export const getFileHistory = async (
  token: string,
  owner: string,
  repo: string,
  path: string
) => {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/git-history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
    },
    body: JSON.stringify({ path, owner, repo }),
    timeout: TIMEOUT_VALUES.NORMAL,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch file history:', errorText);
    throw new Error(`Failed to fetch file history: ${response.statusText}`);
  }

  const data = await response.json();
  return data.commits;
};

export const listProjectFolders = async (
  token: string,
  owner: string,
  repo: string
): Promise<string[]> => {
  const apiPath = `/repos/${owner}/${repo}/contents/`;
  const headers = { Authorization: `token ${token}` };
  
  try {
    const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);
    
    const contents = await response.json();
    
    // Filter for directories that might contain todo files
    const folders = contents
      .filter((item: any) => item.type === 'dir')
      .map((item: any) => item.name)
      .filter((name: string) => 
        // Include common project folder patterns
        name.includes('todo') || 
        name.includes('task') || 
        name.includes('project') ||
        name.includes('work') ||
        name.includes('personal') ||
        name === 'todos' || // Default
        name.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/) // Valid folder names
      );
    
    // Always include 'todos' as default if not present
    if (!folders.includes('todos')) {
      folders.unshift('todos');
    }
    
    return folders;
  } catch (error) {
    logger.error('Error listing project folders:', error);
    return ['todos']; // Default fallback
  }
};

export const createProjectFolder = async (
  token: string,
  owner: string,
  repo: string,
  folderName: string
): Promise<void> => {
  // Validate folder name
  if (!folderName?.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
    throw new Error('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
  }
  
  const gitkeepPath = `${folderName}/.gitkeep`;
  const commitMessage = `feat: Create ${folderName} project folder`;
  
  const gitkeepContent = `# ${folderName} Project\n\nThis file ensures the ${folderName} directory exists in the repository.\n`;
  
  await createOrUpdateTodo(token, owner, repo, gitkeepPath, gitkeepContent, commitMessage);
  
  // Also create the archive subdirectory
  const archiveGitkeepPath = `${folderName}/archive/.gitkeep`;
  const archiveCommitMessage = `feat: Create ${folderName}/archive directory`;
  const archiveContent = `# ${folderName}/archive\n\nThis directory contains archived tasks from the ${folderName} project.\n`;
  
  await createOrUpdateTodo(token, owner, repo, archiveGitkeepPath, archiveContent, archiveCommitMessage);
};

export const getFileAtCommit = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string
) => {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/file-at-commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `token ${token}`,
    },
    body: JSON.stringify({ path, sha, owner, repo }),
    timeout: TIMEOUT_VALUES.NORMAL,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Failed to fetch file at commit:', errorText);
    throw new Error(`Failed to fetch file at commit: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};