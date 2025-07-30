import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import logger from '../logger.js';

// Express app initialization
const createApp = () => {
  const app = express();
  
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

  return app;
};

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

const configureCors = (app) => {
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
};

// Trust proxy configuration for Cloud Run
const configureTrustProxy = (app) => {
  if (process.env.NODE_ENV === 'production') {
    // Trust all proxies for Cloud Run - Cloud Run can have multiple proxy layers
    app.set('trust proxy', true);
    logger.startup('✅ Trust proxy enabled for Cloud Run');
  }
};

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

const createRateLimiters = () => {
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

  return { generalLimiter, aiLimiter };
};

const configureRateLimit = (app) => {
  const { generalLimiter, aiLimiter } = createRateLimiters();
  
  // Apply rate limiting conditionally based on environment
  if (process.env.DISABLE_RATE_LIMITING !== 'true') {
    app.use(generalLimiter);
    app.use('/api/ai', aiLimiter);
    logger.startup('🛡️ Rate limiting enabled');
  } else {
    logger.startup('⚠️ Rate limiting disabled via DISABLE_RATE_LIMITING environment variable');
  }
};

export {
  createApp,
  getAllowedOrigins,
  configureCors,
  configureTrustProxy,
  getRateLimitConfig,
  createRateLimiters,
  configureRateLimit
};