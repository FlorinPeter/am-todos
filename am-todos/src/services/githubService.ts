const GITHUB_API_URL = 'https://api.github.com';

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

const getApiUrl = (path: string) => `${GITHUB_API_URL}${path}`;

export const createOrUpdateTodo = async (
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  commitMessage: string,
  sha?: string
) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
  console.log('GitHub API URL:', url);
  console.log('Commit message:', commitMessage);
  console.log('Content length:', content.length);
  console.log('SHA:', sha || 'none (new file)');
  
  const method = 'PUT';
  const headers = {
    Authorization: `token ${token}`,
    'Content-Type': 'application/json',
  };
  // Properly encode content to Base64 (handles Unicode characters)
  const utf8Bytes = new TextEncoder().encode(content);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  const encodedContent = btoa(binaryString);
  
  const body = JSON.stringify({
    message: commitMessage,
    content: encodedContent,
    sha,
  });

  console.log('Sending request to GitHub...');
  const response = await fetch(url, { method, headers, body });
  console.log('GitHub response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitHub API error response:', errorText);
    throw new Error(`GitHub API error: ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log('GitHub response:', result);
  return result;
};

export const ensureTodosDirectory = async (token: string, owner: string, repo: string, commitMessage?: string) => {
  // Check if todos directory exists
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/todos`);
  const headers = { Authorization: `token ${token}` };
  const response = await fetch(url, { headers });

  if (response.status === 404) {
    // Directory doesn't exist, create it with a .gitkeep file
    console.log('todos/ directory not found, creating it...');
    const createUrl = getApiUrl(`/repos/${owner}/${repo}/contents/todos/.gitkeep`);
    const createResponse = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage || 'feat: Create todos directory',
        content: btoa('# This file ensures the todos directory exists\n'),
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create todos directory:', errorText);
      throw new Error(`Failed to create todos directory: ${createResponse.statusText}`);
    }
    
    console.log('todos/ directory created successfully');
  }
};

export const getTodos = async (token: string, owner: string, repo: string) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/todos`);
  const headers = { Authorization: `token ${token}` };
  console.log('Fetching todos from:', url);
  
  try {
    const response = await fetch(url, { headers });

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
    
    // Filter out .gitkeep file and any non-markdown files
    const todoFiles = files.filter(file => 
      file.name !== '.gitkeep' && 
      file.name.endsWith('.md')
    );
    console.log('Filtered todo files:', todoFiles.length);
    return todoFiles;
  } catch (error) {
    console.error('Error fetching todos:', error);
    // If it's a network error or other fetch error, return empty array
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('Network error, returning empty array');
      return [];
    }
    throw error;
  }
};

export const getFileContent = async (token: string, owner: string, repo: string, path: string) => {
  const url = getApiUrl(`/repos/${owner}/${repo}/contents/${path}`);
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw' };
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.text();
};
