import logger from '../logger.js';

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
    { pattern: /^\/api\/main-server-token$/, methods: ['GET'] },
    { pattern: /^\/api\/test-local-ai$/, methods: ['POST'] },
    { pattern: /^\/api\/search$/, methods: ['POST'] },
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

// Configure security middleware
const configureSecurityMiddleware = (app) => {
  // Apply security logging (configurable for Cloud Run)
  if (process.env.DISABLE_SECURITY_LOGGING !== 'true') {
    app.use(securityLogger);
    logger.startup('📊 Security request logging enabled');
  } else {
    logger.startup('⚠️ Security logging disabled via DISABLE_SECURITY_LOGGING environment variable');
  }

  // Apply HTTP method validation (configurable for Cloud Run)
  if (process.env.DISABLE_METHOD_VALIDATION !== 'true') {
    app.use(methodValidator);
    logger.startup('🔒 HTTP method validation enabled');
  } else {
    logger.startup('⚠️ HTTP method validation disabled via DISABLE_METHOD_VALIDATION environment variable');
  }
};

export { 
  sanitizeHeader, 
  securityLogger, 
  methodValidator, 
  configureSecurityMiddleware 
};