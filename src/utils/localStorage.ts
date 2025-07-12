import logger from './logger';

interface GitHubSettings {
  pat: string;
  owner: string;
  repo: string;
  folder: string;
  geminiApiKey?: string;
  // AI Provider settings
  aiProvider?: 'gemini' | 'openrouter';
  openRouterApiKey?: string;
  aiModel?: string;
  // Git Provider settings
  gitProvider?: 'github' | 'gitlab';
  // GitLab-specific settings
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
    
    const settings = JSON.parse(settingsString);
    
    // Ensure folder field exists, default to 'todos' for backward compatibility
    if (!settings.folder) {
      settings.folder = 'todos';
    }
    // Ensure AI provider fields exist with defaults
    if (!settings.aiProvider) {
      settings.aiProvider = 'gemini';
    }
    if (!settings.aiModel) {
      settings.aiModel = settings.aiProvider === 'gemini' ? 'gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet';
    }
    // Ensure Git provider fields exist with defaults
    if (!settings.gitProvider) {
      settings.gitProvider = 'github';
    }
    if (!settings.branch) {
      settings.branch = 'main';
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
    
    // GitHub settings
    if (settings.pat) compressed.p = settings.pat;
    if (settings.owner) compressed.o = settings.owner;
    if (settings.repo) compressed.r = settings.repo;
    
    // GitLab settings
    if (settings.instanceUrl) compressed.u = settings.instanceUrl;
    if (settings.projectId) compressed.i = settings.projectId;
    if (settings.token) compressed.t = settings.token;
    
    // Common settings
    if (settings.folder && settings.folder !== 'todos') compressed.f = settings.folder;
    if (settings.branch && settings.branch !== 'main') compressed.b = settings.branch;
    
    // AI settings (a: gemini=0, openrouter=1)
    const aiProvider = settings.aiProvider || 'gemini';
    if (aiProvider !== 'gemini') compressed.a = aiProvider === 'openrouter' ? 1 : aiProvider;
    
    if (settings.geminiApiKey) compressed.gk = settings.geminiApiKey;
    if (settings.openRouterApiKey) compressed.ok = settings.openRouterApiKey;
    if (settings.aiModel) compressed.m = settings.aiModel;
    
    const encoded = btoa(JSON.stringify(compressed));
    return `${window.location.origin}${window.location.pathname}?config=${encoded}`;
  } catch (error) {
    logger.error("Error encoding settings to URL", error);
    return '';
  }
};

export const decodeSettingsFromUrl = (configParam: string): GitHubSettings | null => {
  try {
    const decoded = atob(configParam);
    const compressed = JSON.parse(decoded);
    
    // Check if this is the old format (has full field names) or new compressed format
    const isOldFormat = 'pat' in compressed || 'gitProvider' in compressed;
    
    if (isOldFormat) {
      // Handle legacy format
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
      // Handle new compressed format
      const settings: GitHubSettings = {
        pat: '',
        owner: '',
        repo: '',
        folder: 'todos',
        geminiApiKey: '',
        aiProvider: 'gemini',
        openRouterApiKey: '',
        aiModel: '',
        gitProvider: 'github',
        instanceUrl: '',
        projectId: '',
        token: '',
        branch: 'main'
      };
      
      // Decompress values
      settings.gitProvider = compressed.g === 1 ? 'gitlab' : (compressed.g || 'github');
      settings.pat = compressed.p || '';
      settings.owner = compressed.o || '';
      settings.repo = compressed.r || '';
      settings.instanceUrl = compressed.u || '';
      settings.projectId = compressed.i || '';
      settings.token = compressed.t || '';
      settings.folder = compressed.f || 'todos';
      settings.branch = compressed.b || 'main';
      settings.aiProvider = compressed.a === 1 ? 'openrouter' : (compressed.a || 'gemini');
      settings.geminiApiKey = compressed.gk || '';
      settings.openRouterApiKey = compressed.ok || '';
      settings.aiModel = compressed.m || '';
      
      // Validate required fields
      const gitProvider = settings.gitProvider;
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

// Draft Management
export interface TodoDraft {
  todoId: string;          // SHA-based ID for the todo
  path: string;            // File path for validation
  editContent: string;     // The edited markdown content
  viewContent: string;     // The view mode content (with checkbox states)
  hasUnsavedChanges: boolean;
  timestamp: number;       // Unix timestamp of last save
}

const DRAFT_KEY = 'todoDraft';
const DRAFT_EXPIRY_HOURS = 24; // Drafts expire after 24 hours

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
    
    // Validate draft matches current todo
    if (draft.todoId !== todoId || draft.path !== path) {
      logger.log(`Draft found but doesn't match current todo. Draft: ${draft.path}, Current: ${path}`);
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
