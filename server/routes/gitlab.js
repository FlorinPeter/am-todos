import express from 'express';
import GitLabService from '../services/gitlabService.js';
import logger from '../logger.js';

const router = express.Router();

// GitLab API proxy endpoint with security validation
router.post('/api/gitlab', async (req, res) => {
  const { action, instanceUrl, projectId, token, branch = 'main', ...params } = req.body || {};
  
  if (!action || !instanceUrl || !projectId || !token) {
    return res.status(400).json({ error: 'Missing required fields: action, instanceUrl, projectId, token' });
  }

  try {
    const gitlab = new GitLabService(instanceUrl, projectId, token);
    let result;

    switch (action) {
      case 'getFile':
        if (!params.filePath) {
          return res.status(400).json({ error: 'Missing filePath for getFile action' });
        }
        result = await gitlab.getFile(params.filePath, branch);
        break;

      case 'getRawFile':
        if (!params.filePath) {
          return res.status(400).json({ error: 'Missing filePath for getRawFile action' });
        }
        const content = await gitlab.getRawFile(params.filePath, branch);
        result = { content };
        break;

      case 'listFiles':
        result = await gitlab.listFiles(params.path || '', branch);
        break;

      case 'createOrUpdateFile':
        if (!params.filePath || !params.content || !params.commitMessage) {
          return res.status(400).json({ error: 'Missing required fields for createOrUpdateFile: filePath, content, commitMessage' });
        }
        result = await gitlab.createOrUpdateFile(params.filePath, params.content, params.commitMessage, branch);
        break;

      case 'deleteFile':
        if (!params.filePath || !params.commitMessage) {
          return res.status(400).json({ error: 'Missing required fields for deleteFile: filePath, commitMessage' });
        }
        result = await gitlab.deleteFile(params.filePath, params.commitMessage, branch);
        break;

      case 'getProject':
        result = await gitlab.getProject();
        break;

      case 'getFileHistory':
        logger.info(`📡 Server received getFileHistory action for: ${params.filePath}`);
        if (!params.filePath) {
          return res.status(400).json({ error: 'Missing filePath for getFileHistory action' });
        }
        logger.info(`📡 About to call gitlab.getFileHistory(${params.filePath}, ${branch})`);
        result = await gitlab.getFileHistory(params.filePath, branch);
        logger.info(`📡 getFileHistory returned ${Array.isArray(result) ? result.length : 'non-array'} results`);
        break;

      case 'getFileAtCommit':
        if (!params.filePath || !params.sha) {
          return res.status(400).json({ error: 'Missing required fields for getFileAtCommit: filePath, sha' });
        }
        result = await gitlab.getFileAtCommit(params.filePath, params.sha);
        if (result === null) {
          return res.status(404).json({ error: 'File not found at the specified commit' });
        }
        break;

      case 'getRepositoryTree':
        result = await gitlab.getRepositoryTree(params.path || '', params.recursive || false, branch);
        break;

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    res.json(result);
  } catch (error) {
    logger.error('GitLab API proxy error:', error);
    res.status(500).json({ error: 'Failed to process GitLab API request: ' + error.message });
  }
});

export default router;