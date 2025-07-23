import logger from './logger';
import { ChatMessage } from '../types';

// URL validation helper functions
const validateUrlComponent = (value: string, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  // Remove any potentially dangerous characters
  const sanitized = value
    .replace(/[<>"\\']/g, '') // Remove HTML/script injection chars
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/vbscript:/gi, '') // Remove vbscript: URLs
    .trim();
  
  if (sanitized.length > 500) {
    throw new Error(`${fieldName} too long (max 500 characters)`);
  }
  
  return sanitized;
};

// Validate URL structure components
const validateUrlStructure = (url: string): void => {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('URL must use http or https protocol');
    }
  } catch (e) {
    throw new Error('Invalid URL structure');
  }
};

// Individual provider configurations
interface GitHubConfig {
  pat: string;
  owner: string;
  repo: string;
  branch?: string;
}

interface GitLabConfig {
  instanceUrl: string;
  projectId: string;
  token: string;
  branch?: string;
}

// Main settings interface supporting dual configurations
interface GitHubSettings {
  // Active provider
  gitProvider: 'github' | 'gitlab';
  
  // Common settings
  folder: string;
  
  // AI Provider settings
  aiProvider?: 'gemini' | 'openrouter';
  geminiApiKey?: string;
  openRouterApiKey?: string;
  aiModel?: string;
  
  // Provider-specific configurations (preserved when switching)
  github?: GitHubConfig;
  gitlab?: GitLabConfig;
  
  // Legacy fields for backward compatibility (will be migrated)
  pat?: string;
  owner?: string;
  repo?: string;
  instanceUrl?: string;
  projectId?: string;
  token?: string;
  branch?: string;
}

const SETTINGS_KEY = 'githubSettings';

export const saveSettings = (settings: GitHubSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.error("Error saving settings to localStorage", error);
  }
};

export const loadSettings = (): GitHubSettings | null => {
  try {
    const settingsString = localStorage.getItem(SETTINGS_KEY);
    if (!settingsString) return null;
    
    const rawSettings = JSON.parse(settingsString);
    
    // Migration: Check if this is legacy format (has direct provider fields)
    const isLegacyFormat = rawSettings.pat || rawSettings.instanceUrl || (!rawSettings.github && !rawSettings.gitlab);
    
    let settings: GitHubSettings;
    
    if (isLegacyFormat) {
      // Migrate from legacy format to new dual-configuration format
      logger.log("Migrating settings from legacy format to dual-configuration format");
      
      settings = {
        gitProvider: rawSettings.gitProvider || 'github',
        folder: rawSettings.folder || 'todos',
        aiProvider: rawSettings.aiProvider || 'gemini',
        geminiApiKey: rawSettings.geminiApiKey || '',
        openRouterApiKey: rawSettings.openRouterApiKey || '',
        aiModel: rawSettings.aiModel || (rawSettings.aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'anthropic/claude-3.5-sonnet')
      };
      
      // Migrate GitHub configuration if present
      if (rawSettings.pat || rawSettings.owner || rawSettings.repo) {
        settings.github = {
          pat: rawSettings.pat || '',
          owner: rawSettings.owner || '',
          repo: rawSettings.repo || '',
          branch: rawSettings.branch || 'main'
        };
      }
      
      // Migrate GitLab configuration if present
      if (rawSettings.instanceUrl || rawSettings.projectId || rawSettings.token) {
        settings.gitlab = {
          instanceUrl: rawSettings.instanceUrl || 'https://gitlab.com',
          projectId: rawSettings.projectId || '',
          token: rawSettings.token || '',
          branch: rawSettings.branch || 'main'
        };
      }
      
      // Save the migrated settings immediately
      saveSettings(settings);
      logger.log("Settings migration completed and saved");
    } else {
      // Already in new format
      settings = rawSettings;
    }
    
    // Apply defaults for missing fields
    if (!settings.folder) {
      settings.folder = 'todos';
    }
    if (!settings.aiProvider) {
      settings.aiProvider = 'gemini';
    }
    if (!settings.aiModel) {
      settings.aiModel = settings.aiProvider === 'gemini' ? 'gemini-1.5-flash' : 'anthropic/claude-3.5-sonnet';
    }
    if (!settings.gitProvider) {
      settings.gitProvider = 'github';
    }
    
    // Ensure branch defaults for each provider config
    if (settings.github && !settings.github.branch) {
      settings.github.branch = 'main';
    }
    if (settings.gitlab && !settings.gitlab.branch) {
      settings.gitlab.branch = 'main';
    }
    
    return settings;
  } catch (error) {
    logger.error("Error loading settings from localStorage", error);
    return null;
  }
};

export const encodeSettingsToUrl = (settings: GitHubSettings): string => {
  try {
    // Create compressed object with short keys and only non-default values
    const compressed: any = {};
    
    // Git provider (g: github=0, gitlab=1)
    const gitProvider = settings.gitProvider || 'github';
    if (gitProvider !== 'github') compressed.g = gitProvider === 'gitlab' ? 1 : gitProvider;
    
    // GitHub settings (use nested structure for dual-config)
    if (settings.github) {
      const gh: any = {};
      if (settings.github.pat) gh.p = validateUrlComponent(settings.github.pat, 'GitHub PAT');
      if (settings.github.owner) gh.o = validateUrlComponent(settings.github.owner, 'GitHub owner');
      if (settings.github.repo) gh.r = validateUrlComponent(settings.github.repo, 'GitHub repo');
      if (settings.github.branch && settings.github.branch !== 'main') {
        gh.b = validateUrlComponent(settings.github.branch, 'GitHub branch');
      }
      if (Object.keys(gh).length > 0) compressed.gh = gh;
    }
    
    // GitLab settings (use nested structure for dual-config)
    if (settings.gitlab) {
      const gl: any = {};
      if (settings.gitlab.instanceUrl && settings.gitlab.instanceUrl !== 'https://gitlab.com') {
        const validatedUrl = validateUrlComponent(settings.gitlab.instanceUrl, 'GitLab URL');
        validateUrlStructure(validatedUrl);
        gl.u = validatedUrl;
      }
      if (settings.gitlab.projectId) gl.i = validateUrlComponent(settings.gitlab.projectId, 'GitLab project ID');
      if (settings.gitlab.token) gl.t = validateUrlComponent(settings.gitlab.token, 'GitLab token');
      if (settings.gitlab.branch && settings.gitlab.branch !== 'main') {
        gl.b = validateUrlComponent(settings.gitlab.branch, 'GitLab branch');
      }
      if (Object.keys(gl).length > 0) compressed.gl = gl;
    }
    
    // Legacy field support for backward compatibility with old URLs
    if (settings.pat) compressed.p = validateUrlComponent(settings.pat, 'PAT');
    if (settings.owner) compressed.o = validateUrlComponent(settings.owner, 'owner');
    if (settings.repo) compressed.r = validateUrlComponent(settings.repo, 'repo');
    if (settings.instanceUrl) {
      const validatedUrl = validateUrlComponent(settings.instanceUrl, 'instance URL');
      validateUrlStructure(validatedUrl);
      compressed.u = validatedUrl;
    }
    if (settings.projectId) compressed.i = validateUrlComponent(settings.projectId, 'project ID');
    if (settings.token) compressed.t = validateUrlComponent(settings.token, 'token');
    
    // Common settings
    if (settings.folder && settings.folder !== 'todos') {
      compressed.f = validateUrlComponent(settings.folder, 'folder');
    }
    
    // AI settings (a: gemini=0, openrouter=1)
    const aiProvider = settings.aiProvider || 'gemini';
    if (aiProvider !== 'gemini') {
      const validatedProvider = validateUrlComponent(aiProvider, 'AI provider');
      compressed.a = validatedProvider === 'openrouter' ? 1 : validatedProvider;
    }
    
    if (settings.geminiApiKey) compressed.gk = validateUrlComponent(settings.geminiApiKey, 'Gemini API key');
    if (settings.openRouterApiKey) compressed.ok = validateUrlComponent(settings.openRouterApiKey, 'OpenRouter API key');
    if (settings.aiModel) compressed.m = validateUrlComponent(settings.aiModel, 'AI model');
    
    // Validate final JSON size before encoding
    const jsonString = JSON.stringify(compressed);
    if (jsonString.length > 10000) {
      throw new Error('Configuration too large to encode in URL');
    }
    
    const encoded = btoa(jsonString);
    return `${window.location.origin}${window.location.pathname}?config=${encoded}`;
  } catch (error) {
    logger.error("Error encoding settings to URL", error);
    return '';
  }
};

export const decodeSettingsFromUrl = (configParam: string): GitHubSettings | null => {
  try {
    // Validate base64 input size to prevent DoS attacks
    if (configParam.length > 20000) {
      throw new Error('Configuration parameter too large');
    }
    
    // Validate base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(configParam)) {
      throw new Error('Invalid base64 configuration format');
    }
    
    const decoded = atob(configParam);
    
    // Check decoded size limit
    if (decoded.length > 15000) {
      throw new Error('Decoded configuration too large');
    }
    
    const compressed = JSON.parse(decoded);
    
    // Check format type
    const isOldFormat = 'pat' in compressed || 'gitProvider' in compressed;
    const isDualConfigFormat = 'gh' in compressed || 'gl' in compressed;
    
    if (isOldFormat && !isDualConfigFormat) {
      // Handle legacy single-provider format
      const settings = compressed;
      const gitProvider = settings.gitProvider || 'github';
      
      if (gitProvider === 'github') {
        if (!settings.pat || !settings.owner || !settings.repo) {
          logger.error("Invalid GitHub settings configuration - missing required fields");
          return null;
        }
      } else if (gitProvider === 'gitlab') {
        if (!settings.instanceUrl || !settings.projectId || !settings.token) {
          logger.error("Invalid GitLab settings configuration - missing required fields");
          return null;
        }
      }
      
      settings.folder = settings.folder || 'todos';
      settings.branch = settings.branch || 'main';
      return settings;
    } else {
      // Handle new dual-configuration format
      const settings: GitHubSettings = {
        gitProvider: compressed.g === 1 ? 'gitlab' : (compressed.g || 'github'),
        folder: compressed.f !== undefined ? compressed.f : 'todos',
        aiProvider: compressed.a === 1 ? 'openrouter' : (compressed.a || 'gemini'),
        geminiApiKey: compressed.gk || '',
        openRouterApiKey: compressed.ok || '',
        aiModel: compressed.m || ''
      };
      
      // Decode GitHub configuration
      if (compressed.gh) {
        settings.github = {
          pat: compressed.gh.p || '',
          owner: compressed.gh.o || '',
          repo: compressed.gh.r || '',
          branch: compressed.gh.b || 'main'
        };
      }
      
      // Decode GitLab configuration
      if (compressed.gl) {
        settings.gitlab = {
          instanceUrl: compressed.gl.u || 'https://gitlab.com',
          projectId: compressed.gl.i || '',
          token: compressed.gl.t || '',
          branch: compressed.gl.b || 'main'
        };
      }
      
      // Support legacy direct fields for backward compatibility
      if (compressed.p || compressed.o || compressed.r) {
        if (!settings.github) settings.github = { pat: '', owner: '', repo: '', branch: 'main' };
        settings.github.pat = compressed.p || settings.github.pat;
        settings.github.owner = compressed.o || settings.github.owner;
        settings.github.repo = compressed.r || settings.github.repo;
      }
      
      if (compressed.u || compressed.i || compressed.t) {
        if (!settings.gitlab) settings.gitlab = { instanceUrl: 'https://gitlab.com', projectId: '', token: '', branch: 'main' };
        settings.gitlab.instanceUrl = compressed.u || settings.gitlab.instanceUrl;
        settings.gitlab.projectId = compressed.i || settings.gitlab.projectId;
        settings.gitlab.token = compressed.t || settings.gitlab.token;
      }
      
      // Validate that at least one provider configuration is complete
      const hasValidGitHub = settings.github && settings.github.pat && settings.github.owner && settings.github.repo;
      const hasValidGitLab = settings.gitlab && settings.gitlab.instanceUrl && settings.gitlab.projectId && settings.gitlab.token;
      
      if (!hasValidGitHub && !hasValidGitLab) {
        logger.error("Invalid configuration - no complete provider settings found");
        return null;
      }
      
      return settings;
    }
  } catch (error) {
    logger.error("Error decoding settings from URL", error);
    return null;
  }
};

export const getUrlConfig = (): GitHubSettings | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const configParam = urlParams.get('config');
  
  if (!configParam) {
    return null;
  }
  
  return decodeSettingsFromUrl(configParam);
};

// Checkpoint Management
export interface Checkpoint {
  id: string;
  content: string;
  timestamp: string;
  chatMessage: string; // The user message that led to this checkpoint
  description: string; // AI-generated description or user message
}

const CHECKPOINTS_KEY_PREFIX = 'checkpoints_';

export const saveCheckpoint = (taskId: string, checkpoint: Checkpoint): void => {
  try {
    const key = `${CHECKPOINTS_KEY_PREFIX}${taskId}`;
    const existingCheckpoints = getCheckpoints(taskId);
    const updatedCheckpoints = [...existingCheckpoints, checkpoint];
    
    // Keep only last 20 checkpoints to prevent localStorage bloat
    const trimmedCheckpoints = updatedCheckpoints.slice(-20);
    
    localStorage.setItem(key, JSON.stringify(trimmedCheckpoints));
  } catch (error) {
    logger.error("Error saving checkpoint to localStorage", error);
  }
};

export const getCheckpoints = (taskId: string): Checkpoint[] => {
  try {
    const key = `${CHECKPOINTS_KEY_PREFIX}${taskId}`;
    const checkpointsString = localStorage.getItem(key);
    if (!checkpointsString) return [];
    
    return JSON.parse(checkpointsString);
  } catch (error) {
    logger.error("Error loading checkpoints from localStorage", error);
    return [];
  }
};

export const clearCheckpoints = (taskId: string): void => {
  try {
    const key = `${CHECKPOINTS_KEY_PREFIX}${taskId}`;
    localStorage.removeItem(key);
  } catch (error) {
    logger.error("Error clearing checkpoints from localStorage", error);
  }
};

export const generateCheckpointId = (): string => {
  return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Selected Todo Persistence
const SELECTED_TODO_KEY = 'selectedTodoId';

export const saveSelectedTodoId = (todoId: string | null): void => {
  try {
    if (todoId) {
      localStorage.setItem(SELECTED_TODO_KEY, todoId);
    } else {
      localStorage.removeItem(SELECTED_TODO_KEY);
    }
  } catch (error) {
    logger.error("Error saving selected todo ID to localStorage", error);
  }
};

export const loadSelectedTodoId = (): string | null => {
  try {
    return localStorage.getItem(SELECTED_TODO_KEY);
  } catch (error) {
    logger.error("Error loading selected todo ID from localStorage", error);
    return null;
  }
};

export const clearSelectedTodoId = (): void => {
  try {
    localStorage.removeItem(SELECTED_TODO_KEY);
  } catch (error) {
    logger.error("Error clearing selected todo ID from localStorage", error);
  }
};

// View Mode Persistence
const VIEW_MODE_KEY = 'viewMode';
export type ViewMode = 'active' | 'archived';

export const saveViewMode = (viewMode: ViewMode): void => {
  try {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
    logger.log(`View mode saved: ${viewMode}`);
  } catch (error) {
    logger.error("Error saving view mode to localStorage", error);
  }
};

export const loadViewMode = (): ViewMode => {
  try {
    const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
    if (savedViewMode === 'active' || savedViewMode === 'archived') {
      logger.log(`View mode loaded: ${savedViewMode}`);
      return savedViewMode;
    }
    // Default to 'active' if no valid view mode is stored
    logger.log('No valid view mode found, defaulting to: active');
    return 'active';
  } catch (error) {
    logger.error("Error loading view mode from localStorage", error);
    return 'active';
  }
};

export const clearViewMode = (): void => {
  try {
    localStorage.removeItem(VIEW_MODE_KEY);
    logger.log('View mode cleared from localStorage');
  } catch (error) {
    logger.error("Error clearing view mode from localStorage", error);
  }
};

// Draft Management
export interface TodoDraft {
  todoId: string;          // SHA-based ID for the todo (may change with content updates)
  path: string;            // File path for validation
  stableDraftKey: string;  // Path-based stable key for draft persistence (doesn't change with SHA)
  editContent: string;     // The edited content (now includes frontmatter + markdown)
  viewContent: string;     // The view mode content (now includes frontmatter + markdown with checkbox states)
  hasUnsavedChanges: boolean;
  timestamp: number;       // Unix timestamp of last save
}

const DRAFT_KEY = 'todoDraft';
const DRAFT_EXPIRY_HOURS = 24; // Drafts expire after 24 hours

// Generate a stable draft key from file path that doesn't change with SHA updates
const generateStableDraftKey = (path: string): string => {
  // Use the path as a stable identifier, normalized to handle any variations
  return path.trim().toLowerCase();
};

export const saveDraft = (draft: TodoDraft): void => {
  try {
    // Clear any existing drafts first (only one draft at a time)
    localStorage.removeItem(DRAFT_KEY);
    
    // Save the new draft with current timestamp
    const draftWithTimestamp = {
      ...draft,
      timestamp: Date.now()
    };
    
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draftWithTimestamp));
    logger.log(`Draft saved for todo: ${draft.path}`);
  } catch (error) {
    logger.error("Error saving draft to localStorage", error);
  }
};

export const getDraft = (todoId: string, path: string): TodoDraft | null => {
  try {
    const draftString = localStorage.getItem(DRAFT_KEY);
    if (!draftString) return null;
    
    const draft = JSON.parse(draftString) as TodoDraft;
    
    // Check todoId first - if it doesn't match, return null
    if (draft.todoId !== todoId) {
      logger.log(`Draft found but doesn't match current todoId. Draft: "${draft.todoId}", Current: "${todoId}"`);
      return null;
    }
    
    // Use stable draft key for matching instead of volatile SHA-based todoId
    const stableDraftKey = generateStableDraftKey(path);
    const draftStableKey = draft.stableDraftKey || generateStableDraftKey(draft.path || '');
    
    if (draftStableKey !== stableDraftKey) {
      logger.log(`Draft found but doesn't match current todo path. Draft: "${draft.path}" -> "${draftStableKey}", Current: "${path}" -> "${stableDraftKey}"`);
      return null;
    }
    
    // Check if draft has expired
    const expiryTime = DRAFT_EXPIRY_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
    const draftAge = Date.now() - draft.timestamp;
    if (draftAge > expiryTime) {
      logger.log(`Draft expired (${Math.round(draftAge / 1000 / 60 / 60)} hours old)`);
      clearDraft();
      return null;
    }
    
    logger.log(`Draft restored for todo: ${path}`);
    return draft;
  } catch (error) {
    logger.error("Error loading draft from localStorage", error);
    return null;
  }
};

export const clearDraft = (): void => {
  try {
    const draftString = localStorage.getItem(DRAFT_KEY);
    if (draftString) {
      const draft = JSON.parse(draftString) as TodoDraft;
      logger.log(`Clearing draft for todo: ${draft.path}`);
    }
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    logger.error("Error clearing draft from localStorage", error);
  }
};

export const clearOtherDrafts = (currentTodoId: string): void => {
  try {
    const draftString = localStorage.getItem(DRAFT_KEY);
    if (!draftString) return;
    
    const draft = JSON.parse(draftString) as TodoDraft;
    
    // Clear draft if it's for a different todo
    if (draft.todoId !== currentTodoId) {
      logger.log(`Clearing draft for different todo: ${draft.path}`);
      clearDraft();
    }
  } catch (error) {
    logger.error("Error clearing other drafts from localStorage", error);
  }
};

// AI Chat Persistence

export interface AIChatSession {
  todoId: string;
  path: string;
  chatHistory: ChatMessage[];
  checkpoints: Checkpoint[];
  isExpanded: boolean;
  timestamp: number; // Unix timestamp of last activity
}

const CHAT_SESSION_KEY = 'aiChatSession';
const CHAT_SESSION_EXPIRY_HOURS = 24; // Chat sessions expire after 24 hours

export const saveChatSession = (session: AIChatSession): void => {
  try {
    // Clear any existing chat session first (only one session at a time)
    localStorage.removeItem(CHAT_SESSION_KEY);
    
    // Save the new session with current timestamp
    const sessionWithTimestamp = {
      ...session,
      timestamp: Date.now()
    };
    
    localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(sessionWithTimestamp));
    logger.log(`Chat session saved for todo: ${session.path}`);
  } catch (error) {
    logger.error("Error saving chat session to localStorage", error);
  }
};

export const getChatSession = (todoId: string, path: string): AIChatSession | null => {
  try {
    const sessionString = localStorage.getItem(CHAT_SESSION_KEY);
    if (!sessionString) return null;
    
    const session = JSON.parse(sessionString) as AIChatSession;
    
    // Validate session matches current todo
    if (session.todoId !== todoId || session.path !== path) {
      logger.log(`Chat session found but doesn't match current todo. Session: ${session.path}, Current: ${path}`);
      return null;
    }
    
    // Check if session has expired
    if (typeof session.timestamp !== 'number') {
      logger.log('Chat session missing timestamp - clearing');
      clearChatSession();
      return null;
    }
    
    const expiryTime = CHAT_SESSION_EXPIRY_HOURS * 60 * 60 * 1000; // Convert hours to milliseconds
    const sessionAge = Date.now() - session.timestamp;
    if (sessionAge > expiryTime) {
      logger.log(`Chat session expired (${Math.round(sessionAge / 1000 / 60 / 60)} hours old)`);
      clearChatSession();
      return null;
    }
    
    logger.log(`Chat session restored for todo: ${path}`);
    return session;
  } catch (error) {
    logger.error("Error loading chat session from localStorage", error);
    return null;
  }
};

export const clearChatSession = (): void => {
  try {
    localStorage.removeItem(CHAT_SESSION_KEY);
    logger.log("Chat session cleared from localStorage");
  } catch (error) {
    logger.error("Error clearing chat session from localStorage", error);
  }
};

export const clearOtherChatSessions = (currentTodoId: string): void => {
  // Implementation for clearing chat sessions for other todos
  // Since we only store one session at a time, we check if the current session
  // belongs to a different todo and clear it if so
  try {
    const sessionString = localStorage.getItem(CHAT_SESSION_KEY);
    if (sessionString) {
      const session = JSON.parse(sessionString) as AIChatSession;
      if (session.todoId !== currentTodoId) {
        clearChatSession();
        logger.log(`Cleared chat session for different todo: ${session.path}`);
      }
    }
  } catch (error) {
    logger.error("Error clearing other chat sessions", error);
  }
};
