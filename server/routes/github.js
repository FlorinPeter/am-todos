import express from 'express';
import logger from '../logger.js';
import { sanitizeHeader } from '../middleware/security.js';

const router = express.Router();

// GitHub API proxy endpoint with security validation
router.post('/api/github', async (req, res) => {
  const { path, method = 'GET', headers = {}, body, owner, repo } = req.body || {};
  
  if (!path || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, owner, repo' });
  }

  // Security: Validate owner and repo names (no path traversal characters)
  const validNamePattern = /^[a-zA-Z0-9._-]+$/;
  if (!validNamePattern.test(owner) || !validNamePattern.test(repo)) {
    return res.status(403).json({ error: 'Invalid owner or repository name' });
  }

  // Security: Validate that the request is for the expected repository pattern
  const expectedRepoPattern = new RegExp(`^/repos/${owner}/${repo}/`);
  if (!expectedRepoPattern.test(path)) {
    return res.status(403).json({ error: 'Invalid repository path' });
  }

  // Security: Prevent path traversal attacks
  if (path.includes('..') || path.includes('\\') || path.includes('%2e%2e')) {
    return res.status(403).json({ error: 'Path traversal detected' });
  }

  // Security: Only allow specific GitHub API endpoints for contents and commits
  const allowedPatterns = [
    // Allow any contents endpoint (for dynamic folder support) - more restrictive
    new RegExp(`^/repos/${owner}/${repo}/contents/[a-zA-Z0-9._/-]*$`),
    // Allow commits endpoint with specific repo
    new RegExp(`^/repos/${owner}/${repo}/commits`),
    // Allow root contents listing (for folder discovery) - specific repo only
    new RegExp(`^/repos/${owner}/${repo}/contents/?$`)
  ];
  
  const isAllowedEndpoint = allowedPatterns.some(pattern => pattern.test(path));
  
  if (!isAllowedEndpoint) {
    logger.log('Blocked endpoint:', path);
    return res.status(403).json({ error: 'Endpoint not allowed' });
  }

  try {
    const githubUrl = `https://api.github.com${path}`;
    logger.log('Proxying GitHub API request:', method, githubUrl);
    
    const fetchOptions = {
      method,
      headers: {
        'User-Agent': 'Agentic-Markdown-Todos',
        // Security: Only forward specific headers with sanitization
        ...(headers.Authorization && { Authorization: sanitizeHeader(headers.Authorization) }),
        ...(headers['Content-Type'] && { 'Content-Type': sanitizeHeader(headers['Content-Type']) }),
        ...(headers.Accept && { Accept: sanitizeHeader(headers.Accept) })
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
    logger.error('GitHub API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy GitHub API request' });
  }
});

export default router;