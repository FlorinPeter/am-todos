import crypto from 'crypto';
import logger from '../logger.js';

// Global state management for proxy connections
const activeProxies = new Map(); // proxyId -> WebSocket connection
const activeClients = new Map(); // clientId -> HTTP response object
const proxyCredentials = new Map(); // proxyUuid -> { localToken, displayName, capabilities, etc. }

// Helper function to determine if action requires structured output
function requiresStructuredOutput(action) {
  return ['processChatMessage', 'generateCommitMessage', 'generateInitialPlan'].includes(action);
}

// Helper function to process local proxy AI requests
async function processLocalProxyRequest(req, res) {
  const { action, payload, provider, apiKey, model, proxyUuid, proxyLocalToken } = req.body;
  const clientId = crypto.randomUUID(); // Unique ID for response routing
  
  logger.log('🏠 Processing local proxy request:', action, 'Client ID:', clientId);
  
  // Validate user-specific proxy credentials are provided
  if (!proxyUuid || !proxyLocalToken) {
    return res.status(400).json({ 
      error: 'User proxy credentials required for local proxy processing. Please configure your proxy UUID and localToken in Settings.' 
    });
  }
  
  // Check if the user's specific proxy is connected
  if (!activeProxies.has(proxyUuid)) {
    logger.warn('⚠️ User proxy not connected:', proxyUuid);
    return res.status(503).json({ 
      error: 'Your proxy is not currently connected to the server. Please ensure your proxy container is running and configured correctly.',
      setupInstructions: 'Check your proxy status in Settings and restart your proxy container if needed.',
      userProxyId: proxyUuid,
      availableProxies: activeProxies.size
    });
  }
  
  // Validate user proxy credentials match stored credentials
  const storedCredentials = proxyCredentials.get(proxyUuid);
  if (!storedCredentials) {
    logger.warn('⚠️ User proxy not registered:', proxyUuid);
    return res.status(503).json({ 
      error: 'Your proxy is connected but not properly registered. Please restart your proxy container.',
      userProxyId: proxyUuid
    });
  }
  
  if (storedCredentials.localToken !== proxyLocalToken) {
    logger.warn('🚨 Invalid proxy credentials for user:', proxyUuid);
    return res.status(401).json({ 
      error: 'Invalid proxy credentials. Please check your proxy UUID and localToken in Settings.',
      userProxyId: proxyUuid
    });
  }
  
  // Get the user's specific proxy WebSocket connection
  const userProxyWs = activeProxies.get(proxyUuid);
  if (!userProxyWs) {
    logger.warn('⚠️ User proxy connection lost:', proxyUuid);
    return res.status(503).json({ 
      error: 'Your proxy connection was lost. Please restart your proxy container.',
      userProxyId: proxyUuid
    });
  }
  
  logger.log('✅ Routing local proxy request to user proxy:', proxyUuid);
  
  const message = {
    type: 'ai_request',
    id: crypto.randomUUID(),
    action: action,
    payload: payload,
    targetClientId: clientId, // For response routing back to this HTTP request
    timestamp: new Date().toISOString(),
    // Include original request context for local proxy processing
    requestContext: {
      provider: provider || 'local',
      model: model || 'default',
      originalApiKey: 'REDACTED' // Never send actual API keys to local proxy
    },
    // Include proxy local token for message validation by the proxy
    proxyLocalToken: proxyLocalToken
  };
  
  try {
    // Store the HTTP response object for later use when proxy responds
    activeClients.set(clientId, res);
    
    // Set timeout for local proxy response (configurable, default 4 minutes for AI operations)
    const proxyTimeoutMs = parseInt(process.env.PROXY_AI_TIMEOUT_MS || '240000', 10);
    const timeoutId = setTimeout(() => {
      if (activeClients.has(clientId)) {
        logger.warn('⏰ User proxy response timeout for client:', clientId, 'User proxy:', proxyUuid, 'Timeout:', proxyTimeoutMs + 'ms');
        res.status(504).json({ 
          error: `Your proxy did not respond within ${proxyTimeoutMs / 1000} seconds. Check your local AI service status and proxy connection.`,
          userProxyId: proxyUuid,
          timeoutMs: proxyTimeoutMs
        });
        activeClients.delete(clientId);
      }
    }, proxyTimeoutMs);
    
    // Clean up timeout when response is received
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });
    
    // Development mode: Log local proxy request details being sent to proxy
    if (process.env.NODE_ENV === 'development') {
      logger.log('🤖 LOCAL PROXY REQUEST (WebSocket):', JSON.stringify({
        action,
        proxyUuid,
        clientId,
        model: model || 'local-ai',
        requiresStructuredOutput: requiresStructuredOutput(action),
        payload,
        fullMessage: message
      }, null, 2));
    }

    // Send request to user's specific proxy via WebSocket
    userProxyWs.send(JSON.stringify(message));
    logger.log('📤 Forwarded auto-detected local proxy request to user proxy:', proxyUuid, 'for client:', clientId);
    
  } catch (error) {
    logger.error('💔 Error forwarding to local proxy:', error);
    activeClients.delete(clientId);
    res.status(500).json({ 
      error: 'Failed to forward request to local proxy: ' + error.message 
    });
  }
}

// Get proxy state information for debugging
function getProxyDebugInfo() {
  const activeProxyList = Array.from(activeProxies.keys());
  const credentialsList = Array.from(proxyCredentials.keys());
  
  return {
    activeProxies: {
      count: activeProxies.size,
      ids: activeProxyList
    },
    proxyCredentials: {
      count: proxyCredentials.size,
      ids: credentialsList,
      details: Object.fromEntries(
        Array.from(proxyCredentials.entries()).map(([id, creds]) => [
          id, 
          {
            displayName: creds.displayName,
            localTokenPrefix: creds.localToken?.substring(0, 8) + '...',
            capabilities: creds.capabilities || []
          }
        ])
      )
    },
    discrepancies: {
      inActiveButNotCredentials: activeProxyList.filter(id => !proxyCredentials.has(id)),
      inCredentialsButNotActive: credentialsList.filter(id => !activeProxies.has(id))
    }
  };
}

// Check proxy status for specific proxy
function checkProxyStatus(proxyUuid, proxyLocalToken) {
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
    
    // Validate credentials if proxy is connected
    let credentialsMatch = false;
    if (isConnected && storedCredentials && proxyLocalToken) {
      credentialsMatch = storedCredentials.localToken === proxyLocalToken;
    }
    
    return {
      success: true,
      status: {
        connected: isConnected,
        registered: !!storedCredentials,
        credentialsValid: credentialsMatch,
        displayName: storedCredentials?.displayName || 'Unknown',
        capabilities: storedCredentials?.capabilities || [],
        lastRegistered: storedCredentials?.registeredAt || null
      },
      ...debugInfo
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// WebSocket message handler for proxy connections
function handleProxyMessage(ws, data, proxyUuid) {
  try {
    const message = JSON.parse(data.toString());
    logger.log('📨 Received message from proxy:', proxyUuid, 'Type:', message.type);
    
    // Validate proxy is registered (except for registration messages)
    if (message.type !== 'register') {
      const storedCredentials = proxyCredentials.get(proxyUuid);
      if (!storedCredentials) {
        logger.warn('❌ Message from unregistered proxy:', proxyUuid);
        ws.send(JSON.stringify({
          type: 'error',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: {
            error: 'Proxy not registered. Please send registration message first.'
          }
        }));
        return;
      }
    }
    
    // Handle different message types
    switch (message.type) {
      case 'register':
        handleProxyRegistration(ws, message, proxyUuid);
        break;
      case 'heartbeat':
        handleProxyHeartbeat(ws, message, proxyUuid);
        break;
      case 'ai_response':
        handleProxyAIResponse(message);
        break;
      case 'error':
        handleProxyErrorMessage(message);
        break;
      default:
        logger.warn('❓ Unknown message type from proxy:', proxyUuid, message.type);
    }
  } catch (error) {
    logger.error('💔 Error parsing message from proxy:', proxyUuid, error);
  }
}

// Handle proxy registration
function handleProxyRegistration(ws, message, proxyUuid) {
  logger.startup('📝 Processing proxy registration:', proxyUuid);
  
  // Validate registration payload
  if (!message.payload || !message.payload.localToken) {
    logger.error('❌ Invalid registration payload from proxy:', proxyUuid);
    ws.send(JSON.stringify({
      type: 'register_error',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        error: 'Invalid registration payload - missing localToken'
      }
    }));
    return;
  }
  
  // Store proxy credentials and capabilities
  proxyCredentials.set(proxyUuid, {
    localToken: message.payload.localToken,
    displayName: message.payload.displayName,
    localAiEndpoint: message.payload.localAiEndpoint,
    localAiModel: message.payload.localAiModel,
    capabilities: message.payload.capabilities || [],
    version: message.payload.version || 'unknown',
    registeredAt: new Date().toISOString()
  });
  
  logger.startup('✅ Proxy registered successfully:', proxyUuid);
  logger.startup('📋 Proxy details:', {
    displayName: message.payload.displayName,
    model: message.payload.localAiModel,
    capabilities: message.payload.capabilities
  });
  
  // Debug: Log current state of proxy stores
  const debugInfo = {
    activeProxiesCount: activeProxies.size,
    proxyCredentialsCount: proxyCredentials.size,
    hasActiveProxy: activeProxies.has(proxyUuid),
    hasCredentials: proxyCredentials.has(proxyUuid),
    activeProxyIds: Array.from(activeProxies.keys()),
    credentialIds: Array.from(proxyCredentials.keys())
  };
  logger.startup(`🔍 Debug - Current proxy stores state: ${JSON.stringify(debugInfo, null, 2)}`);
  
  // Send registration acknowledgment
  ws.send(JSON.stringify({
    type: 'register_ack',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    payload: {
      success: true,
      supportedFeatures: ['ai_request_processing', 'heartbeat'],
      serverVersion: '1.0.0'
    }
  }));
}

// Handle proxy heartbeat
function handleProxyHeartbeat(ws, message, proxyUuid) {
  logger.log('💓 Heartbeat from proxy:', proxyUuid);
  
  // Send heartbeat acknowledgment
  ws.send(JSON.stringify({
    type: 'heartbeat_ack',
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    proxyId: proxyUuid
  }));
}

// Handle AI response from proxy
function handleProxyAIResponse(message) {
  logger.log('🤖 AI response received from proxy, routing to client:', message.targetClientId);
  
  // Forward AI response back to waiting HTTP client
  const targetClientId = message.targetClientId;
  const clientResponse = activeClients.get(targetClientId);
  
  if (clientResponse) {
    logger.log('✅ Forwarding proxy AI response to client:', targetClientId);
    clientResponse.json({
      description: message.payload.description,
      text: message.payload.content  // Identical to OpenRouter format
    });
    activeClients.delete(targetClientId); // Cleanup
  } else {
    logger.warn('⚠️ No waiting client found for response:', targetClientId);
  }
}

// Handle error from proxy
function handleProxyErrorMessage(message) {
  logger.error('❌ Error from proxy:', message.payload?.error || 'Unknown error');
  
  // Handle error from local proxy
  const targetClientId = message.targetClientId;
  const clientResponse = activeClients.get(targetClientId);
  
  if (clientResponse) {
    logger.error('❌ Local proxy error:', message.payload.error);
    clientResponse.status(500).json({ 
      error: 'Local AI proxy error: ' + (message.payload.error || 'Unknown error')
    });
    activeClients.delete(targetClientId); // Cleanup
  }
}

// Handle proxy disconnection
function handleProxyDisconnection(proxyUuid) {
  logger.log('🔌 Local proxy disconnected:', proxyUuid);
  activeProxies.delete(proxyUuid);
  proxyCredentials.delete(proxyUuid); // Cleanup credentials
}

// Handle proxy WebSocket error
function handleProxyError(proxyUuid, error) {
  logger.error('💔 WebSocket error for proxy:', proxyUuid, error);
  activeProxies.delete(proxyUuid);
  proxyCredentials.delete(proxyUuid); // Cleanup credentials
}

// Add proxy connection
function addProxyConnection(proxyUuid, ws) {
  activeProxies.set(proxyUuid, ws);
  logger.log('✅ Proxy connection added:', proxyUuid);
}

// Get active proxy count
function getActiveProxyCount() {
  return activeProxies.size;
}

export {
  activeProxies,
  activeClients,
  proxyCredentials,
  requiresStructuredOutput,
  processLocalProxyRequest,
  getProxyDebugInfo,
  checkProxyStatus,
  handleProxyMessage,
  handleProxyRegistration,
  handleProxyHeartbeat,
  handleProxyAIResponse,
  handleProxyErrorMessage,
  handleProxyError,
  handleProxyDisconnection,
  addProxyConnection,
  getActiveProxyCount
};