// GitLab API service for frontend
// This service handles GitLab API calls through the backend proxy

import logger from '../utils/logger';

// Always use relative URLs - let infrastructure handle routing
// Development: Vite proxy routes /api/* to localhost:3001/api/*
// Production: Same origin serves both frontend and backend
const BACKEND_URL = '';

logger.log('GitLab Service using relative URLs for all environments');

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
    throw new Error(`GitLab API proxy error: ${response.statusText} - ${errorText}`);
  }
  
  return response;
};

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

export const getTodos = async (settings: GitLabSettings, folder: string = 'todos', includeArchived = false) => {
  const path = includeArchived ? `${folder}/archive` : folder;
  logger.log('Fetching GitLab todos from:', path);
  
  try {
    const response = await makeGitLabRequest('listFiles', settings, { path });
    const files: GitLabFile[] = await response.json();
    
    logger.log('Raw files from GitLab:', files.length);
    logger.log('All files:', files.map(f => ({ name: f.name, type: f.type, path: f.path })));
    
    // Filter out .gitkeep file and any non-markdown files
    const todoFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    
    logger.log('Filtered todo files:', todoFiles.length);
    logger.log('Todo files:', todoFiles.map(f => ({ name: f.name, path: f.path })));
    return todoFiles;
  } catch (error) {
    logger.error('Error fetching GitLab todos:', error);
    // Handle network errors more gracefully
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Load failed'))) {
      logger.log('Network error detected, retrying once...');
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryResponse = await makeGitLabRequest('listFiles', settings, { path });
        const files: GitLabFile[] = await retryResponse.json();
        const todoFiles = files.filter(file => 
          file.name !== '.gitkeep' && 
          file.name.endsWith('.md')
        );
        return todoFiles;
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
    throw new Error(`Failed to parse GitLab API response: ${parseError.message}`);
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
    const directories = treeItems
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
  if (!folderName || !folderName.match(/^[a-zA-Z][a-zA-Z0-9_-]*$/)) {
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