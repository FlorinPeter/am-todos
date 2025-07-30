import express from 'express';
import logger from '../logger.js';

const router = express.Router();

// Git history endpoint for GitHub
router.post('/api/git-history', async (req, res) => {
  const { path, owner, repo } = req.body;
  
  if (!path || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, owner, repo' });
  }

  try {
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${path}`;
    logger.log('Fetching git history:', githubUrl);
    
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
    logger.error('Error fetching git history:', error);
    res.status(500).json({ error: 'Failed to fetch git history' });
  }
});

// Get file content at specific commit
router.post('/api/file-at-commit', async (req, res) => {
  const { path, sha, owner, repo } = req.body;
  
  if (!path || !sha || !owner || !repo) {
    return res.status(400).json({ error: 'Missing required fields: path, sha, owner, repo' });
  }

  try {
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${sha}`;
    logger.log('Fetching file at commit:', githubUrl);
    
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
    logger.error('Error fetching file at commit:', error);
    res.status(500).json({ error: 'Failed to fetch file at commit' });
  }
});

export default router;