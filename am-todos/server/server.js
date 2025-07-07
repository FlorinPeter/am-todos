const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3001;

// Debug logging for Cloud Run
console.log('🚀 Starting server...');
console.log('📝 Environment variables:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('   FRONTEND_BUILD_PATH:', process.env.FRONTEND_BUILD_PATH);
console.log('🔌 Server will listen on port:', port);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: port,
    nodeEnv: process.env.NODE_ENV 
  });
});

// Version info endpoint
app.get('/api/version', (req, res) => {
  res.status(200).json({
    version: process.env.VERSION || '0.1.0',
    gitSha: process.env.GIT_SHA || 'development',
    gitTag: process.env.GIT_TAG || null,
    buildDate: process.env.BUILD_DATE || null,
    nodeEnv: process.env.NODE_ENV
  });
});

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
  console.log('📁 Static files path:', buildPath);
  app.use(express.static(buildPath));
}

// GitHub API proxy endpoint with security validation
app.post('/api/github', async (req, res) => {
  const { path, method = 'GET', headers = {}, body, owner, repo } = req.body || {};
  
  if (!path || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, owner, repo' });
  }

  // Security: Validate that the request is for the expected repository pattern
  const expectedRepoPattern = new RegExp(`^/repos/${owner}/${repo}/`);
  if (!expectedRepoPattern.test(path)) {
    return res.status(403).json({ error: 'Invalid repository path' });
  }

  // Security: Only allow specific GitHub API endpoints for contents and commits
  const allowedPatterns = [
    // Allow any contents endpoint (for dynamic folder support)
    /^\/repos\/[^\/]+\/[^\/]+\/contents\/.*/,
    // Allow commits endpoint
    /^\/repos\/[^\/]+\/[^\/]+\/commits/,
    // Allow root contents listing (for folder discovery)
    /^\/repos\/[^\/]+\/[^\/]+\/contents\/?$/
  ];
  
  const isAllowedEndpoint = allowedPatterns.some(pattern => pattern.test(path));
  
  if (!isAllowedEndpoint) {
    console.log('Blocked endpoint:', path);
    return res.status(403).json({ error: 'Endpoint not allowed' });
  }

  try {
    const githubUrl = `https://api.github.com${path}`;
    console.log('Proxying GitHub API request:', method, githubUrl);
    
    const fetchOptions = {
      method,
      headers: {
        'User-Agent': 'Agentic-Markdown-Todos',
        // Security: Only forward specific headers, not all
        ...(headers.Authorization && { Authorization: headers.Authorization }),
        ...(headers['Content-Type'] && { 'Content-Type': headers['Content-Type'] }),
        ...(headers.Accept && { Accept: headers.Accept })
      }
    };

    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(githubUrl, fetchOptions);
    const responseData = await response.text();
    
    // Forward the status and headers (filtered)
    res.status(response.status);
    const allowedResponseHeaders = ['content-type', 'etag', 'last-modified'];
    response.headers.forEach((value, key) => {
      if (allowedResponseHeaders.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    
    res.send(responseData);
  } catch (error) {
    console.error('GitHub API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy GitHub API request' });
  }
});

app.post('/api/ai', async (req, res) => {
  const { action, payload, provider, apiKey, model } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action in request body' });
  }

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing AI API key. Please configure your API key in the application settings.' });
  }

  if (!provider) {
    return res.status(400).json({ error: 'Missing AI provider. Please select a provider in the application settings.' });
  }

  try {
    let prompt = '';
    let systemInstruction = '';
    let response;

    switch (action) {
      case 'generateInitialPlan':
        systemInstruction = `You are an expert project manager. Your task is to create a high-level, editable markdown template for a goal. Keep it simple and user-friendly - the user should be able to easily edit and expand on it.

Rules:
1. Create a brief description of the goal
2. Add 3-5 high-level checkboxes using - [ ] format
3. Keep each checkbox item concise and general (not overly detailed)
4. Use simple GitHub Flavored Markdown
5. Make it easy for the user to edit and add their own details
6. Focus on major phases or key areas rather than micro-tasks`;
        prompt = `Create a simple, high-level markdown template for this goal: ${payload.goal}`;
        break;
      case 'generateCommitMessage':
        systemInstruction = `You are an expert at writing conventional commit messages. Given a description of a change, generate a concise and appropriate conventional commit message (e.g., feat: Add new feature, fix: Fix bug, docs: Update documentation).`;
        prompt = `Generate a conventional commit message for the following change: ${payload.changeDescription}`;
        break;
      case 'processChatMessage':
        systemInstruction = `You are an AI assistant helping users modify their task lists. Given a user's natural language request, the current markdown content, and chat history, return the updated markdown content with the requested changes applied.

Rules:
1. Return ONLY the updated markdown content, no explanations or additional text
2. Preserve the existing structure and formatting
3. Make precise changes based on the user's request
4. Handle requests like "add a step for...", "rephrase the second item...", "remove the third task...", etc.
5. Keep checkbox format intact: - [ ] for unchecked, - [x] for checked
6. Maintain proper markdown syntax`;
        prompt = `Current markdown content:
${payload.currentContent}

Chat history:
${payload.chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User request: ${payload.message}

Please return the updated markdown content:`;
        break;
      // Add more cases for other AI actions as needed
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    if (provider === 'gemini') {
      // Gemini API implementation
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: model || "gemini-2.5-flash" });
      const result = await geminiModel.generateContent({ 
        contents: [{ role: "user", parts: [{ text: prompt }] }], 
        systemInstruction: { parts: [{ text: systemInstruction }] } 
      });
      response = await result.response;
      const text = response.text();
      res.json({ text });
    } else if (provider === 'openrouter') {
      // OpenRouter API implementation
      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://agentic-markdown-todos.local',
          'X-Title': 'Agentic Markdown Todos'
        },
        body: JSON.stringify({
          model: model || 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text();
        console.error('OpenRouter API error:', errorText);
        if (openRouterResponse.status === 401) {
          throw new Error('OpenRouter API key is invalid or not authorized. Please check your API key in settings.');
        }
        throw new Error(`OpenRouter API error: ${openRouterResponse.statusText} - ${errorText}`);
      }

      const openRouterData = await openRouterResponse.json();
      const text = openRouterData.choices[0].message.content;
      res.json({ text });
    } else {
      return res.status(400).json({ error: 'Unsupported AI provider' });
    }
  } catch (error) {
    console.error(`Error calling ${provider} API:`, error);
    res.status(500).json({ error: `Failed to get response from ${provider} API` });
  }
});

// Git history endpoint
app.post('/api/git-history', async (req, res) => {
  const { path, owner, repo } = req.body;
  
  if (!path || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, owner, repo' });
  }

  try {
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${path}`;
    console.log('Fetching git history:', githubUrl);
    
    const response = await fetch(githubUrl, {
      headers: {
        'User-Agent': 'Agentic-Markdown-Todos',
        'Authorization': req.headers.authorization || '',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const commits = await response.json();
    
    const formattedCommits = commits.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date,
      url: commit.html_url
    }));

    res.json({ commits: formattedCommits });
  } catch (error) {
    console.error('Error fetching git history:', error);
    res.status(500).json({ error: 'Failed to fetch git history' });
  }
});

// Get file content at specific commit
app.post('/api/file-at-commit', async (req, res) => {
  const { path, sha, owner, repo } = req.body;
  
  if (!path || !sha || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, sha, owner, repo' });
  }

  try {
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${sha}`;
    console.log('Fetching file at commit:', githubUrl);
    
    const response = await fetch(githubUrl, {
      headers: {
        'User-Agent': 'Agentic-Markdown-Todos',
        'Authorization': req.headers.authorization || '',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    res.json({ content, sha: data.sha });
  } catch (error) {
    console.error('Error fetching file at commit:', error);
    res.status(500).json({ error: 'Failed to fetch file at commit' });
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    res.json({ message: 'AM-Todos API Server', status: 'running', timestamp: new Date().toISOString() });
  }
});

// Handle 404 for unknown routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else if (process.env.NODE_ENV === 'production') {
    // For any non-API route, serve the React app (SPA fallback)
    const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server successfully listening at http://0.0.0.0:${port}`);
  console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
});
