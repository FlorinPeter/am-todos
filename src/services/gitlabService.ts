// GitLab API service for frontend
// This service handles GitLab API calls through the backend proxy

import logger from '../utils/logger';
import { parseRateLimitError, showRateLimitNotification } from '../utils/rateLimitHandler';
import { parseFilenameMetadata, parseLegacyFilenameMetadata, generateFilename } from '../utils/filenameMetadata';
import { parseMarkdownWithMetadata, stringifyMarkdownWithMetadata } from '../utils/markdown';
import { Todo } from '../types';

// Always use relative URLs - let infrastructure handle routing
// Development: Vite proxy routes /api/* to localhost:3001/api/*
// Production: Same origin serves both frontend and backend
const BACKEND_URL = '';

logger.log('GitLab Service using relative URLs for all environments');

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
const getCacheKey = (action: string, settings: GitLabSettings, params: any = {}) => {
  const keyData = {
    action,
    instanceUrl: settings.instanceUrl,
    projectId: settings.projectId,
    branch: settings.branch,
    ...params
  };
  const key = JSON.stringify(keyData);
  
  // **GRANULAR DEBUG LOGGING** - Track cache key generation with unique ID
  const keyId = `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  logger.log('🔑 GitLab Cache Key Generated:', {
    keyId,
    action,
    keyLength: key.length,
    keyPreview: key.substring(0, 80) + '...',
    keyHash: key.substring(0, 20) + '...' + key.substring(-20),
    keyData: keyData,
    // **DEBUG** - Log exact JSON for comparison
    fullKey: key.length < 200 ? key : key.substring(0, 100) + '...[truncated]...' + key.substring(-100),
    timestamp: Date.now()
  });
  
  return key;
};

// Get cache TTL based on action type
const getCacheTTL = (action: string): number => {
  if (action === 'listFiles') return CACHE_TTL.LIST_FILES;
  if (action === 'getRepositoryTree') return CACHE_TTL.LIST_FOLDERS;
  if (action === 'getRawFile' || action === 'getFile') return CACHE_TTL.FILE_CONTENT;
  return CACHE_TTL.DEFAULT;
};

// Check if cached response is still valid
const isCacheValid = (entry: CacheEntry, ttl: number): boolean => {
  return Date.now() - entry.timestamp < ttl;
};

// Invalidate cache entries based on pattern matching
const invalidateCache = (pattern: string) => {
  const keysToDelete: string[] = [];
  const beforeSize = responseCache.size;
  
  for (const [key] of responseCache.entries()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  
  // **CONSERVATIVE INVALIDATION** - Only invalidate if we have keys to delete
  if (keysToDelete.length > 0) {
    for (const key of keysToDelete) {
      responseCache.delete(key);
    }
    
    logger.log('🗑️ GitLab Cache Invalidated:', {
      pattern: pattern.substring(0, 50) + '...',
      keysDeleted: keysToDelete.length,
      beforeSize,
      afterSize: responseCache.size,
      deletedKeys: keysToDelete.map(k => k.substring(0, 60) + '...')
    });
  } else {
    logger.log('🔍 GitLab Cache Invalidation: No matching keys for pattern:', pattern.substring(0, 50) + '...');
  }
};

interface GitLabFile {
  name: string;
  path: string;
  sha: string;
  content?: string;
  type?: string;
}

interface GitLabSettings {
  instanceUrl: string;
  projectId: string;
  token: string;
  branch: string;
}

const makeGitLabRequest = async (action: string, settings: GitLabSettings, params: any = {}) => {
  const requestStartTime = Date.now();
  const requestId = `${action}-${requestStartTime}-${Math.random().toString(36).substr(2, 6)}`;
  const cacheKey = getCacheKey(action, settings, params);
  const ttl = getCacheTTL(action);
  
  // **GRANULAR DEBUG LOGGING** - Track all requests with detailed info
  logger.log('🔍 GitLab Request Debug:', {
    requestId,
    action,
    cacheKey: cacheKey, // Full cache key for debugging
    cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20), // Start and end for comparison
    params,
    cacheSize: responseCache.size,
    inFlightSize: inFlightRequests.size,
    timestamp: requestStartTime
  });
  
  // **DEBUG** - Log all current cache keys for comparison
  if (responseCache.size > 0) {
    const cacheKeys = Array.from(responseCache.keys()).map(key => ({
      keyHash: key.substring(0, 20) + '...' + key.substring(-20),
      age: Date.now() - responseCache.get(key)!.timestamp
    }));
    logger.log('🗂️ GitLab Current Cache Keys:', { requestId, cacheKeys });
  }
  
  // **DEBUG** - Log all current in-flight request keys for comparison
  if (inFlightRequests.size > 0) {
    const inFlightKeys = Array.from(inFlightRequests.keys()).map(key => 
      key.substring(0, 20) + '...' + key.substring(-20)
    );
    logger.log('🛫 GitLab Current In-Flight Keys:', { requestId, inFlightKeys });
  }
  
  // Check for valid cached response (for read operations only)
  const isReadOperation = ['listFiles', 'getRepositoryTree', 'getRawFile', 'getFile', 'getFileHistory'].includes(action);
  if (isReadOperation && responseCache.has(cacheKey)) {
    const cachedEntry = responseCache.get(cacheKey)!;
    const age = Date.now() - cachedEntry.timestamp;
    if (isCacheValid(cachedEntry, ttl)) {
      logger.log('✅ GitLab CACHE HIT:', {
        requestId,
        action,
        age: `${Math.round(age/1000)}s`,
        ttl: `${ttl/1000}s`,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
      });
      // Return a mock response with cached data
      return {
        ok: true,
        status: 200,
        json: async () => cachedEntry.data
      } as Response;
    } else {
      logger.log('❌ GitLab CACHE EXPIRED:', {
        requestId,
        action,
        age: `${Math.round(age/1000)}s`,
        ttl: `${ttl/1000}s`,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
      });
      // Remove expired cache entry
      responseCache.delete(cacheKey);
    }
  } else if (isReadOperation) {
    logger.log('❌ GitLab CACHE MISS:', {
      requestId,
      action,
      hasKey: responseCache.has(cacheKey),
      cacheSize: responseCache.size,
      cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
      // **DEBUG** - Check if any cache keys are similar
      similarKeys: responseCache.size > 0 ? Array.from(responseCache.keys())
        .filter(key => key.includes(action))
        .map(key => key.substring(0, 20) + '...' + key.substring(-20))
        .slice(0, 3) : []
    });
  }
  
  // **FIXED RACE CONDITION** - Atomic check-and-set for in-flight requests
  logger.log('🔍 GitLab In-Flight Check:', {
    requestId,
    action,
    hasInFlightRequest: inFlightRequests.has(cacheKey),
    cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
    inFlightCount: inFlightRequests.size,
    // **DEBUG** - Check for exact key matches
    exactKeyMatch: Array.from(inFlightRequests.keys()).some(key => key === cacheKey),
    // **DEBUG** - Check for similar keys
    inFlightKeysForAction: Array.from(inFlightRequests.keys())
      .filter(key => key.includes(action))
      .map(key => key.substring(0, 20) + '...' + key.substring(-20))
  });
  
  // Check for existing in-flight request
  const existingInFlightRequest = inFlightRequests.get(cacheKey);
  if (existingInFlightRequest) {
    logger.log('🔄 GitLab DEDUPLICATION HIT:', {
      requestId,
      action,
      inFlightCount: inFlightRequests.size,
      cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
    });
    
    try {
      // Wait for the existing in-flight request
      const inFlightResponse = await existingInFlightRequest;
      
      // Clone the response since it might have been consumed
      const clonedResponse = {
        ok: inFlightResponse.ok,
        status: inFlightResponse.status,
        json: async () => {
          // Try to get from cache first (it should be there now)
          if (responseCache.has(cacheKey)) {
            return responseCache.get(cacheKey)!.data;
          }
          // Fallback to cloning if available
          return await inFlightResponse.clone().json();
        }
      } as Response;
      
      logger.log('✅ GitLab DEDUPLICATION SUCCESS:', {
        requestId,
        action,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
      });
      
      return clonedResponse;
    } catch (error) {
      logger.error('❌ GitLab In-Flight Request Error:', { 
        requestId, 
        action, 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Remove the failed in-flight request and continue with new request
      inFlightRequests.delete(cacheKey);
    }
  }
  
  // **SECOND CACHE CHECK** - Another request might have just completed and cached the result
  if (isReadOperation && responseCache.has(cacheKey)) {
    const cachedEntry = responseCache.get(cacheKey)!;
    const age = Date.now() - cachedEntry.timestamp;
    if (isCacheValid(cachedEntry, ttl)) {
      logger.log('✅ GitLab SECOND CACHE HIT:', {
        requestId,
        action,
        age: `${Math.round(age/1000)}s`,
        ttl: `${ttl/1000}s`,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
        message: 'Cache populated by another request while we were checking in-flight'
      });
      // Return a mock response with cached data
      return {
        ok: true,
        status: 200,
        json: async () => cachedEntry.data
      } as Response;
    } else {
      logger.log('❌ GitLab SECOND CACHE EXPIRED:', {
        requestId,
        action,
        age: `${Math.round(age/1000)}s`,
        ttl: `${ttl/1000}s`,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
      });
      // Remove expired cache entry
      responseCache.delete(cacheKey);
    }
  }
  
  // No existing in-flight request, create new one
  logger.log('🆕 GitLab NEW REQUEST:', {
    requestId,
    action,
    inFlightCount: inFlightRequests.size,
    cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
    timeSinceStart: Date.now() - requestStartTime
  });
  
  // Create new request promise with better error handling
  const requestPromise = makeActualGitLabRequest(action, settings, params).catch(error => {
    // Remove from in-flight cache on error
    logger.log('❌ GitLab Request Error:', { requestId, action, error: error.message });
    inFlightRequests.delete(cacheKey);
    throw error;
  });
  
  // **ATOMIC OPERATION** - Set in-flight request immediately to prevent race conditions
  logger.log('🛫 GitLab STORING IN-FLIGHT:', {
    requestId,
    action,
    cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
    inFlightCountBefore: inFlightRequests.size,
    timeSinceStart: Date.now() - requestStartTime
  });
  inFlightRequests.set(cacheKey, requestPromise);
  
  // **RACE CONDITION SAFEGUARD** - Verify our promise is actually stored
  const storedPromise = inFlightRequests.get(cacheKey);
  if (storedPromise !== requestPromise) {
    logger.log('⚠️ GitLab RACE CONDITION DETECTED:', {
      requestId,
      action,
      cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
      ourPromiseId: requestPromise.toString().substring(0, 50),
      storedPromiseId: storedPromise?.toString().substring(0, 50),
      message: 'Another request overwrote our in-flight promise - using stored one'
    });
    
    // Use the stored promise instead (another request got there first)
    try {
      const raceResponse = await storedPromise!;
      logger.log('✅ GitLab RACE CONDITION RESOLVED:', {
        requestId,
        action,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20)
      });
      return raceResponse;
    } catch (error) {
      logger.error('❌ GitLab Race Condition Promise Failed:', { requestId, action, error: error instanceof Error ? error.message : String(error) });
      // Fall through to execute our own promise
    }
  }
  
  try {
    const response = await requestPromise;
    
    // Cache successful read operations
    if (isReadOperation && response.ok) {
      const responseData = await response.clone().json();
      const storageTime = Date.now();
      
      // **CACHE KEY VALIDATION** - Regenerate key to ensure consistency
      const validationKey = getCacheKey(action, settings, params);
      const keyMatches = validationKey === cacheKey;
      
      responseCache.set(cacheKey, {
        promise: requestPromise,
        timestamp: storageTime,
        data: responseData
      });
      
      logger.log('💾 GitLab CACHE STORED:', {
        requestId,
        action,
        cacheSize: responseCache.size,
        dataType: Array.isArray(responseData) ? `array[${responseData.length}]` : typeof responseData,
        cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
        totalRequestTime: storageTime - requestStartTime,
        timestamp: storageTime,
        // **DEBUG** - Cache key validation
        keyValidation: {
          keyMatches,
          originalKeyLength: cacheKey.length,
          validationKeyLength: validationKey.length,
          ...(keyMatches ? {} : {
            originalKeyEnd: cacheKey.substring(-40),
            validationKeyEnd: validationKey.substring(-40)
          })
        }
      });
      
      // **IMMEDIATE VERIFICATION** - Test if we can immediately retrieve what we just stored
      const immediateTest = responseCache.has(cacheKey);
      if (!immediateTest) {
        logger.error('🚨 GitLab CACHE STORAGE FAILED:', {
          requestId,
          action,
          cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
          message: 'Could not retrieve immediately after storage'
        });
      }
    }
    
    return response;
  } finally {
    // Remove from in-flight cache
    const completionTime = Date.now();
    inFlightRequests.delete(cacheKey);
    logger.log('🏁 GitLab REQUEST COMPLETED:', {
      requestId,
      action,
      inFlightRemaining: inFlightRequests.size,
      cacheKeyHash: cacheKey.substring(0, 20) + '...' + cacheKey.substring(-20),
      totalRequestTime: completionTime - requestStartTime,
      timestamp: completionTime
    });
  }
};

const makeActualGitLabRequest = async (action: string, settings: GitLabSettings, params: any = {}) => {
  const proxyUrl = `${BACKEND_URL}/api/gitlab`;
  logger.log('Making GitLab proxy request to:', proxyUrl);
  logger.log('GitLab request data:', { action, instanceUrl: settings.instanceUrl, projectId: settings.projectId, branch: settings.branch, ...params });
  
  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      instanceUrl: settings.instanceUrl,
      projectId: settings.projectId,
      token: settings.token,
      branch: settings.branch,
      ...params
    })
  });
  
  logger.log('GitLab proxy response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    logger.error('GitLab proxy error:', errorText);
    
    const error = new Error(`GitLab API proxy error: ${response.statusText} - ${errorText}`);
    
    // Check for rate limit errors and show user-friendly message
    const rateLimitInfo = parseRateLimitError(error, 'gitlab');
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
  settings: GitLabSettings,
  title: string,
  content: string,
  priority: number = 3,
  folder: string = 'todos'
) => {
  logger.log('🆕 Creating GitLab todo with filename metadata:', { title, priority, folder });
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = generateFilename(priority, date, title);
  const path = `${folder}/${filename}`;
  
  // Create content with minimal frontmatter
  const frontmatter = { tags: [] };
  const fullContent = stringifyMarkdownWithMetadata(frontmatter, content);
  
  const commitMessage = `feat: Add new todo "${title}" (Priority ${priority})`;
  
  logger.log('✅ NEW FORMAT: Creating GitLab file with metadata in filename:', filename);
  
  return createOrUpdateTodo(settings, path, fullContent, commitMessage);
};

/**
 * Legacy function for updating existing todos (kept for backward compatibility)
 */
export const createOrUpdateTodo = async (
  settings: GitLabSettings,
  path: string,
  content: string,
  commitMessage: string
) => {
  logger.log('GitLab createOrUpdateTodo:', path);
  logger.log('Commit message:', commitMessage);
  logger.log('Content length:', content.length);
  
  const response = await makeGitLabRequest('createOrUpdateFile', settings, {
    filePath: path,
    content,
    commitMessage
  });

  const result = await response.json();
  logger.log('GitLab createOrUpdateTodo response:', result);
  
  // Invalidate relevant caches after successful write
  const folder = path.split('/')[0];
  invalidateCache(`"action":"listFiles"`);
  invalidateCache(`"path":"${folder}"`);
  invalidateCache(`"filePath":"${path}"`);
  invalidateCache(`"action":"getRepositoryTree"`);
  
  return result;
};

export const ensureDirectory = async (settings: GitLabSettings, folder: string, commitMessage?: string) => {
  // Check if directory exists by trying to list files
  try {
    await getTodos(settings, folder);
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    logger.log(`${folder}/ directory not found, creating it...`);
    const gitkeepPath = `${folder}/.gitkeep`;
    const gitkeepContent = `# This file ensures the ${folder} directory exists\n`;
    
    await createOrUpdateTodo(settings, gitkeepPath, gitkeepContent, commitMessage || `feat: Create ${folder} directory`);
    logger.log(`${folder}/ directory created successfully`);
  }
};

export const getTodos = async (settings: GitLabSettings, folder: string = 'todos', includeArchived = false): Promise<Todo[]> => {
  const path = includeArchived ? `${folder}/archive` : folder;
  logger.log('🚀 PERFORMANCE BOOST: Fetching GitLab todos from:', path);
  
  try {
    const response = await makeGitLabRequest('listFiles', settings, { path });
    const files: GitLabFile[] = await response.json();
    
    logger.log('🚀 MASSIVE PERFORMANCE IMPROVEMENT: Got', files.length, 'GitLab files with NO individual requests!');
    
    // Filter markdown files
    const markdownFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    
    logger.log('Processing', markdownFiles.length, 'GitLab markdown files');
    
    // 🚀 PERFORMANCE OPTIMIZED: Parse metadata from filenames - minimal API calls!
    const todos: Todo[] = [];
    
    for (const file of markdownFiles) {
      // Try new format first (P{priority}--{date}--{title}.md)
      const newFormatMetadata = parseFilenameMetadata(file.name);
      
      if (newFormatMetadata) {
        // ✅ New format: ALL metadata from filename - ZERO additional API calls!
        logger.log('✅ NEW FORMAT: GitLab metadata from filename only:', file.name);
        
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
          logger.log('🚀 LEGACY OPTIMIZED: GitLab metadata from legacy filename without content fetch:', file.name);
          
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
          logger.log('⚠️ UNKNOWN FORMAT: Fetching GitLab content for metadata:', file.name);
          
          try {
            const content = await getFileContent(settings, file.path);
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
            logger.error('Error processing unknown format GitLab file:', file.name, error);
            // Continue processing other files
          }
        }
      }
    }
    
    logger.log('🎉 GITLAB PERFORMANCE SUCCESS: Processed', todos.length, 'todos with minimal API calls!');
    return todos;
    
  } catch (error) {
    logger.error('Error fetching GitLab todos:', error);
    // Handle network errors more gracefully
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Load failed'))) {
      logger.log('Network error detected, retrying once...');
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Recursive retry with same performance benefits
        return await getTodos(settings, folder, includeArchived);
      } catch (retryError) {
        logger.error('Retry also failed:', retryError);
        return [];
      }
    }
    return [];
  }
};

export const getFileContent = async (settings: GitLabSettings, path: string) => {
  logger.log('Getting GitLab file content:', path);
  
  const response = await makeGitLabRequest('getRawFile', settings, { filePath: path });
  const data = await response.json();
  return data.content;
};

export const getFileMetadata = async (settings: GitLabSettings, path: string) => {
  logger.log('Getting GitLab file metadata:', path);
  
  const response = await makeGitLabRequest('getFile', settings, { filePath: path });
  logger.log('GitLab getFileMetadata response status:', response.status);
  
  const responseText = await response.text();
  logger.log('GitLab getFileMetadata raw response:', responseText.substring(0, 200) + '...');
  
  let metadata;
  try {
    metadata = JSON.parse(responseText);
  } catch (parseError) {
    logger.error('GitLab getFileMetadata JSON parse error:', parseError);
    logger.error('GitLab getFileMetadata full response:', responseText);
    throw new Error(`Failed to parse GitLab API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
  
  logger.log('GitLab getFileMetadata parsed keys:', Object.keys(metadata));
  
  return {
    sha: metadata.sha,
    content: metadata.content,
    path: metadata.path,
    name: metadata.name
  };
};

export const ensureArchiveDirectory = async (settings: GitLabSettings, folder: string = 'todos') => {
  const archivePath = `${folder}/archive`;
  
  try {
    await getTodos(settings, folder, true); // Try to list archived todos
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    logger.log(`${archivePath}/ directory not found, creating it...`);
    const gitkeepPath = `${archivePath}/.gitkeep`;
    const gitkeepContent = `# This file ensures the archive directory exists\n`;
    
    await createOrUpdateTodo(settings, gitkeepPath, gitkeepContent, `feat: Create ${archivePath} directory`);
    logger.log(`${archivePath}/ directory created successfully`);
  }
};

export const moveTaskToArchive = async (
  settings: GitLabSettings,
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  logger.log('Moving GitLab task to archive:', currentPath);
  
  // Ensure archive directory exists
  await ensureArchiveDirectory(settings, folder);
  
  // Determine new path in archive
  const fileName = currentPath.split('/').pop();
  const archivePath = `${folder}/archive/${fileName}`;
  
  // Create file in archive
  logger.log('Creating archived file at:', archivePath);
  await createOrUpdateTodo(settings, archivePath, content, commitMessage);
  
  // Delete from original location
  logger.log('Deleting original file at:', currentPath);
  await deleteFile(settings, currentPath, `Archive: Remove ${fileName} from active ${folder}`);
  
  return archivePath;
};

export const moveTaskFromArchive = async (
  settings: GitLabSettings,
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  logger.log('Moving GitLab task from archive:', currentPath);
  
  // Determine new path in active folder
  const fileName = currentPath.split('/').pop();
  const activePath = `${folder}/${fileName}`;
  
  // Create file in active folder
  logger.log('Creating unarchived file at:', activePath);
  await createOrUpdateTodo(settings, activePath, content, commitMessage);
  
  // Delete from archive location
  logger.log('Deleting archived file at:', currentPath);
  await deleteFile(settings, currentPath, `Unarchive: Remove ${fileName} from ${folder}/archive`);
  
  return activePath;
};

export const deleteFile = async (
  settings: GitLabSettings,
  path: string,
  commitMessage: string
) => {
  logger.log('Deleting GitLab file:', path);
  
  const response = await makeGitLabRequest('deleteFile', settings, {
    filePath: path,
    commitMessage
  });
  
  const result = await response.json();
  logger.log('GitLab file deleted successfully:', path);
  
  // Invalidate relevant caches after successful deletion
  const folder = path.split('/')[0];
  invalidateCache(`"action":"listFiles"`);
  invalidateCache(`"path":"${folder}"`);
  invalidateCache(`"filePath":"${path}"`);
  invalidateCache(`"action":"getRepositoryTree"`);
  
  return result;
};

export const getFileHistory = async (
  settings: GitLabSettings,
  path: string
) => {
  logger.log('Getting GitLab file history:', path);
  
  const response = await makeGitLabRequest('getFileHistory', settings, { filePath: path });
  const commits = await response.json();
  
  return commits;
};

export const getFileAtCommit = async (
  settings: GitLabSettings,
  path: string,
  sha: string
) => {
  logger.log('Getting GitLab file at commit:', path, sha);
  
  const response = await makeGitLabRequest('getFileAtCommit', settings, { filePath: path, sha });
  const data = await response.json();
  
  return data;
};

export const getProject = async (settings: GitLabSettings) => {
  logger.log('Getting GitLab project info');
  
  const response = await makeGitLabRequest('getProject', settings);
  const project = await response.json();
  
  return project;
};

export const listProjectFolders = async (settings: GitLabSettings): Promise<string[]> => {
  try {
    logger.log('GitLab: Discovering actual repository directories...');
    
    // Use GitLab repository tree API to get actual directories at root level
    const response = await makeGitLabRequest('getRepositoryTree', settings, { 
      path: '', // Root level
      recursive: false // Only top-level directories
    });
    
    const treeItems = await response.json();
    logger.log('GitLab: Raw tree response:', treeItems.length, 'items');
    
    // Filter for directories only (type === 'tree')
    const directories: string[] = treeItems
      .filter((item: any) => item.type === 'tree')
      .map((item: any) => item.name);
    
    logger.log('GitLab: Found actual directories:', directories);
    
    // Filter directories that might be project folders (contain common patterns or be reasonably named)
    const projectFolders = directories.filter((name: string) => {
      // Exclude common system/technical folders
      const systemFolders = [
        'src', 'lib', 'bin', 'build', 'dist', 'node_modules', '.git', '.github', 
        '.gitlab', 'vendor', 'target', 'out', 'public', 'static', 'assets',
        'docs', 'documentation', 'spec', 'test', 'tests', '__tests__', 'cypress',
        'coverage', '.next', '.nuxt', '.vscode', '.idea', 'tmp', 'temp'
      ];
      
      if (systemFolders.includes(name.toLowerCase())) {
        return false;
      }
      
      // Include common project folder patterns
      return name.includes('todo') || 
             name.includes('task') || 
             name.includes('project') ||
             name.includes('work') ||
             name.includes('personal') ||
             name === 'todos' || // Default
             name.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/) // Valid folder names
    });
    
    logger.log('GitLab: Filtered project folders:', projectFolders);
    
    // Always include 'todos' as default if no project folders found
    if (projectFolders.length === 0) {
      projectFolders.push('todos');
    }
    
    return [...new Set(projectFolders)]; // Remove duplicates
  } catch (error) {
    logger.error('Error listing GitLab project folders:', error);
    return ['todos']; // Default fallback
  }
};

export const createProjectFolder = async (
  settings: GitLabSettings,
  folderName: string
): Promise<void> => {
  // Validate folder name
  if (!folderName?.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
    throw new Error('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
  }
  
  const gitkeepPath = `${folderName}/.gitkeep`;
  const commitMessage = `feat: Create ${folderName} project folder`;
  
  const gitkeepContent = `# ${folderName} Project\n\nThis file ensures the ${folderName} directory exists in the repository.\n`;
  
  await createOrUpdateTodo(settings, gitkeepPath, gitkeepContent, commitMessage);
  
  // Also create the archive subdirectory
  const archiveGitkeepPath = `${folderName}/archive/.gitkeep`;
  const archiveCommitMessage = `feat: Create ${folderName}/archive directory`;
  const archiveContent = `# ${folderName}/archive\n\nThis directory contains archived tasks from the ${folderName} project.\n`;
  
  await createOrUpdateTodo(settings, archiveGitkeepPath, archiveContent, archiveCommitMessage);
};