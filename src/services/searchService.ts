import { loadSettings } from '../utils/localStorage';
import type { GeneralSettings } from '../utils/localStorage';
import logger from '../utils/logger';
import { validateAndSanitizeSearchQuery } from '../utils/redosProtection';
import { fetchWithTimeout, TIMEOUT_VALUES } from '../utils/fetchWithTimeout';

// Always use relative URLs - let infrastructure handle routing
// Development: Vite proxy routes /api/* to localhost:3001/api/*
// Production: Same origin serves both frontend and backend
const getApiUrl = () => '/api/search';

// Search result interface
// NOTE: Backend normalizes GitHub and GitLab responses to consistent format
export interface SearchResult {
  path: string;
  name: string;         // Normalized: GitHub 'name' / GitLab 'filename' -> 'name'
  sha: string;          // Normalized: GitHub 'sha' / GitLab 'ref' -> 'sha'
  url: string;
  repository: string;
  text_matches: any[];
  priority?: number;    // Enhanced search results now include priority from filename metadata
  displayTitle?: string; // Parsed title with spaces restored from filename metadata
}

export interface SearchResponse {
  query: string;
  scope: 'folder' | 'repo';
  total_count: number;
  items: SearchResult[];
}

// No caching - removed to prevent stale data issues

// Debounce utility
let debounceTimer: number | null = null;

const getGeneralSettings = () => {
  const settings: GeneralSettings | null = loadSettings();
  if (!settings) {
    throw new Error('No settings configured. Please configure your general settings first.');
  }

  const provider = settings.gitProvider || 'github';
  
  if (provider === 'github') {
    // Check new dual-configuration format first
    if (settings.github) {
      if (!settings.github.pat || !settings.github.owner || !settings.github.repo) {
        throw new Error('GitHub settings incomplete. Please configure your Personal Access Token, owner, and repository.');
      }
      return {
        provider: 'github',
        token: settings.github.pat, // GitHub uses 'pat' field but we call it 'token' in the API
        owner: settings.github.owner,
        repo: settings.github.repo,
        folder: settings.folder || 'todos'
      };
    } else {
      // Fallback to legacy direct fields
      if (!settings.pat || !settings.owner || !settings.repo) {
        throw new Error('GitHub settings incomplete. Please configure your Personal Access Token, owner, and repository.');
      }
      return {
        provider: 'github',
        token: settings.pat, // GitHub uses 'pat' field but we call it 'token' in the API
        owner: settings.owner,
        repo: settings.repo,
        folder: settings.folder || 'todos'
      };
    }
  } else if (provider === 'gitlab') {
    // Check new dual-configuration format first
    if (settings.gitlab) {
      if (!settings.gitlab.token || !settings.gitlab.instanceUrl || !settings.gitlab.projectId) {
        throw new Error('GitLab settings incomplete. Please configure your Access Token, instance URL, and project ID.');
      }
      return {
        provider: 'gitlab',
        token: settings.gitlab.token,
        instanceUrl: settings.gitlab.instanceUrl,
        projectId: settings.gitlab.projectId,
        folder: settings.folder || 'todos'
      };
    } else {
      // Fallback to legacy direct fields
      if (!settings.token || !settings.instanceUrl || !settings.projectId) {
        throw new Error('GitLab settings incomplete. Please configure your Access Token, instance URL, and project ID.');
      }
      return {
        provider: 'gitlab',
        token: settings.token,
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        folder: settings.folder || 'todos'
      };
    }
  } else {
    throw new Error('Invalid Git provider configured. Please select GitHub or GitLab.');
  }
};

// Cache utility functions removed

export const searchTodos = async (
  query: string, 
  scope: 'folder' | 'repo' = 'folder'
): Promise<SearchResponse> => {
  if (!query || query.trim().length === 0) {
    return {
      query: '',
      scope,
      total_count: 0,
      items: []
    };
  }

  // ReDoS protection: Validate and sanitize search query
  const validation = validateAndSanitizeSearchQuery(query.trim());
  if (!validation.isValid) {
    throw new Error(`Invalid search query: ${validation.error}`);
  }

  const sanitizedQuery = validation.sanitizedQuery!;
  logger.log('Search query sanitized:', { original: query, sanitized: sanitizedQuery });

  try {
    const gitSettings = getGeneralSettings();
    const apiUrl = getApiUrl();
    logger.log('Performing search:', { query: sanitizedQuery, scope, provider: gitSettings.provider });

    const requestBody: any = {
      query: sanitizedQuery,
      scope,
      folder: gitSettings.folder,
      provider: gitSettings.provider
    };

    // Add provider-specific credentials
    if (gitSettings.provider === 'github') {
      requestBody.owner = gitSettings.owner;
      requestBody.repo = gitSettings.repo;
      requestBody.token = gitSettings.token;
    } else if (gitSettings.provider === 'gitlab') {
      requestBody.instanceUrl = gitSettings.instanceUrl;
      requestBody.projectId = gitSettings.projectId;
      requestBody.token = gitSettings.token;
    }

    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      timeout: TIMEOUT_VALUES.NORMAL,
    });

    if (!response.ok) {
      let errorMessage = `Search API error: ${response.statusText}`;
      
      try {
        // Get response text first, then try to parse as JSON
        const responseText = await response.text();
        logger.error('Search API error response:', responseText);
        
        try {
          // Try to parse as JSON to get structured error message
          const errorData = JSON.parse(responseText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          // If JSON parsing fails, use the raw text
          if (responseText) {
            errorMessage = responseText;
          }
        }
      } catch (responseError) {
        // If reading response fails, use default message
        logger.error('Failed to read error response:', responseError);
      }
      
      throw new Error(errorMessage);
    }

    const data: SearchResponse = await response.json();
    
    logger.log('Search completed:', { query, scope, totalResults: data.total_count });
    return data;

  } catch (error) {
    logger.error('Search service error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to search service. Please check if the backend server is running.');
    }
    throw error;
  }
};

export const searchTodosDebounced = (
  query: string,
  scope: 'folder' | 'repo' = 'folder',
  callback: (results: SearchResponse | null, error: string | null) => void,
  delay: number = 300
): void => {
  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // If query is empty, return empty results immediately
  if (!query || query.trim().length === 0) {
    callback({
      query: '',
      scope,
      total_count: 0,
      items: []
    }, null);
    return;
  }

  // Set new timer
  debounceTimer = window.setTimeout(async () => {
    try {
      const results = await searchTodos(query, scope);
      callback(results, null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown search error';
      logger.error('Debounced search error:', error);
      callback(null, errorMessage);
    }
  }, delay);
};

// Cache functions removed

// Client-side filtering for local search within loaded todos
export const filterTodosLocally = (
  todos: any[], 
  query: string
): any[] => {
  if (!query || query.trim().length === 0) {
    return todos;
  }

  // ReDoS protection for local filtering
  const validation = validateAndSanitizeSearchQuery(query.trim());
  if (!validation.isValid) {
    logger.error('Invalid search query for local filtering:', validation.error);
    return todos; // Return all todos if query is invalid rather than throwing
  }

  const searchTerm = validation.sanitizedQuery!.toLowerCase();
  
  return todos.filter(todo => {
    try {
      const title = (todo.frontmatter?.title || todo.title || '').toLowerCase();
      const content = (todo.content || '').toLowerCase();
      
      return title.includes(searchTerm) || content.includes(searchTerm);
    } catch (error) {
      logger.error('Error filtering todo:', error);
      return false; // Exclude todo if filtering fails
    }
  });
};