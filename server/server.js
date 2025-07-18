import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import { GoogleGenerativeAI } from '@google/generative-ai';
import GitLabService from './gitlabService.js';
import { fileURLToPath } from 'url';
import logger from './logger.js';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Critical startup logging for Cloud Run (always visible)
logger.startup('🚀 Starting server...');
logger.startup('📝 Environment variables:');
logger.startup('   NODE_ENV:', process.env.NODE_ENV);
logger.startup('   PORT:', process.env.PORT);
logger.startup('   FRONTEND_BUILD_PATH:', process.env.FRONTEND_BUILD_PATH);
logger.startup('🔌 Server will listen on port:', port);

// Security: Helmet.js security headers configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Required for React and TailwindCSS
        "https://fonts.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com"
      ],
      scriptSrc: [
        "'self'",
        process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : null // Only in development for React
      ].filter(Boolean),
      imgSrc: [
        "'self'", 
        "data:", 
        "blob:",
        "https://*.githubusercontent.com", // GitHub avatars
        "https://github.com" // GitHub content
      ],
      connectSrc: [
        "'self'",
        "https://api.github.com",
        "https://generativelanguage.googleapis.com", // Google Gemini
        "https://openrouter.ai" // OpenRouter
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
};

// Apply security headers (configurable for Cloud Run)
if (process.env.DISABLE_SECURITY_HEADERS !== 'true') {
  app.use(helmet(helmetConfig));
  logger.startup('🛡️ Security headers enabled (Helmet.js)');
} else {
  logger.startup('⚠️ Security headers disabled via DISABLE_SECURITY_HEADERS environment variable');
}

// Security: Configure CORS with environment variable driven origins for Cloud Run
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Use environment variables for Cloud Run deployment
    const corsOrigins = process.env.CORS_ORIGINS;
    if (corsOrigins) {
      // Parse comma-separated origins and regex patterns
      return corsOrigins.split(',').map(origin => {
        origin = origin.trim();
        // Support regex patterns for subdomain matching
        if (origin.startsWith('/') && origin.endsWith('/')) {
          return new RegExp(origin.slice(1, -1));
        }
        return origin;
      });
    }
    
    // Fallback production origins if CORS_ORIGINS not set
    return [
      process.env.FRONTEND_URL || 'https://am-todos.web.app',
      /^https:\/\/.*\.run\.app$/, // Cloud Run default domains
      /^https:\/\/.*\.web\.app$/, // Firebase hosting
      /^https:\/\/.*\.firebaseapp\.com$/, // Firebase hosting
      /^https:\/\/.*\.vercel\.app$/, // Vercel deployments
      /^https:\/\/.*\.netlify\.app$/ // Netlify deployments
    ];
  } else {
    // Development: Use localhost origins
    const devOrigins = process.env.DEV_CORS_ORIGINS;
    return devOrigins 
      ? devOrigins.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  }
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
  allowedHeaders: (process.env.CORS_ALLOWED_HEADERS || 'Content-Type,Authorization,Accept').split(','),
  maxAge: parseInt(process.env.CORS_MAX_AGE || '86400', 10) // 24 hours default
};

// Log CORS configuration for Cloud Run debugging
logger.startup('🌐 CORS Configuration:');
logger.startup('   Origins:', JSON.stringify(corsOptions.origin));
logger.startup('   Credentials:', corsOptions.credentials);
logger.startup('   Methods:', corsOptions.methods.join(', '));
logger.startup('   Headers:', corsOptions.allowedHeaders.join(', '));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Prevent DoS attacks via large payloads

// Trust proxy for Cloud Run (required for rate limiting and IP detection)
if (process.env.NODE_ENV === 'production') {
  // Trust all proxies for Cloud Run - Cloud Run can have multiple proxy layers
  app.set('trust proxy', true);
  logger.startup('✅ Trust proxy enabled for Cloud Run');
}

// Security: Rate limiting with Cloud Run environment variable configuration
const getRateLimitConfig = () => {
  const config = {
    // General rate limiting - more generous defaults for better UX
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), // Increased from 100 to 500
      message: {
        error: process.env.RATE_LIMIT_MESSAGE || 'Too many requests from this IP, please try again later.',
        retryAfter: process.env.RATE_LIMIT_RETRY_AFTER || '15 minutes'
      }
    },
    // AI-specific rate limiting - more generous for AI interactions
    ai: {
      windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '300000', 10), // 5 minutes default
      max: parseInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS || '50', 10), // Increased from 20 to 50
      message: {
        error: process.env.AI_RATE_LIMIT_MESSAGE || 'Too many AI requests from this IP, please try again later.',
        retryAfter: process.env.AI_RATE_LIMIT_RETRY_AFTER || '5 minutes'
      }
    }
  };
  
  // Log rate limiting configuration for Cloud Run debugging
  logger.startup('🛡️ Rate Limiting Configuration:');
  logger.startup('   General: ', config.general.max, 'requests per', config.general.windowMs / 1000 / 60, 'minutes');
  logger.startup('   AI: ', config.ai.max, 'requests per', config.ai.windowMs / 1000 / 60, 'minutes');
  
  return config;
};

const rateLimitConfig = getRateLimitConfig();

const generalLimiter = rateLimit({
  windowMs: rateLimitConfig.general.windowMs,
  max: rateLimitConfig.general.max,
  message: rateLimitConfig.general.message,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check and optionally other paths
    const skipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '/health').split(',');
    return skipPaths.some(path => req.path === path.trim());
  },
  // Add logging hook for debugging (modern approach)
  handler: (req, res, next, options) => {
    const clientIP = req.ip;
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    
    // Log IP information when rate limit is hit
    if (process.env.NODE_ENV === 'production') {
      logger.info(`Rate limit reached - IP: ${clientIP}, X-Forwarded-For: ${xForwardedFor}, X-Real-IP: ${xRealIP}`);
    }
    
    // Send the rate limit response
    res.status(options.statusCode).json(options.message);
  }
});

const aiLimiter = rateLimit({
  windowMs: rateLimitConfig.ai.windowMs,
  max: rateLimitConfig.ai.max,
  message: rateLimitConfig.ai.message,
  standardHeaders: true,
  legacyHeaders: false,
  // Add logging hook for debugging (modern approach)
  handler: (req, res, next, options) => {
    const clientIP = req.ip;
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    
    // Log IP information when AI rate limit is hit
    if (process.env.NODE_ENV === 'production') {
      logger.info(`AI rate limit reached - IP: ${clientIP}, X-Forwarded-For: ${xForwardedFor}, X-Real-IP: ${xRealIP}`);
    }
    
    // Send the rate limit response
    res.status(options.statusCode).json(options.message);
  }
});

// Apply rate limiting (can be disabled in Cloud Run with DISABLE_RATE_LIMITING=true)
if (process.env.DISABLE_RATE_LIMITING !== 'true') {
  app.use(generalLimiter);
  app.use('/api/ai', aiLimiter);
  logger.startup('✅ Rate limiting enabled');
} else {
  logger.startup('⚠️ Rate limiting disabled via DISABLE_RATE_LIMITING environment variable');
}

// Security: Simple admin authentication middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  // If no admin token is set in environment, disable admin endpoints
  if (!adminToken) {
    return res.status(503).json({ error: 'Admin endpoints disabled. Set ADMIN_TOKEN environment variable to enable.' });
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header. Use Bearer token.' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (token !== adminToken) {
    logger.warn('Unauthorized admin access attempt from IP:', req.ip);
    return res.status(403).json({ error: 'Invalid admin token.' });
  }
  
  next();
};

// Security: Header sanitization function to prevent HTTP header injection
const sanitizeHeader = (value) => {
  if (typeof value !== 'string') {
    return String(value);
  }
  
  // Remove CRLF characters that could be used for HTTP response splitting
  return value.replace(/[\r\n\x00]/g, '').trim();
};

// Security: Request logging and monitoring middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  const method = req.method;
  const url = req.originalUrl || req.url;
  const referer = req.get('Referer') || 'none';
  
  // Log security-relevant requests
  const isSecurityRelevant = 
    url.startsWith('/api/') || 
    method !== 'GET' ||
    url.includes('admin') ||
    url.includes('..') ||
    req.headers.authorization;
  
  if (isSecurityRelevant || process.env.LOG_ALL_REQUESTS === 'true') {
    logger.log(`🔍 ${method} ${url} from ${clientIP} | UA: ${userAgent.substring(0, 100)} | Ref: ${referer}`);
  }
  
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\./,                    // Path traversal
    /<script/i,                // XSS attempts
    /union\s+select/i,         // SQL injection
    /javascript:/i,            // XSS
    /data:text\/html/i,        // Data URI XSS
    /eval\(/i,                 // Code injection
    /base64/i,                 // Potential encoding attacks
    /\${.*}/,                  // Template injection
    /\[object\s+Object\]/i     // Object injection
  ];
  
  const requestData = `${url} ${JSON.stringify(req.body || {})}`;
  const foundSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));
  
  if (foundSuspicious) {
    logger.warn(`🚨 SUSPICIOUS REQUEST detected from ${clientIP}: ${method} ${url}`);
    logger.warn(`🚨 Patterns found in: ${requestData.substring(0, 200)}`);
  }
  
  // Track response details
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const size = data ? data.length : 0;
    
    // Log slow requests (potential DoS)
    if (duration > 5000) {
      logger.warn(`⏱️ SLOW REQUEST: ${method} ${url} took ${duration}ms from ${clientIP}`);
    }
    
    // Log failed authentication attempts
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn(`🔒 AUTH FAILURE: ${res.statusCode} for ${method} ${url} from ${clientIP}`);
    }
    
    // Log rate limit hits
    if (res.statusCode === 429) {
      logger.warn(`🚫 RATE LIMIT: ${method} ${url} from ${clientIP}`);
    }
    
    // Log errors for monitoring
    if (res.statusCode >= 500) {
      logger.error(`❌ SERVER ERROR: ${res.statusCode} for ${method} ${url} from ${clientIP} (${duration}ms)`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Apply security logging (configurable for Cloud Run)
if (process.env.DISABLE_SECURITY_LOGGING !== 'true') {
  app.use(securityLogger);
  logger.startup('📊 Security request logging enabled');
} else {
  logger.startup('⚠️ Security logging disabled via DISABLE_SECURITY_LOGGING environment variable');
}

// Security: HTTP method validation middleware
const methodValidator = (req, res, next) => {
  const method = req.method;
  const path = req.path;
  
  // Define allowed methods for different endpoint patterns
  const methodRules = [
    { pattern: /^\/health$/, methods: ['GET'] },
    { pattern: /^\/api\/version$/, methods: ['GET'] },
    { pattern: /^\/api\/memory$/, methods: ['GET'] },
    { pattern: /^\/api\/github$/, methods: ['POST'] },
    { pattern: /^\/api\/gitlab$/, methods: ['POST'] },
    { pattern: /^\/api\/ai$/, methods: ['POST'] },
    { pattern: /^\/api\/git-history$/, methods: ['POST'] },
    { pattern: /^\/api\/file-at-commit$/, methods: ['POST'] },
    { pattern: /^\/$/, methods: ['GET'] },
    { pattern: /^\/static\//, methods: ['GET'] }, // Static files
    { pattern: /\./, methods: ['GET'] } // Files with extensions (CSS, JS, etc.)
  ];
  
  // Check if method is allowed for this path
  const rule = methodRules.find(rule => rule.pattern.test(path));
  if (rule && !rule.methods.includes(method)) {
    logger.warn(`🚫 METHOD NOT ALLOWED: ${method} ${path} from ${req.ip}`);
    return res.status(405).json({ 
      error: 'Method Not Allowed',
      allowed: rule.methods 
    });
  }
  
  // Block dangerous methods entirely
  const dangerousMethods = ['TRACE', 'TRACK', 'DEBUG'];
  if (dangerousMethods.includes(method)) {
    logger.warn(`🚨 DANGEROUS METHOD BLOCKED: ${method} ${path} from ${req.ip}`);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  next();
};

// Apply HTTP method validation (configurable for Cloud Run)
if (process.env.DISABLE_METHOD_VALIDATION !== 'true') {
  app.use(methodValidator);
  logger.startup('🔒 HTTP method validation enabled');
} else {
  logger.startup('⚠️ HTTP method validation disabled via DISABLE_METHOD_VALIDATION environment variable');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: port,
    nodeEnv: process.env.NODE_ENV 
  });
});

// Version info endpoint (public - used by settings page)
app.get('/api/version', (req, res) => {
  res.status(200).json({
    version: process.env.VERSION || '0.1.0',
    gitSha: process.env.GIT_SHA || 'development',
    gitTag: process.env.GIT_TAG || null,
    buildDate: process.env.BUILD_DATE || null,
    nodeEnv: process.env.NODE_ENV
  });
});

// Memory usage endpoint (protected)
app.get('/api/memory', adminAuth, (req, res) => {
  const memUsage = process.memoryUsage();
  const formatBytes = (bytes) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };
  
  res.status(200).json({
    timestamp: new Date().toISOString(),
    memory: {
      rss: formatBytes(memUsage.rss), // Resident Set Size - total memory allocated
      heapTotal: formatBytes(memUsage.heapTotal), // Total heap allocated
      heapUsed: formatBytes(memUsage.heapUsed), // Heap actually used
      external: formatBytes(memUsage.external), // External memory (C++ objects)
      arrayBuffers: formatBytes(memUsage.arrayBuffers || 0) // ArrayBuffers
    },
    raw: memUsage, // Raw bytes for calculations
    uptime: process.uptime() + ' seconds'
  });
});

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
  logger.log('📁 Static files path:', buildPath);
  app.use(express.static(buildPath));
}

// GitHub API proxy endpoint with security validation
app.post('/api/github', async (req, res) => {
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

// GitLab API proxy endpoint with security validation
app.post('/api/gitlab', async (req, res) => {
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
        if (!params.filePath) {
          return res.status(400).json({ error: 'Missing filePath for getFileHistory action' });
        }
        result = await gitlab.getFileHistory(params.filePath, branch);
        break;

      case 'getFileAtCommit':
        if (!params.filePath || !params.sha) {
          return res.status(400).json({ error: 'Missing required fields for getFileAtCommit: filePath, sha' });
        }
        result = await gitlab.getFileAtCommit(params.filePath, params.sha);
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

  // Validate API key format based on provider
  if (provider === 'gemini') {
    // Google Gemini API keys start with 'AIza' and contain only valid characters
    if (!apiKey.startsWith('AIza') || !/^AIza[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return res.status(400).json({ error: 'Invalid Google Gemini API key format. Key should start with "AIza".' });
    }
  } else if (provider === 'openrouter') {
    // OpenRouter API keys start with 'sk-or-v1-' and are longer
    if (!apiKey.startsWith('sk-or-v1-') || apiKey.length < 20 || !/^sk-or-v1-[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return res.status(400).json({ error: 'Invalid OpenRouter API key format. Key should start with "sk-or-v1-".' });
    }
  } else {
    return res.status(400).json({ error: 'Unsupported AI provider. Supported providers: gemini, openrouter' });
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
        // Log full error for debugging but sanitize before sending to client
        logger.error('OpenRouter API error:', openRouterResponse.status, openRouterResponse.statusText);
        
        // Return sanitized error messages to client based on status code
        if (openRouterResponse.status === 401) {
          throw new Error('OpenRouter API key is invalid or not authorized. Please check your API key in settings.');
        } else if (openRouterResponse.status === 429) {
          throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
        } else if (openRouterResponse.status === 400) {
          throw new Error('Invalid request to OpenRouter API. Please check your model selection and try again.');
        } else if (openRouterResponse.status >= 500) {
          throw new Error('OpenRouter API service temporarily unavailable. Please try again later.');
        } else {
          throw new Error(`OpenRouter API error: ${openRouterResponse.statusText}`);
        }
      }

      const openRouterData = await openRouterResponse.json();
      const text = openRouterData.choices[0].message.content;
      res.json({ text });
    } else {
      return res.status(400).json({ error: 'Unsupported AI provider' });
    }
  } catch (error) {
    logger.error(`Error calling ${provider} API:`, error);
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
app.post('/api/file-at-commit', async (req, res) => {
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

// Export the app for testing
export default app;

// Only start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(port, '0.0.0.0', () => {
    logger.startup(`✅ Server successfully listening at http://0.0.0.0:${port}`);
    logger.startup(`🌐 Health check available at http://0.0.0.0:${port}/health`);
  });
}
