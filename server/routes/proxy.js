import express from 'express';
import logger from '../logger.js';
import { mainServerTokenAuth } from '../middleware/auth.js';
import { 
  activeProxies, 
  proxyCredentials, 
  getProxyDebugInfo, 
  checkProxyStatus 
} from '../services/proxyManager.js';

const router = express.Router();

// Get main server token for local proxy setup (development: open, production: protected)
router.get('/api/main-server-token', mainServerTokenAuth, (req, res) => {
  const mainServerToken = process.env.MAIN_SERVER_TOKEN;
  
  if (!mainServerToken) {
    return res.status(503).json({ 
      error: 'Main server token not configured. Set MAIN_SERVER_TOKEN environment variable.' 
    });
  }
  
  res.json({
    token: mainServerToken,
    wsUrl: process.env.NODE_ENV === 'production' 
      ? `wss://${req.get('host')}/proxy-ws`
      : `ws://${req.get('host')}/proxy-ws`,
    activeProxies: activeProxies.size,
    instructions: {
      docker: `docker run -d --name am-todos-proxy -v ./proxy-config:/config -e LOCAL_PROXY_MODE=true -e MAIN_SERVER_TOKEN=${mainServerToken} -e MAIN_SERVER_URL=${process.env.NODE_ENV === 'production' ? `wss://${req.get('host')}/proxy-ws` : `ws://${req.get('host')}/proxy-ws`} -e LOCAL_AI_ENDPOINT=http://localhost:1234 -e LOCAL_AI_MODEL=mistralai/mistral-small-3.2 --network host ghcr.io/florinpeter/am-todos:${process.env.VERSION || 'latest'}`,
      environment: {
        LOCAL_PROXY_MODE: 'true',
        MAIN_SERVER_TOKEN: mainServerToken,
        MAIN_SERVER_URL: process.env.NODE_ENV === 'production' 
          ? `wss://${req.get('host')}/proxy-ws`
          : `ws://${req.get('host')}/proxy-ws`,
        LOCAL_AI_ENDPOINT: 'http://localhost:1234',
        LOCAL_AI_MODEL: 'mistralai/mistral-small-3.2'
      }
    }
  });
});

// Test local AI endpoint connectivity (for setup validation)
router.post('/api/test-local-ai', async (req, res) => {
  const { endpoint, model } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint URL' });
  }
  
  try {
    const testUrl = `${endpoint}/api/generate`;  // Ollama API format
    const testPayload = {
      model: model || 'test',
      prompt: 'Hello',
      stream: false
    };
    
    const startTime = Date.now();
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const latency = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        latency: latency,
        endpoint: endpoint,
        status: response.status,
        available: true
      });
    } else {
      res.json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        latency: latency,
        endpoint: endpoint
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      endpoint: endpoint,
      available: false
    });
  }
});

// Debug endpoint to check current proxy stores state (development only)
router.get('/api/debug/proxy-stores', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Debug endpoint not available in production' });
  }
  
  const debugInfo = getProxyDebugInfo();
  res.json(debugInfo);
});

// Check user-specific proxy connection status and validate credentials
router.post('/api/proxy-status', async (req, res) => {
  const { proxyUuid, proxyLocalToken } = req.body;
  
  if (!proxyUuid) {
    return res.status(400).json({ 
      error: 'Missing proxyUuid. Please provide your proxy UUID from /config/settings.json' 
    });
  }
  
  if (!proxyLocalToken) {
    return res.status(400).json({ 
      error: 'Missing proxyLocalToken. Please provide your proxy local token from /config/settings.json' 
    });
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(proxyUuid)) {
    return res.status(400).json({ 
      error: 'Invalid UUID format. Please check your proxy UUID from /config/settings.json' 
    });
  }
  
  // Validate localToken format (64-character hex string)
  const tokenRegex = /^[0-9a-f]{64}$/i;
  if (!tokenRegex.test(proxyLocalToken)) {
    return res.status(400).json({ 
      error: 'Invalid localToken format. Please check your proxy local token from /config/settings.json' 
    });
  }
  
  try {
    // Check if proxy is currently connected
    const isConnected = activeProxies.has(proxyUuid);
    const storedCredentials = proxyCredentials.get(proxyUuid);
    
    // Debug information (only in development)
    const debugInfo = process.env.NODE_ENV !== 'production' ? {
      debug: {
        activeProxiesCount: activeProxies.size,
        proxyCredentialsCount: proxyCredentials.size,
        hasActiveProxy: isConnected,
        hasCredentials: !!storedCredentials,
        activeProxyIds: Array.from(activeProxies.keys()),
        credentialIds: Array.from(proxyCredentials.keys()),
        requestedUuid: proxyUuid,
        requestedToken: proxyLocalToken ? proxyLocalToken.substring(0, 8) + '...' : 'MISSING'
      }
    } : {};
    
    if (!isConnected) {
      return res.json({
        connected: false,
        status: 'disconnected',
        message: 'Your proxy is not currently connected to the main server',
        troubleshooting: {
          steps: [
            'Verify your proxy container is running',
            'Check that MAIN_SERVER_TOKEN matches the server token',
            'Ensure MAIN_SERVER_URL points to this server',
            'Check proxy logs for connection errors'
          ]
        },
        ...debugInfo
      });
    }
    
    if (!storedCredentials) {
      return res.json({
        connected: false,
        status: 'not_registered',
        message: 'Your proxy is connected but not registered. This should not happen.',
        troubleshooting: {
          steps: [
            'Restart your proxy container',
            'Check proxy logs for registration errors',
            'Verify proxy configuration in /config/settings.json'
          ]
        },
        ...debugInfo
      });
    }
    
    // Validate credentials match
    if (storedCredentials.localToken !== proxyLocalToken) {
      return res.status(401).json({
        connected: false,
        status: 'invalid_credentials',
        message: 'Proxy found but credentials do not match',
        troubleshooting: {
          steps: [
            'Check your proxy UUID and localToken from /config/settings.json',
            'Ensure you copied the credentials correctly',
            'If the proxy was recreated, update your frontend settings with new credentials'
          ]
        },
        ...debugInfo,
        ...(process.env.NODE_ENV !== 'production' ? {
          credentialDebug: {
            storedToken: storedCredentials.localToken ? storedCredentials.localToken.substring(0, 8) + '...' : 'MISSING',
            providedToken: proxyLocalToken ? proxyLocalToken.substring(0, 8) + '...' : 'MISSING',
            tokensMatch: storedCredentials.localToken === proxyLocalToken
          }
        } : {})
      });
    }
    
    // Success - proxy is connected and credentials are valid
    res.json({
      connected: true,
      status: 'connected',
      message: 'Your proxy is connected and ready for local AI processing',
      proxyInfo: {
        uuid: proxyUuid,
        displayName: storedCredentials.displayName,
        localAiEndpoint: storedCredentials.localAiEndpoint,
        localAiModel: storedCredentials.localAiModel,
        capabilities: storedCredentials.capabilities || [],
        version: storedCredentials.version || '1.0.0',
        registeredAt: storedCredentials.registeredAt,
        lastHeartbeat: storedCredentials.lastHeartbeat
      }
    });
    
  } catch (error) {
    logger.error('Error checking proxy status:', error);
    res.status(500).json({ 
      error: 'Failed to check proxy status: ' + error.message 
    });
  }
});

export default router;