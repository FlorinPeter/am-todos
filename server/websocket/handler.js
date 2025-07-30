import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import logger from '../logger.js';
import {
  activeProxies,
  activeClients,
  proxyCredentials,
  addProxyConnection,
  handleProxyDisconnection,
  handleProxyError
} from '../services/proxyManager.js';

// Create WebSocket server
function createWebSocketServer(server) {
  const wss = new WebSocketServer({ 
    server,  // Use the same HTTP server as Express
    path: '/proxy-ws'  // WebSocket endpoint path
  });

  // WebSocket connection handler for local AI proxies
  wss.on('connection', (ws, request) => {
    logger.log('🔌 WebSocket connection attempt from:', request.socket.remoteAddress);
    
    // Authenticate using MAIN_SERVER_TOKEN from headers
    const authToken = request.headers['x-main-server-token'];
    const proxyUuid = request.headers['x-proxy-uuid'];
    const proxyLocalToken = request.headers['x-proxy-local-token'];
    const proxyDisplayName = request.headers['x-proxy-display-name'];
    const mainServerToken = process.env.MAIN_SERVER_TOKEN;
    
    if (!mainServerToken) {
      logger.warn('⚠️ MAIN_SERVER_TOKEN not configured - WebSocket connections disabled');
      ws.close(1008, 'WebSocket proxy service not configured');
      return;
    }
    
    if (authToken !== mainServerToken) {
      logger.warn('🚨 WebSocket authentication failed from:', request.socket.remoteAddress);
      ws.close(1008, 'Authentication failed');
      return;
    }
    
    if (!proxyUuid) {
      logger.warn('🚨 Missing proxy UUID in connection headers');
      ws.close(1008, 'Missing proxy UUID');
      return;
    }
    
    if (!proxyLocalToken) {
      logger.warn('🚨 Missing proxy localToken in connection headers');
      ws.close(1008, 'Missing proxy localToken');
      return;
    }
    
    logger.log('✅ Local proxy connected via WebSocket:', proxyUuid);
    logger.log('🔐 Proxy credentials received:', {
      uuid: proxyUuid,
      localToken: proxyLocalToken.substring(0, 8) + '...',
      displayName: proxyDisplayName
    });
    
    // Store connection for message routing (temporarily, until registration is confirmed)
    addProxyConnection(proxyUuid, ws);
    
    // Handle incoming messages from local proxies
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.log('📨 WebSocket message received:', message.type, 'from proxy:', proxyUuid);
        
        // Validate proxy is registered (except for registration messages)
        if (message.type !== 'register') {
          const storedCredentials = proxyCredentials.get(proxyUuid);
          if (!storedCredentials) {
            logger.warn('❌ Message from unregistered proxy:', proxyUuid);
            ws.send(JSON.stringify({
              type: 'error',
              id: message.id || crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              payload: { error: 'Proxy not registered. Please send registration message first.' }
            }));
            return;
          }
          
          // Validate localToken for critical messages (ai_response, error)
          if (['ai_response', 'error'].includes(message.type)) {
            if (!message.proxyLocalToken || message.proxyLocalToken !== storedCredentials.localToken) {
              logger.warn('❌ Invalid localToken in message from proxy:', proxyUuid);
              ws.send(JSON.stringify({
                type: 'error',
                id: message.id || crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                payload: { error: 'Invalid proxy localToken. Message rejected for security.' }
              }));
              return;
            }
          }
          
          // Update last heartbeat for registered proxy
          storedCredentials.lastHeartbeat = new Date().toISOString();
        }
        
        if (message.type === 'register') {
          // Handle proxy registration
          logger.log('📝 Processing proxy registration...');
          logger.log('🔍 Registration message received:', {
            hasPayload: !!message.payload,
            payloadUuid: message.payload?.uuid,
            payloadLocalToken: message.payload?.localToken ? message.payload.localToken.substring(0, 8) + '...' : 'MISSING',
            connectionUuid: proxyUuid,
            connectionLocalToken: proxyLocalToken ? proxyLocalToken.substring(0, 8) + '...' : 'MISSING'
          });
          
          // Validate registration payload
          if (!message.payload || !message.payload.uuid || !message.payload.localToken) {
            logger.warn('❌ Invalid registration payload from proxy:', proxyUuid);
            logger.warn('❌ Payload validation details:', {
              hasPayload: !!message.payload,
              hasUuid: !!(message.payload?.uuid),
              hasLocalToken: !!(message.payload?.localToken),
              actualPayload: message.payload
            });
            ws.send(JSON.stringify({
              type: 'register_error',
              id: message.id,
              timestamp: new Date().toISOString(),
              payload: { error: 'Invalid registration payload' }
            }));
            return;
          }
          
          // Verify credentials match connection headers
          if (message.payload.uuid !== proxyUuid || message.payload.localToken !== proxyLocalToken) {
            logger.warn('❌ Proxy registration credentials mismatch:', proxyUuid);
            logger.warn('❌ Credential mismatch details:', {
              uuidMatch: message.payload.uuid === proxyUuid,
              tokenMatch: message.payload.localToken === proxyLocalToken,
              messageUuid: message.payload.uuid,
              connectionUuid: proxyUuid,
              messageToken: message.payload.localToken ? message.payload.localToken.substring(0, 8) + '...' : 'MISSING',
              connectionToken: proxyLocalToken ? proxyLocalToken.substring(0, 8) + '...' : 'MISSING'
            });
            ws.close(1008, 'Registration credentials mismatch');
            return;
          }
          
          // Store proxy credentials and capabilities
          proxyCredentials.set(proxyUuid, {
            localToken: message.payload.localToken,
            displayName: message.payload.displayName,
            localAiEndpoint: message.payload.localAiEndpoint,
            localAiModel: message.payload.localAiModel,
            capabilities: message.payload.capabilities || [],
            version: message.payload.version || '1.0.0',
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString()
          });
          
          const registrationInfo = {
            uuid: proxyUuid,
            displayName: message.payload.displayName,
            model: message.payload.localAiModel,
            capabilities: message.payload.capabilities
          };
          logger.startup(`✅ Proxy registration successful: ${JSON.stringify(registrationInfo, null, 2)}`);
          
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
          
          // Send registration confirmation
          ws.send(JSON.stringify({
            type: 'register_ack',
            id: message.id,
            timestamp: new Date().toISOString(),
            payload: {
              status: 'registered',
              serverVersion: '1.0.0',
              supportedFeatures: ['ai_request', 'heartbeat', 'error_handling']
            }
          }));
          
        } else if (message.type === 'ai_response') {
          // Development mode: Log proxy response details received from proxy
          if (process.env.NODE_ENV === 'development') {
            logger.log('🤖 LOCAL PROXY RESPONSE (WebSocket):', JSON.stringify({
              targetClientId: message.targetClientId,
              proxyUuid: message.proxyUuid,
              model: message.payload?.model,
              responseLength: message.payload?.content?.length || 0,
              isStructured: message.payload?.structured,
              fullResponse: message.payload?.content,
              fullMessage: message
            }, null, 2));
          }

          // Forward AI response back to waiting HTTP client
          const targetClientId = message.targetClientId;
          const clientResponse = activeClients.get(targetClientId);
          
          if (clientResponse) {
            logger.log('📤 Forwarding AI response to client:', targetClientId);
            
            // Return raw AI response in identical format to OpenRouter/Gemini
            // This ensures frontend receives consistent response structure regardless of provider
            clientResponse.json({ 
              text: message.payload.content  // Identical to OpenRouter format
            });
            activeClients.delete(targetClientId); // Cleanup
          } else {
            logger.warn('⚠️ No waiting client found for response:', targetClientId);
          }
        } else if (message.type === 'heartbeat') {
          // Respond to heartbeat to keep connection alive
          ws.send(JSON.stringify({ 
            type: 'heartbeat_ack', 
            timestamp: new Date().toISOString(),
            proxyId: proxyUuid
          }));
        } else if (message.type === 'error') {
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
      } catch (error) {
        logger.error('💔 WebSocket message parsing error:', error);
      }
    });
    
    // Handle proxy disconnection
    ws.on('close', (code, reason) => {
      logger.log('🔌 Local proxy disconnected:', proxyUuid, 'Code:', code, 'Reason:', reason.toString());
      handleProxyDisconnection(proxyUuid);
    });
    
    // Handle WebSocket errors
    ws.on('error', (error) => {
      logger.error('💔 WebSocket error for proxy:', proxyUuid, error);
      handleProxyError(proxyUuid, error);
    });
  });

  return wss;
}

export { createWebSocketServer };