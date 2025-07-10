// GitLab API service for frontend
// This service handles GitLab API calls through the backend proxy

// Environment-aware backend URL detection
const isCloudRun = window.location.hostname.includes('run.app') || 
                   window.location.hostname.includes('run.googleapis.com');

const isDevelopment = window.location.port === '3000' || 
                     window.location.hostname === 'localhost' ||
                     window.location.hostname.startsWith('159.65.120.9');

let BACKEND_URL: string;
if (isCloudRun) {
  BACKEND_URL = ''; // Use relative URLs for Cloud Run
} else if (isDevelopment) {
  BACKEND_URL = `http://${window.location.hostname}:3001`; // Use same host with port 3001
} else {
  BACKEND_URL = ''; // Default to relative URLs
}

console.log('GitLab Service - Environment detection:', {
  'window.location.hostname': window.location.hostname,
  'window.location.port': window.location.port,
  'isCloudRun': isCloudRun,
  'isDevelopment': isDevelopment,
  'BACKEND_URL': BACKEND_URL
});

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
  console.log('Making GitLab proxy request to:', proxyUrl);
  console.log('GitLab request data:', { action, instanceUrl: settings.instanceUrl, projectId: settings.projectId, branch: settings.branch, ...params });
  
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
  
  console.log('GitLab proxy response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitLab proxy error:', errorText);
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
  console.log('GitLab createOrUpdateTodo:', path);
  console.log('Commit message:', commitMessage);
  console.log('Content length:', content.length);
  
  const response = await makeGitLabRequest('createOrUpdateFile', settings, {
    filePath: path,
    content,
    commitMessage
  });

  const result = await response.json();
  console.log('GitLab createOrUpdateTodo response:', result);
  return result;
};

export const ensureDirectory = async (settings: GitLabSettings, folder: string, commitMessage?: string) => {
  // Check if directory exists by trying to list files
  try {
    await getTodos(settings, folder);
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    console.log(`${folder}/ directory not found, creating it...`);
    const gitkeepPath = `${folder}/.gitkeep`;
    const gitkeepContent = `# This file ensures the ${folder} directory exists\n`;
    
    await createOrUpdateTodo(settings, gitkeepPath, gitkeepContent, commitMessage || `feat: Create ${folder} directory`);
    console.log(`${folder}/ directory created successfully`);
  }
};

export const getTodos = async (settings: GitLabSettings, folder: string = 'todos', includeArchived = false) => {
  const path = includeArchived ? `${folder}/archive` : folder;
  console.log('Fetching GitLab todos from:', path);
  
  try {
    const response = await makeGitLabRequest('listFiles', settings, { path });
    const files: GitLabFile[] = await response.json();
    
    console.log('Raw files from GitLab:', files.length);
    console.log('All files:', files.map(f => ({ name: f.name, type: f.type, path: f.path })));
    
    // Filter out .gitkeep file and any non-markdown files
    const todoFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    
    console.log('Filtered todo files:', todoFiles.length);
    console.log('Todo files:', todoFiles.map(f => ({ name: f.name, path: f.path })));
    return todoFiles;
  } catch (error) {
    console.error('Error fetching GitLab todos:', error);
    // Handle network errors more gracefully
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Load failed'))) {
      console.log('Network error detected, retrying once...');
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
        console.error('Retry also failed:', retryError);
        return [];
      }
    }
    return [];
  }
};

export const getFileContent = async (settings: GitLabSettings, path: string) => {
  console.log('Getting GitLab file content:', path);
  
  const response = await makeGitLabRequest('getRawFile', settings, { filePath: path });
  const data = await response.json();
  return data.content;
};

export const getFileMetadata = async (settings: GitLabSettings, path: string) => {
  console.log('Getting GitLab file metadata:', path);
  
  const response = await makeGitLabRequest('getFile', settings, { filePath: path });
  const metadata = await response.json();
  
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
    console.log(`${archivePath}/ directory not found, creating it...`);
    const gitkeepPath = `${archivePath}/.gitkeep`;
    const gitkeepContent = `# This file ensures the archive directory exists\n`;
    
    await createOrUpdateTodo(settings, gitkeepPath, gitkeepContent, `feat: Create ${archivePath} directory`);
    console.log(`${archivePath}/ directory created successfully`);
  }
};

export const moveTaskToArchive = async (
  settings: GitLabSettings,
  currentPath: string,
  content: string,
  commitMessage: string,
  folder: string = 'todos'
) => {
  console.log('Moving GitLab task to archive:', currentPath);
  
  // Ensure archive directory exists
  await ensureArchiveDirectory(settings, folder);
  
  // Determine new path in archive
  const fileName = currentPath.split('/').pop();
  const archivePath = `${folder}/archive/${fileName}`;
  
  // Create file in archive
  console.log('Creating archived file at:', archivePath);
  await createOrUpdateTodo(settings, archivePath, content, commitMessage);
  
  // Delete from original location
  console.log('Deleting original file at:', currentPath);
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
  console.log('Moving GitLab task from archive:', currentPath);
  
  // Determine new path in active folder
  const fileName = currentPath.split('/').pop();
  const activePath = `${folder}/${fileName}`;
  
  // Create file in active folder
  console.log('Creating unarchived file at:', activePath);
  await createOrUpdateTodo(settings, activePath, content, commitMessage);
  
  // Delete from archive location
  console.log('Deleting archived file at:', currentPath);
  await deleteFile(settings, currentPath, `Unarchive: Remove ${fileName} from ${folder}/archive`);
  
  return activePath;
};

export const deleteFile = async (
  settings: GitLabSettings,
  path: string,
  commitMessage: string
) => {
  console.log('Deleting GitLab file:', path);
  
  const response = await makeGitLabRequest('deleteFile', settings, {
    filePath: path,
    commitMessage
  });
  
  const result = await response.json();
  console.log('GitLab file deleted successfully:', path);
  return result;
};

export const getFileHistory = async (
  settings: GitLabSettings,
  path: string
) => {
  console.log('Getting GitLab file history:', path);
  
  const response = await makeGitLabRequest('getFileHistory', settings, { filePath: path });
  const commits = await response.json();
  
  return commits;
};

export const getFileAtCommit = async (
  settings: GitLabSettings,
  path: string,
  sha: string
) => {
  console.log('Getting GitLab file at commit:', path, sha);
  
  const response = await makeGitLabRequest('getFileAtCommit', settings, { filePath: path, sha });
  const data = await response.json();
  
  return data;
};

export const getProject = async (settings: GitLabSettings) => {
  console.log('Getting GitLab project info');
  
  const response = await makeGitLabRequest('getProject', settings);
  const project = await response.json();
  
  return project;
};

export const listProjectFolders = async (settings: GitLabSettings): Promise<string[]> => {
  try {
    const response = await makeGitLabRequest('listFiles', settings, { path: '' });
    const contents = await response.json();
    
    // Filter for directories that might contain todo files
    const folders = contents
      .filter((item: any) => item.type === 'dir' || item.path.includes('/'))
      .map((item: any) => item.name || item.path.split('/')[0])
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
    
    return [...new Set(folders)]; // Remove duplicates
  } catch (error) {
    console.error('Error listing GitLab project folders:', error);
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