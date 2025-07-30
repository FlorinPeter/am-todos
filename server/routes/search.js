import express from 'express';
import logger from '../logger.js';
import { validateAndSanitizeSearchQuery } from '../utils/redosProtection.js';
import { sanitizeHeader } from '../middleware/security.js';

const router = express.Router();

// Search endpoint for both GitHub and GitLab
router.post('/api/search', async (req, res) => {
  const { query, scope = 'folder', folder = 'todos', provider, ...credentials } = req.body;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty search query' });
  }

  if (!provider) {
    return res.status(400).json({ error: 'Missing provider (github or gitlab)' });
  }

  // ReDoS protection: Validate and sanitize search query
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const validation = validateAndSanitizeSearchQuery(query.trim(), clientIp);
  
  if (!validation.isValid) {
    logger.warn(`🚨 INVALID SEARCH QUERY from ${clientIp}: ${validation.error}`);
    return res.status(400).json({ 
      error: validation.error,
      remaining_requests: validation.remainingRequests 
    });
  }

  const sanitizedQuery = validation.sanitizedQuery;
  logger.log(`🔍 Search query sanitized from ${clientIp}:`, { 
    original: query.trim(), 
    sanitized: sanitizedQuery,
    remaining_requests: validation.remainingRequests 
  });

  try {
    let results = [];

    if (provider === 'github') {
      const { owner, repo, token } = credentials;
      
      if (!owner || !repo || !token) {
        return res.status(400).json({ error: 'Missing GitHub credentials: owner, repo, token' });
      }

      // Security: Validate owner and repo names
      const validNamePattern = /^[a-zA-Z0-9._-]+$/;
      if (!validNamePattern.test(owner) || !validNamePattern.test(repo)) {
        return res.status(403).json({ error: 'Invalid owner or repository name' });
      }

      // Build GitHub search query using sanitized input
      let searchQuery = `${sanitizedQuery} in:file repo:${owner}/${repo}`;
      
      if (scope === 'folder') {
        searchQuery += ` path:${folder}`;
      }

      const githubUrl = `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=50`;
      logger.log('GitHub search URL:', githubUrl);

      const response = await fetch(githubUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Agentic-Markdown-Todos',
          'Authorization': `token ${sanitizeHeader(token)}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 422) {
          return res.status(400).json({ error: 'Invalid search query. Search requires at least one search term.' });
        }
        if (response.status === 403) {
          return res.status(429).json({ error: 'GitHub search API rate limit exceeded. Please try again in a few minutes.' });
        }
        const errorText = await response.text();
        logger.error('GitHub search API error:', response.status, errorText);
        throw new Error(`GitHub search API error: ${response.statusText}`);
      }

      const searchResults = await response.json();
      
      // Normalize GitHub results to consistent format
      results = searchResults.items.map(item => ({
        path: item.path,
        name: item.name,           // GitHub uses 'name'
        sha: item.sha,             // GitHub uses 'sha'
        url: item.html_url,
        repository: item.repository.full_name,
        text_matches: item.text_matches || []
      }));

    } else if (provider === 'gitlab') {
      const { instanceUrl, projectId, token } = credentials;
      
      if (!instanceUrl || !projectId || !token) {
        return res.status(400).json({ error: 'Missing GitLab credentials: instanceUrl, projectId, token' });
      }

      // Build GitLab search query using sanitized input
      // Note: GitLab doesn't support GitHub-style path: syntax
      // We'll filter by folder on the backend after getting results
      let searchQuery = sanitizedQuery;

      const gitlabUrl = `${instanceUrl}/api/v4/projects/${projectId}/search?scope=blobs&search=${encodeURIComponent(searchQuery)}`;
      logger.log('GitLab search URL:', gitlabUrl);

      const response = await fetch(gitlabUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sanitizeHeader(token)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ error: 'GitLab authentication failed. Please check your access token.' });
        }
        if (response.status === 403) {
          return res.status(403).json({ error: 'GitLab access denied. Please check your permissions.' });
        }
        if (response.status === 429) {
          return res.status(429).json({ error: 'GitLab search API rate limit exceeded. Please try again in a few minutes.' });
        }
        if (response.status === 422) {
          return res.status(400).json({ error: 'Invalid GitLab search query. Please check your search terms.' });
        }
        const errorText = await response.text();
        logger.error('GitLab search API error:', response.status, errorText);
        return res.status(500).json({ error: `GitLab search API error: ${response.statusText}` });
      }

      const searchResults = await response.json();
      
      // Normalize GitLab results to match GitHub format for consistency
      results = searchResults.map(item => ({
        path: item.path,
        name: item.filename,       // GitLab uses 'filename' -> normalize to 'name'
        sha: item.ref,             // GitLab uses 'ref' -> normalize to 'sha'
        url: `${instanceUrl}/${projectId}/-/blob/main/${item.path}`,
        repository: `project-${projectId}`,
        text_matches: []           // GitLab doesn't provide text matches in the same format
      }));

    } else {
      return res.status(400).json({ error: 'Unsupported provider. Use "github" or "gitlab".' });
    }

    // Filter results to only include markdown files and apply folder filtering
    if (scope === 'folder') {
      results = results.filter(item => {
        const isMarkdown = item.name.endsWith('.md') && item.name !== '.gitkeep';
        
        // For GitLab, filter by folder path since we couldn't do it in the query
        if (provider === 'gitlab') {
          const isInFolder = item.path.startsWith(`${folder}/`);
          return isMarkdown && isInFolder;
        }
        
        // For GitHub, filtering was already done in the query
        return isMarkdown;
      });
    } else {
      // For repo-wide search, still filter to markdown files
      results = results.filter(item => item.name.endsWith('.md') && item.name !== '.gitkeep');
    }

    // CRITICAL: Deduplicate results by file path to prevent multiple copies of same file
    // GitHub search API can return same file multiple times if query matches title AND content
    const uniqueResults = [];
    const seenPaths = new Set();
    
    for (const item of results) {
      if (!seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        uniqueResults.push(item);
      } else {
        logger.log('Deduplicating duplicate search result:', item.path);
      }
    }
    
    results = uniqueResults;
    logger.log(`Search results: ${results.length} unique files after deduplication`);

    // Helper function to parse filename metadata (server-side version)
    const parseFilenameMetadata = (fullPath) => {
      // Extract just the filename from the full path
      const filename = fullPath.split('/').pop() || fullPath;
      
      // Pattern: P{1-5}--YYYY-MM-DD--Title_With_Underscores.md
      const newFormatPattern = /^P([1-5])--(\d{4}-\d{2}-\d{2})--(.+)\.md$/;
      const newMatch = filename.match(newFormatPattern);
      
      if (newMatch) {
        const [, priority, date, title] = newMatch;
        return {
          priority: parseInt(priority),
          date,
          title,
          displayTitle: title.replace(/_/g, ' ')
        };
      }
      
      // Pattern: YYYY-MM-DD-title.md (legacy format)
      const legacyPattern = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
      const legacyMatch = filename.match(legacyPattern);
      
      if (legacyMatch) {
        const [, date, title] = legacyMatch;
        return {
          priority: 3, // Default priority for legacy files
          date,
          title,
          displayTitle: title.replace(/-/g, ' ')
        };
      }
      
      return null;
    };

    // Enhance search results with metadata from filenames (NO API CALLS!)
    // This replaces the expensive frontmatter fetching with instant filename parsing
    const enhancedResults = results.map(result => {
      const metadata = parseFilenameMetadata(result.name);
      
      if (metadata) {
        // Use filename metadata - much faster than content fetching!
        return {
          ...result,
          priority: metadata.priority,
          displayTitle: metadata.displayTitle
        };
      } else {
        // Unknown format - use defaults
        return {
          ...result,
          priority: 3,
          displayTitle: result.name.replace(/\.md$/, '').replace(/-/g, ' ')
        };
      }
    });

    res.json({
      query: sanitizedQuery,
      scope,
      total_count: enhancedResults.length,
      items: enhancedResults
    });

  } catch (error) {
    logger.error('Search endpoint error:', error);
    res.status(500).json({ error: 'Failed to perform search: ' + error.message });
  }
});

export default router;