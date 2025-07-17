/**
 * Custom logger that only outputs in development mode
 * Automatically disabled in production builds
 * Includes security measures to prevent API key leaks
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sanitize error objects to remove sensitive information
 * @param {Error|string|any} error - The error to sanitize
 * @returns {string} - Safe error message for logging
 */
function sanitizeError(error) {
  if (typeof error === 'string') {
    return sanitizeString(error);
  }
  
  if (error && typeof error === 'object') {
    // For Error objects, create a safe representation
    const safeError = {
      name: error.name || 'Error',
      message: sanitizeString(error.message || 'Unknown error'),
      stack: isDevelopment ? sanitizeString(error.stack || '') : '[stack trace hidden in production]'
    };
    
    // Remove any potentially sensitive properties
    return JSON.stringify(safeError, null, 2);
  }
  
  return 'Error object could not be processed safely';
}

/**
 * Sanitize strings to remove sensitive patterns
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return String(str);
  }
  
  return str
    // Remove API keys patterns
    .replace(/AIza[a-zA-Z0-9_-]{35}/g, '[GOOGLE_API_KEY_REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{48}/g, '[OPENAI_API_KEY_REDACTED]')
    .replace(/glpat-[a-zA-Z0-9_-]{20}/g, '[GITLAB_TOKEN_REDACTED]')
    .replace(/ghp_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN_REDACTED]')
    .replace(/ghs_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN_REDACTED]')
    // Remove Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9_-]{20,}/g, 'Bearer [TOKEN_REDACTED]')
    // Remove Authorization headers
    .replace(/Authorization:\s*[^,\s]+/g, 'Authorization: [REDACTED]')
    // Remove token= patterns
    .replace(/token=([^&\s]+)/g, 'token=[REDACTED]')
    // Remove any remaining suspicious patterns
    .replace(/[a-zA-Z0-9]{32,}/g, (match) => {
      // If it looks like a long random string, redact it
      if (match.length > 31 && /^[a-zA-Z0-9_-]+$/.test(match)) {
        return '[POTENTIAL_TOKEN_REDACTED]';
      }
      return match;
    });
}

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors, even in production, but sanitize them
    const sanitizedArgs = args.map(arg => {
      if (arg instanceof Error || (arg && typeof arg === 'object' && arg.message)) {
        return sanitizeError(arg);
      }
      return sanitizeString(String(arg));
    });
    console.error(...sanitizedArgs);
  },
  warn: (...args) => {
    // Always log warnings, even in production, but sanitize them
    const sanitizedArgs = args.map(arg => sanitizeString(String(arg)));
    console.warn(...sanitizedArgs);
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  // Special method for critical startup logs that should show in production
  startup: (...args) => {
    const sanitizedArgs = args.map(arg => sanitizeString(String(arg)));
    console.log(...sanitizedArgs);
  }
};

export default logger;