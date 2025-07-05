const BACKEND_URL = 'http://159.65.120.9:3001'; // Use external IP for backend

interface GitHubUser {
  login: string;
  name: string;
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  content: string;
  type?: string;
}

const makeGitHubRequest = async (path: string, method = 'GET', headers = {}, body?: any, owner?: string, repo?: string) => {
  const proxyUrl = `${BACKEND_URL}/api/github`;
  console.log('Making proxy request to:', proxyUrl);
  console.log('Proxy request data:', { path, method, headers: Object.keys(headers), owner, repo });
  
  const response = await fetch(proxyUrl, {
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
    })
  });
  
  console.log('Proxy response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Proxy error:', errorText);
    throw new Error(`GitHub API proxy error: ${response.statusText} - ${errorText}`);
  }
  
  return response;
};

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
  console.log('GitHub API path:', apiPath);
  console.log('Commit message:', commitMessage);
  console.log('Content length:', content.length);
  console.log('SHA:', sha || 'none (new file)');
  
  // Check if file already exists if no SHA is provided
  if (!sha) {
    try {
      console.log('Checking if file already exists...');
      const existingFile = await getFileMetadata(token, owner, repo, path);
      console.log('File exists, using existing SHA:', existingFile.sha);
      sha = existingFile.sha;
    } catch (error) {
      console.log('File does not exist, creating new file');
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

  console.log('Sending request to GitHub via proxy...');
  const response = await makeGitHubRequest(apiPath, 'PUT', headers, requestBody, owner, repo);
  console.log('GitHub response status:', response.status);

  const result = await response.json();
  console.log('GitHub response:', result);
  return result;
};

export const ensureTodosDirectory = async (token: string, owner: string, repo: string, commitMessage?: string) => {
  // Check if todos directory exists
  const checkPath = `/repos/${owner}/${repo}/contents/todos`;
  const headers = { Authorization: `token ${token}` };
  
  try {
    await makeGitHubRequest(checkPath, 'GET', headers, undefined, owner, repo);
  } catch (error) {
    // Directory doesn't exist, create it with a .gitkeep file
    console.log('todos/ directory not found, creating it...');
    const createPath = `/repos/${owner}/${repo}/contents/todos/.gitkeep`;
    const createBody = {
      message: commitMessage || 'feat: Create todos directory',
      content: btoa('# This file ensures the todos directory exists\\n'),
    };

    const createResponse = await makeGitHubRequest(createPath, 'PUT', {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    }, createBody, owner, repo);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create todos directory:', errorText);
      throw new Error(`Failed to create todos directory: ${createResponse.statusText}`);
    }
    
    console.log('todos/ directory created successfully');
  }
};

export const getTodos = async (token: string, owner: string, repo: string) => {
  const apiPath = `/repos/${owner}/${repo}/contents/todos`;
  const headers = { 
    Authorization: `token ${token}`,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  console.log('Fetching todos from:', apiPath);
  
  try {
    console.log('Making fetch request with headers:', JSON.stringify(headers, null, 2));
    console.log('Fetch path:', apiPath);
    
    const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);

    console.log('Response received:', response.status, response.statusText);
    console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    if (!response.ok) {
      if (response.status === 404) {
        console.log('todos/ directory not found, returning empty array');
        return []; // Directory doesn't exist, return empty array
      }
      const errorText = await response.text();
      console.error('GitHub API error response:', errorText);
      throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
    }

    const files: GitHubFile[] = await response.json();
    console.log('Raw files from GitHub:', files.length);
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
    console.error('Error fetching todos:', error);
    // Handle network errors more gracefully
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Load failed'))) {
      console.log('Network error detected, retrying once...');
      try {
        // Wait a bit and retry once
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryResponse = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);
        if (!retryResponse.ok) {
          if (retryResponse.status === 404) {
            console.log('todos/ directory not found after retry, returning empty array');
            return [];
          }
          const errorText = await retryResponse.text();
          throw new Error(`GitHub API error: ${retryResponse.statusText} - ${errorText}`);
        }
        const files: GitHubFile[] = await retryResponse.json();
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
    throw error;
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