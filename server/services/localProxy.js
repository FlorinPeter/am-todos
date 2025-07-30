import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import WebSocket from 'ws';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load or create persistent proxy configuration
async function loadOrCreateProxyConfig() {
  const configPath = '/config/settings.json';
  const configDir = path.dirname(configPath);
  
  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    logger.log('📁 Created config directory:', configDir);
  }
  
  // Load existing config or create new one
  let config;
  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
      logger.log('📄 Loaded existing proxy configuration from:', configPath);
    } catch (error) {
      logger.warn('⚠️ Failed to parse existing config, creating new one:', error.message);
      config = null;
    }
  }
  
  // Create new configuration if needed
  if (!config) {
    config = {
      uuid: crypto.randomUUID(),
      localToken: crypto.randomBytes(32).toString('hex'), // 256-bit cryptographically secure token
      displayName: process.env.PROXY_DISPLAY_NAME || 'Local AI Proxy',
      localAiEndpoint: process.env.LOCAL_AI_ENDPOINT || 'http://localhost:1234',
      localAiModel: process.env.LOCAL_AI_MODEL || 'mistralai/mistral-small-3.2',
      mainServerUrl: process.env.MAIN_SERVER_URL || 'ws://localhost:3001/proxy-ws',
      mainServerToken: process.env.MAIN_SERVER_TOKEN || '',
      createdAt: new Date().toISOString(),
      lastConnected: null
    };
    
    // Save configuration to file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.log('📄 Created new proxy configuration with UUID and localToken');
    logger.log('🔐 Generated credentials:', {
      uuid: config.uuid,
      localToken: config.localToken.substring(0, 8) + '...' // Only show first 8 chars for security
    });
  }
  
  // Ensure existing configurations have localToken (backward compatibility)
  if (!config.localToken) {
    config.localToken = crypto.randomBytes(32).toString('hex');
    logger.log('🔄 Added missing localToken to existing configuration');
    logger.log('🔐 Generated localToken:', config.localToken.substring(0, 8) + '...');
  }

  // Override with environment variables if provided
  if (process.env.LOCAL_AI_ENDPOINT) config.localAiEndpoint = process.env.LOCAL_AI_ENDPOINT;
  if (process.env.LOCAL_AI_MODEL) config.localAiModel = process.env.LOCAL_AI_MODEL;
  if (process.env.MAIN_SERVER_URL) config.mainServerUrl = process.env.MAIN_SERVER_URL;
  if (process.env.MAIN_SERVER_TOKEN) config.mainServerToken = process.env.MAIN_SERVER_TOKEN;
  if (process.env.PROXY_DISPLAY_NAME) config.displayName = process.env.PROXY_DISPLAY_NAME;
  
  // Update last connected timestamp
  config.lastConnected = new Date().toISOString();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  return config;
}

// Connect to main server WebSocket endpoint with enhanced error handling
async function connectToMainServer(config) {
  return new Promise((resolve, reject) => {
    logger.log('🔌 Connecting to main server:', config.mainServerUrl);
    logger.log('🔐 Authentication headers prepared for proxy:', config.uuid);
    
    // Validate configuration before attempting connection
    if (!config.mainServerToken || config.mainServerToken.length < 10) {
      return reject(new Error('Invalid or missing MAIN_SERVER_TOKEN'));
    }
    
    if (!config.uuid) {
      return reject(new Error('Invalid or missing proxy UUID'));
    }
    
    if (!config.localToken || config.localToken.length < 20) {
      return reject(new Error('Invalid or missing proxy localToken'));
    }
    
    // Create WebSocket with enhanced authentication headers
    const ws = new WebSocket(config.mainServerUrl, {
      headers: {
        'x-main-server-token': config.mainServerToken,
        'x-proxy-uuid': config.uuid,
        'x-proxy-local-token': config.localToken,
        'x-proxy-display-name': config.displayName || 'Local AI Proxy',
        'user-agent': 'AM-Todos-Local-Proxy/1.0'
      },
      // Enhanced timeout configuration
      handshakeTimeout: 15000,  // 15 seconds for initial connection
      perMessageDeflate: false,  // Disable compression for better compatibility
      followRedirects: true,     // Follow redirects if server moves
      maxRedirects: 3           // Limit redirects
    });
    
    // Connection success handler
    ws.on('open', () => {
      logger.startup('✅ Successfully connected to main server via WebSocket');
      logger.startup('📡 Connection details:');
      logger.startup(`   Proxy UUID: ${config.uuid}`);
      logger.startup(`   Local Token: ${config.localToken.substring(0, 8)}...`);
      logger.startup(`   Server URL: ${config.mainServerUrl}`);
      logger.startup(`   Ready State: ${ws.readyState} (OPEN)`);
      
      // Send registration message to main server
      const registrationMessage = {
        type: 'register',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        payload: {
          uuid: config.uuid,
          localToken: config.localToken,
          displayName: config.displayName,
          localAiEndpoint: config.localAiEndpoint,
          localAiModel: config.localAiModel,
          capabilities: ['ai_request_processing', 'heartbeat'],
          version: '1.0.0'
        }
      };
      
      logger.startup('📝 Sending registration to main server...');
      ws.send(JSON.stringify(registrationMessage));
      
      resolve(ws);
    });
    
    // Enhanced error handler with specific error types
    ws.on('error', (error) => {
      logger.error('💔 WebSocket connection error details:');
      logger.error(`   Error type: ${error.constructor.name}`);
      logger.error(`   Error message: ${error.message}`);
      logger.error(`   Error code: ${error.code || 'N/A'}`);
      logger.error(`   Target URL: ${config.mainServerUrl}`);
      
      // Provide specific error guidance
      if (error.code === 'ECONNREFUSED') {
        logger.error('🔧 Connection refused - main server may not be running');
      } else if (error.code === 'ENOTFOUND') {
        logger.error('🔧 Host not found - check MAIN_SERVER_URL');
      } else if (error.code === 'ETIMEDOUT') {
        logger.error('🔧 Connection timeout - check network connectivity');
      } else if (error.message.includes('Unexpected server response')) {
        logger.error('🔧 Server response error - check if endpoint accepts WebSocket connections');
      } else if (error.message.includes('handshake')) {
        logger.error('🔧 Handshake failed - check MAIN_SERVER_TOKEN authentication');
      }
      
      reject(error);
    });
    
    // Connection close handler for initial connection
    ws.on('close', (code, reason) => {
      if (ws.readyState !== WebSocket.OPEN) {
        // Connection was closed before it was established
        const closeReason = reason ? reason.toString() : 'Unknown reason';
        logger.error('💔 WebSocket connection closed during handshake:');
        logger.error(`   Close code: ${code}`);
        logger.error(`   Close reason: ${closeReason}`);
        
        // Interpret close codes
        if (code === 1008) {
          logger.error('🔧 Authentication failed - verify MAIN_SERVER_TOKEN');
        } else if (code === 1002) {
          logger.error('🔧 Protocol error - incompatible WebSocket versions');
        } else if (code === 1006) {
          logger.error('🔧 Abnormal closure - network or server issue');
        }
        
        reject(new Error(`WebSocket closed during connection: ${code} ${closeReason}`));
      }
    });
    
    // Add overall timeout for connection establishment
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        logger.error('💔 Connection timeout exceeded (15 seconds)');
        ws.terminate();
        reject(new Error('Connection timeout - main server did not respond within 15 seconds'));
      }
    }, 15000);
    
    // Clear timeout on successful connection
    ws.on('open', () => {
      clearTimeout(connectionTimeout);
    });
    
    // Clear timeout on error
    ws.on('error', () => {
      clearTimeout(connectionTimeout);
    });
  });
}

// Process AI request using local AI service
async function processLocalAIRequest(message, ws, config) {
  const { action, payload, targetClientId } = message;
  
  try {
    logger.log('🤖 Processing AI request locally:', action);
    
    // Detect if structured output is needed
    const structuredOutputNeeded = requiresStructuredOutput(action);
    
    // Build the request payload for local AI
    // Note: Local AI models often don't support json_schema properly, so we use simple JSON instructions
    const requestPayload = {
      model: config.localAiModel,
      messages: [
        {
          role: 'system',
          content: getSystemPromptForAction(action) + (structuredOutputNeeded ? 
            '\n\nCRITICAL: Return ONLY the raw JSON object. Do NOT wrap it in markdown code blocks (```json). Do NOT include any text, explanations, or formatting. Just the pure JSON object.' : '')
        },
        {
          role: 'user',
          content: payload.prompt || JSON.stringify(payload)
        }
      ],
      // Only include temperature and max_tokens if explicitly set (let AI service use its own defaults)
      ...(process.env.LOCAL_AI_TEMPERATURE ? { temperature: parseFloat(process.env.LOCAL_AI_TEMPERATURE) } : {}),
      ...(process.env.LOCAL_AI_MAX_TOKENS ? { max_tokens: parseInt(process.env.LOCAL_AI_MAX_TOKENS) } : {})
      // Note: Removed json_schema response_format for local AI compatibility
    };
    
    // Development mode: Enhanced local AI request logging
    if (process.env.NODE_ENV === 'development') {
      logger.log('🤖 LOCAL AI PROXY REQUEST:', JSON.stringify({
        action,
        endpoint: `${config.localAiEndpoint}/v1/chat/completions`,
        model: config.localAiModel,
        requiresStructuredOutput: structuredOutputNeeded,
        systemInstruction: getSystemPromptForAction(action),
        userPrompt: (payload.prompt || JSON.stringify(payload)),
        requestPayload
      }, null, 2));
    } else {
      logger.log('🔍 Local AI request payload:', JSON.stringify(requestPayload, null, 2));
    }
    
    // Call local AI service using OpenAI client (OpenAI-compatible endpoint)
    const openai = new OpenAI({
      apiKey: 'dummy-key', // Many local AI services don't require real keys
      baseURL: `${config.localAiEndpoint}/v1`
    });

    let aiResponse;
    try {
      aiResponse = await openai.chat.completions.create(requestPayload);
    } catch (error) {
      logger.error('❌ Local AI service error:', error.message);
      
      // Provide clear error message for structured output compatibility
      if (error.status === 400 && structuredOutputNeeded) {
        throw new Error(`Local AI model "${config.localAiModel}" does not support structured output (json_schema). Please use a compatible model like Claude, GPT-4, or other models that support JSON schema formatting.`);
      }
      
      // Handle different error scenarios with helpful messages
      if (error.status === 404) {
        throw new Error(`Local AI endpoint not found at ${config.localAiEndpoint}. Verify the endpoint URL and ensure the AI service is running.`);
      } else if (error.status === 422) {
        throw new Error(`Local AI model "${config.localAiModel}" not found. Check if the model is loaded in your AI service.`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to local AI service at ${config.localAiEndpoint}. Ensure the service is running.`);
      }
      
      throw new Error(`Local AI service error: ${error.message}`);
    }
    
    // Extract content using OpenAI client's structured response
    let rawContent = aiResponse.choices?.[0]?.message?.content;
    
    if (!rawContent) {
      logger.error('Local AI response missing content:', JSON.stringify(aiResponse, null, 2));
      throw new Error(`Local AI model "${config.localAiModel}" returned empty response content`);
    }
    
    // Validate content is a string
    if (typeof rawContent !== 'string') {
      logger.error('Local AI content is not a string:', typeof rawContent, rawContent);
      throw new Error(`Local AI model "${config.localAiModel}" returned non-string content: ${typeof rawContent}`);
    }
    
    // Clean up markdown code blocks for structured output
    if (structuredOutputNeeded) {
      rawContent = cleanupJsonFromMarkdown(rawContent);
    }
    
    // Development mode: Log local AI response details
    if (process.env.NODE_ENV === 'development') {
      logger.log('🤖 LOCAL AI PROXY RESPONSE:', JSON.stringify({
        action,
        model: config.localAiModel,
        responseLength: rawContent.length,
        fullResponse: rawContent,
        isJSON: structuredOutputNeeded,
        usage: aiResponse.usage || null,
        fullResponseData: aiResponse,
        success: true
      }, null, 2));
    }
    
    // Send raw AI response directly without any processing
    // This allows the frontend to handle JSON parsing and structured data properly
    const content = rawContent;
    const description = `Response from local AI (${config.displayName})`;
    
    logger.log('✅ Forwarding raw AI response to main server');
    
    // Log for debugging in development
    if (process.env.NODE_ENV === 'development' && structuredOutputNeeded) {
      logger.log('🔍 Raw structured response being forwarded:', rawContent.substring(0, 200) + '...');
    }
    
    logger.log('✅ Local AI processing complete, sending response to main server');
    
    // Send response back to main server
    ws.send(JSON.stringify({
      type: 'ai_response',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      targetClientId: targetClientId,
      proxyUuid: config.uuid,
      proxyLocalToken: config.localToken, // Include for additional security validation
      payload: {
        content: content,
        description: description,
        model: config.localAiModel,
        processedAt: new Date().toISOString(),
        structured: structuredOutputNeeded
      }
    }));
    
  } catch (error) {
    logger.error('❌ Local AI processing failed:', error);

    // Development mode: Enhanced local AI error logging
    if (process.env.NODE_ENV === 'development') {
      logger.log('🤖 LOCAL AI PROXY ERROR DETAILS:', JSON.stringify({
        action,
        model: config.localAiModel,
        endpoint: config.localAiEndpoint,
        requiresStructuredOutput: structuredOutputNeeded,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }, null, 2));
    }
    
    // Send error back to main server
    ws.send(JSON.stringify({
      type: 'error',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      targetClientId: targetClientId,
      proxyUuid: config.uuid,
      proxyLocalToken: config.localToken,
      payload: {
        error: error.message,
        proxyId: config.uuid
      }
    }));
  }
}

// Helper function to determine if action requires structured output
function requiresStructuredOutput(action) {
  return ['processChatMessage', 'generateCommitMessage', 'generateInitialPlan'].includes(action);
}

// Clean up markdown code blocks from JSON responses
function cleanupJsonFromMarkdown(content) {
  if (!content || typeof content !== 'string') {
    return content;
  }
  
  // Remove leading/trailing whitespace
  content = content.trim();
  
  // Remove markdown code blocks if they exist
  // Pattern: ```json\n{...}\n``` or ```\n{...}\n```
  const codeBlockPattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = content.match(codeBlockPattern);
  
  if (match) {
    // Extract the JSON content from inside the code blocks
    return match[1].trim();
  }
  
  // If no code blocks found, return as-is
  return content;
}

// JSON Schema definitions for structured outputs
function getJsonSchemaForAction(action) {
  const schemas = {
    generateInitialPlan: {
      name: "plan_generation_response",
      strict: "true",
      schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Extracted goal title"
          },
          content: {
            type: "string", 
            description: "Markdown checklist content"
          }
        },
        required: ["title", "content"]
      }
    },
    generateCommitMessage: {
      name: "commit_message_response",
      strict: "true", 
      schema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Conventional commit message"
          },
          description: {
            type: "string",
            description: "Brief description of what was generated"
          }
        },
        required: ["message", "description"]
      }
    },
    processChatMessage: {
      name: "chat_message_response",
      strict: "true",
      schema: {
        type: "object", 
        properties: {
          content: {
            type: "string",
            description: "Updated markdown content"
          },
          description: {
            type: "string",
            description: "Brief description of changes made"
          }
        },
        required: ["content", "description"]
      }
    }
  };
  
  return schemas[action] || null;
}

// Get system prompt based on AI action type
function getSystemPromptForAction(action) {
  switch (action) {
    case 'generateInitialPlan':
      return `You are an expert project manager. Your task is to create a high-level, editable markdown template for a goal. Keep it simple and user-friendly - the user should be able to easily edit and expand on it.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted goal title", "content": "markdown checklist content"}
2. Create a brief description of the goal in the content
3. Add 3-5 high-level checkboxes using - [ ] format
4. Keep each checkbox item concise and general (not overly detailed)
5. Use simple GitHub Flavored Markdown in the content
6. No additional text outside the JSON object`;
    
    case 'generateCommitMessage':
      return `You are an expert at writing conventional commit messages. Given a description of a change, return a JSON object with a conventional commit message and description of what was generated.

Rules:
1. Return ONLY a JSON object with this exact structure: {"message": "conventional commit message", "description": "brief description of what was generated"}
2. Follow conventional commit format: type(scope): description (e.g., feat: Add new feature, fix: Fix bug, docs: Update documentation)
3. Keep the message concise and descriptive
4. The description should explain what type of commit message was generated (e.g., "Generated conventional commit message for new todo creation", "Created commit message for task update")
5. No additional text outside the JSON object`;
    
    case 'processChatMessage':
      return `You are an AI assistant helping users modify their task lists. Given a user's natural language request, the current markdown content, and chat history, return a JSON object with the updated content and a description of what you changed.

Rules:
1. Return ONLY a JSON object with this exact structure: {"content": "updated markdown content", "description": "brief description of changes made"}
2. Preserve the existing structure and formatting in the content
3. Make precise changes based on the user's request
4. Handle requests like "add a step for...", "rephrase the second item...", "remove the third task...", etc.
5. Keep checkbox format intact: - [ ] for unchecked, - [x] for checked
6. Maintain proper markdown syntax
7. The description should be concise and explain what was changed (e.g., "Added authentication step to task 3", "Rephrased second item to be more formal")
8. No additional text outside the JSON object`;
    
    default:
      return 'You are a helpful AI assistant. Process the user\'s request and provide a clear, helpful response.';
  }
}

// Validate proxy configuration before starting
async function validateProxyConfig(config) {
  const errors = [];
  
  // Validate required fields
  if (!config.uuid || config.uuid.length < 10) {
    errors.push('Invalid or missing proxy UUID');
  }
  
  if (!config.mainServerUrl) {
    errors.push('Missing MAIN_SERVER_URL');
  } else {
    // Validate URL format
    try {
      const url = new URL(config.mainServerUrl);
      if (!['ws:', 'wss:'].includes(url.protocol)) {
        errors.push('MAIN_SERVER_URL must use ws:// or wss:// protocol');
      }
    } catch (urlError) {
      errors.push('Invalid MAIN_SERVER_URL format');
    }
  }
  
  if (!config.mainServerToken) {
    errors.push('Missing MAIN_SERVER_TOKEN');
  } else if (config.mainServerToken.length < 20) {
    errors.push('MAIN_SERVER_TOKEN appears too short (should be at least 20 characters)');
  }
  
  if (!config.localAiEndpoint) {
    errors.push('Missing LOCAL_AI_ENDPOINT');
  } else {
    // Validate endpoint URL format
    try {
      const url = new URL(config.localAiEndpoint);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('LOCAL_AI_ENDPOINT must use http:// or https:// protocol');
      }
    } catch (urlError) {
      errors.push('Invalid LOCAL_AI_ENDPOINT format');
    }
  }
  
  if (!config.localAiModel) {
    logger.warn('⚠️ LOCAL_AI_MODEL not specified, using default');
  }
  
  if (errors.length > 0) {
    throw new Error('Configuration validation failed:\n  - ' + errors.join('\n  - '));
  }
}

// Test local AI endpoint connectivity
async function testLocalAIConnection(config) {
  const testEndpoints = [
    `${config.localAiEndpoint}/api/generate`,  // Ollama format
    `${config.localAiEndpoint}/v1/chat/completions`,  // OpenAI format
    `${config.localAiEndpoint}/health`,  // Health check
    config.localAiEndpoint  // Base endpoint
  ];
  
  const testPayloads = [
    // Ollama format
    {
      endpoint: `${config.localAiEndpoint}/api/generate`,
      payload: {
        model: config.localAiModel,
        prompt: 'Hello',
        stream: false
      }
    },
    // OpenAI format
    {
      endpoint: `${config.localAiEndpoint}/v1/chat/completions`,
      payload: {
        model: config.localAiModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      }
    }
  ];
  
  let lastError = null;
  
  // Try different endpoint formats
  for (const test of testPayloads) {
    try {
      logger.log(`🔍 Testing AI endpoint: ${test.endpoint}`);
      
      const response = await fetch(test.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok || response.status === 422) { // 422 might be model not found but server is working
        logger.log(`✅ AI endpoint responsive: ${test.endpoint} (status: ${response.status})`);
        return; // Success - endpoint is responding
      } else {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      lastError = error;
      logger.log(`❌ AI endpoint test failed: ${test.endpoint} - ${error.message}`);
    }
  }
  
  // If all tests failed, throw the last error
  if (lastError) {
    throw new Error(`Local AI endpoint not accessible: ${lastError.message}`);
  }
}

// Start local proxy instead of main server
async function startLocalProxy() {
  logger.startup('🏠 Starting Local AI Proxy...');
  
  try {
    // Step 1: Load or create persistent configuration
    logger.startup('📁 Step 1/4: Loading proxy configuration...');
    const config = await loadOrCreateProxyConfig();
    logger.startup('✅ Configuration loaded successfully:', {
      uuid: config.uuid,
      displayName: config.displayName,
      localAiEndpoint: config.localAiEndpoint,
      mainServerUrl: config.mainServerUrl.replace(/wss?:\/\//, '').split('/')[0] + '/...' // Hide sensitive parts
    });
    
    // Step 2: Validate configuration
    logger.startup('🔍 Step 2/4: Validating configuration...');
    await validateProxyConfig(config);
    logger.startup('✅ Configuration validation passed');
    
    // Step 3: Test local AI connectivity (optional, non-blocking)
    logger.startup('🤖 Step 3/4: Testing local AI connectivity...');
    try {
      await testLocalAIConnection(config);
      logger.startup('✅ Local AI connection test passed');
    } catch (aiError) {
      logger.warn('⚠️ Local AI connection test failed (will retry when needed):', aiError.message);
    }
    
    // Step 4: Connect to main server via WebSocket
    logger.startup('🔌 Step 4/4: Connecting to main server...');
    const ws = await connectToMainServer(config);
    logger.startup('✅ Connected to main server successfully');
    
    // Enhanced message handling with error recovery
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.log('📨 Received request from main server:', message.type);
        
        if (message.type === 'register_ack') {
          logger.startup('✅ Registration acknowledged by main server');
          logger.startup('📋 Server capabilities:', message.payload?.supportedFeatures || []);
        } else if (message.type === 'register_error') {
          logger.error('❌ Registration failed:', message.payload?.error || 'Unknown error');
          logger.error('💔 Closing connection due to registration failure');
          ws.close(1008, 'Registration failed');
        } else if (message.type === 'ai_request') {
          await processLocalAIRequest(message, ws, config);
        } else if (message.type === 'heartbeat_ack') {
          logger.log('💓 Heartbeat acknowledged by main server');
        } else if (message.type === 'error') {
          logger.error('❌ Error from main server:', message.payload?.error || 'Unknown error');
        } else {
          logger.warn('❓ Unknown message type from main server:', message.type);
        }
      } catch (error) {
        logger.error('💔 Error processing message from main server:', error);
        // Send error response back to main server if possible
        try {
          if (data && typeof data.toString === 'function') {
            const rawMessage = JSON.parse(data.toString());
            if (rawMessage.targetClientId) {
              ws.send(JSON.stringify({
                type: 'error',
                targetClientId: rawMessage.targetClientId,
                payload: { error: 'Message processing failed: ' + error.message }
              }));
            }
          }
        } catch (sendError) {
          logger.error('💔 Failed to send error response:', sendError);
        }
      }
    });
    
    // Enhanced heartbeat with connection monitoring
    let consecutiveHeartbeatFailures = 0;
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          proxyUuid: config.uuid,
          proxyLocalToken: config.localToken,
          status: 'active'
        }));
        consecutiveHeartbeatFailures = 0;
      } else {
        consecutiveHeartbeatFailures++;
        logger.warn(`💔 WebSocket not open for heartbeat (failures: ${consecutiveHeartbeatFailures})`);
        if (consecutiveHeartbeatFailures >= 3) {
          logger.error('💔 Too many heartbeat failures, triggering reconnection');
          clearInterval(heartbeatInterval);
          setTimeout(() => startLocalProxy(), 5000);
        }
      }
    }, 30000); // Every 30 seconds
    
    // Enhanced disconnection handling with backoff
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    
    ws.on('close', (code, reason) => {
      logger.warn(`🔌 Disconnected from main server (code: ${code}, reason: ${reason.toString()})`);
      clearInterval(heartbeatInterval);
      
      reconnectAttempts++;
      if (reconnectAttempts <= maxReconnectAttempts) {
        const delay = Math.min(5000 * reconnectAttempts, 60000); // Exponential backoff, max 1 minute
        logger.warn(`🔄 Attempting reconnection ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms...`);
        setTimeout(() => startLocalProxy(), delay);
      } else {
        logger.error('💔 Max reconnection attempts reached. Proxy will exit.');
        process.exit(1);
      }
    });
    
    ws.on('error', (error) => {
      logger.error('💔 WebSocket connection error:', error.message);
      logger.error('💔 Error details:', {
        code: error.code,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      });
    });
    
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    
    logger.startup('✅ Local AI Proxy ready and connected to main server');
    logger.startup('📊 Proxy Status Summary:');
    logger.startup(`   Proxy ID: ${config.uuid}`);
    logger.startup(`   Local AI: ${config.localAiEndpoint}`);
    logger.startup(`   Main Server: ${config.mainServerUrl}`);
    logger.startup('   Status: ACTIVE');
    
  } catch (error) {
    logger.error('💔 Failed to start local proxy:', error);
    logger.error('💔 Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Provide helpful troubleshooting information
    logger.error('🔧 Troubleshooting suggestions:');
    logger.error('   1. Verify MAIN_SERVER_URL is reachable');
    logger.error('   2. Check MAIN_SERVER_TOKEN is correct');
    logger.error('   3. Ensure LOCAL_AI_ENDPOINT is accessible');
    logger.error('   4. Verify network connectivity and firewall settings');
    
    process.exit(1);
  }
}

export {
  loadOrCreateProxyConfig,
  connectToMainServer,
  processLocalAIRequest,
  requiresStructuredOutput,
  cleanupJsonFromMarkdown,
  getJsonSchemaForAction,
  getSystemPromptForAction,
  validateProxyConfig,
  testLocalAIConnection,
  startLocalProxy
};