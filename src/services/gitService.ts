// Git service router - chooses between GitHub and GitLab based on settings
// This service provides a unified interface for both Git providers

import { loadSettings } from '../utils/localStorage';
import * as githubService from './githubService';
import * as gitlabService from './gitlabService';
import logger from '../utils/logger';

export interface GitSettings {
  // Common fields
  provider: 'github' | 'gitlab';
  folder: string;
  
  // GitHub-specific fields
  pat?: string;
  owner?: string;
  repo?: string;
  
  // GitLab-specific fields
  instanceUrl?: string;
  projectId?: string;
  token?: string;
  branch?: string;
}

/**
 * Get the current git settings and validate them
 */
export const getGitSettings = (): GitSettings => {
  const settings = loadSettings();
  if (!settings) {
    throw new Error('No settings configured. Please configure your Git provider in the application settings.');
  }

  // Determine provider based on settings
  const provider = settings.gitProvider || 'github';
  
  return {
    provider,
    folder: settings.folder || 'todos',
    // GitHub fields
    pat: settings.pat,
    owner: settings.owner,
    repo: settings.repo,
    // GitLab fields
    instanceUrl: settings.instanceUrl,
    projectId: settings.projectId,
    token: settings.token,
    branch: 'main'
  };
};

/**
 * Create or update a todo file
 */
export const createOrUpdateTodo = async (
  path: string,
  content: string,
  commitMessage: string,
  sha?: string
) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.createOrUpdateTodo(
      settings.pat,
      settings.owner,
      settings.repo,
      path,
      content,
      commitMessage,
      sha
    );
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.createOrUpdateTodo(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path,
      content,
      commitMessage
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Ensure a directory exists
 */
export const ensureDirectory = async (folder: string, commitMessage?: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.ensureDirectory(settings.pat, settings.owner, settings.repo, folder, commitMessage);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.ensureDirectory(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      folder,
      commitMessage
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Get list of todos
 */
export const getTodos = async (folder: string = 'todos', includeArchived = false) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.getTodos(settings.pat, settings.owner, settings.repo, folder, includeArchived);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.getTodos(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      folder,
      includeArchived
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Get file content
 */
export const getFileContent = async (path: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.getFileContent(settings.pat, settings.owner, settings.repo, path);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.getFileContent(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Get file metadata
 */
export const getFileMetadata = async (path: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.getFileMetadata(settings.pat, settings.owner, settings.repo, path);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.getFileMetadata(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Move task to archive
 */
export const moveTaskToArchive = async (
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.moveTaskToArchive(
      settings.pat,
      settings.owner,
      settings.repo,
      currentPath,
      content,
      commitMessage,
      folder
    );
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.moveTaskToArchive(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      currentPath,
      content,
      commitMessage,
      folder
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Move task from archive
 */
export const moveTaskFromArchive = async (
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.moveTaskFromArchive(
      settings.pat,
      settings.owner,
      settings.repo,
      currentPath,
      content,
      commitMessage,
      folder
    );
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.moveTaskFromArchive(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      currentPath,
      content,
      commitMessage,
      folder
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Delete a file
 */
export const deleteFile = async (path: string, commitMessage: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    // GitHub requires SHA for deletion, so we need to get it first
    const metadata = await githubService.getFileMetadata(settings.pat, settings.owner, settings.repo, path);
    return await githubService.deleteFile(settings.pat, settings.owner, settings.repo, path, metadata.sha, commitMessage);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.deleteFile(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path,
      commitMessage
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Get file history
 */
export const getFileHistory = async (path: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.getFileHistory(settings.pat, settings.owner, settings.repo, path);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.getFileHistory(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Get file at specific commit
 */
export const getFileAtCommit = async (path: string, sha: string) => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.getFileAtCommit(settings.pat, settings.owner, settings.repo, path, sha);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.getFileAtCommit(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      path,
      sha
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * List project folders
 */
export const listProjectFolders = async (): Promise<string[]> => {
  const settings = getGitSettings();
  logger.log('gitService: listProjectFolders called with provider:', settings.provider);
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    const folders = await githubService.listProjectFolders(settings.pat, settings.owner, settings.repo);
    logger.log('gitService: GitHub folders:', folders);
    return folders;
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    try {
      const folders = await gitlabService.listProjectFolders({
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      });
      logger.log('gitService: GitLab folders:', folders);
      return folders;
    } catch (error) {
      logger.error('gitService: GitLab listProjectFolders error:', error);
      throw error;
    }
  } else {
    throw new Error('Unsupported Git provider');
  }
};

/**
 * Create a new project folder
 */
export const createProjectFolder = async (folderName: string): Promise<void> => {
  const settings = getGitSettings();
  
  if (settings.provider === 'github') {
    if (!settings.pat || !settings.owner || !settings.repo) {
      throw new Error('GitHub settings incomplete. Please configure PAT, owner, and repo.');
    }
    return await githubService.createProjectFolder(settings.pat, settings.owner, settings.repo, folderName);
  } else if (settings.provider === 'gitlab') {
    if (!settings.instanceUrl || !settings.projectId || !settings.token) {
      throw new Error('GitLab settings incomplete. Please configure instance URL, project ID, and token.');
    }
    return await gitlabService.createProjectFolder(
      {
        instanceUrl: settings.instanceUrl,
        projectId: settings.projectId,
        token: settings.token,
        branch: 'main'
      },
      folderName
    );
  } else {
    throw new Error('Unsupported Git provider');
  }
};