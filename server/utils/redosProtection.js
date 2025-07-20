/**
 * ReDoS (Regular Expression Denial of Service) Protection Utility for Node.js Backend
 * Addresses security vulnerability: Missing ReDoS protection in search operations
 */

/**
 * Dangerous regex patterns that can cause ReDoS attacks
 * These patterns involve nested quantifiers and alternation that can cause exponential backtracking
 */
const DANGEROUS_PATTERNS = [
  // Nested quantifiers - e.g., (a+)+ or (a*)*
  /(\([^)]*[+*?].*\)[+*?])|(\([^)]*[+*?].*\){.*[+*?])/,
  
  // Alternation with overlapping patterns - e.g., (a|a)*
  /\([^)]*\|[^)]*\)[+*?]/,
  
  // Repeated groups with quantifiers - e.g., (a+)+
  /\([^)]*[+*?][^)]*\)[+*?]/,
  
  // Catastrophic backtracking patterns - e.g., .*.*
  /\.\*\.\*/,
  
  // Multiple nested alternations - e.g., ((a|b)*)*
  /\(\([^)]*\|[^)]*\)[+*?]\)[+*?]/,
  
  // Deeply nested groups with quantifiers
  /(\([^)]*\([^)]*\)[^)]*\)[+*?])|(\([^)]*[+*?][^)]*\([^)]*\)[^)]*\)[+*?])/
];

/**
 * Suspicious characters and sequences that often appear in ReDoS attacks
 */
const SUSPICIOUS_SEQUENCES = [
  // Multiple consecutive quantifiers
  /[+*?]{2,}/,
  
  // Very long repeated patterns that could cause performance issues
  /.{100,}/,
  
  // Unicode category exploits
  /\\[pP]\{[^}]{20,}\}/,
  
  // Excessive character classes
  /\[[^\]]{50,}\]/
];

/**
 * Maximum allowed length for search queries to prevent resource exhaustion
 */
const MAX_QUERY_LENGTH = 500;

/**
 * Maximum execution time for regex validation (in milliseconds)
 */
const MAX_VALIDATION_TIME = 100;

/**
 * Characters that need to be escaped in user input to prevent regex injection
 */
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * Validates a search query against ReDoS attack patterns
 * @param {string} query - User input search query
 * @param {object} options - Configuration options
 * @returns {object} Validation result with sanitized query if safe
 */
function validateSearchQuery(query, options = {}) {
  const {
    maxLength = MAX_QUERY_LENGTH,
    allowRegex = false,
    sanitize = true
  } = options;

  // Basic length validation
  if (!query || typeof query !== 'string') {
    return {
      isValid: false,
      error: 'Search query must be a non-empty string'
    };
  }

  if (query.length > maxLength) {
    return {
      isValid: false,
      error: `Search query too long. Maximum length is ${maxLength} characters.`
    };
  }

  // Check for null bytes and control characters
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(query)) {
    return {
      isValid: false,
      error: 'Search query contains invalid control characters'
    };
  }

  // If regex is not allowed, escape special characters
  if (!allowRegex && sanitize) {
    const sanitizedQuery = query.replace(REGEX_SPECIAL_CHARS, '\\$&');
    return {
      isValid: true,
      sanitizedQuery
    };
  }

  // If regex is allowed, validate against dangerous patterns
  if (allowRegex) {
    // Check for dangerous ReDoS patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(query)) {
        return {
          isValid: false,
          error: 'Search query contains potentially dangerous regex pattern that could cause performance issues'
        };
      }
    }

    // Check for suspicious sequences
    for (const pattern of SUSPICIOUS_SEQUENCES) {
      if (pattern.test(query)) {
        return {
          isValid: false,
          error: 'Search query contains suspicious patterns that could impact performance'
        };
      }
    }

    // Test regex compilation with timeout
    try {
      const start = Date.now();
      new RegExp(query);
      const duration = Date.now() - start;
      
      if (duration > MAX_VALIDATION_TIME) {
        return {
          isValid: false,
          error: 'Search query regex took too long to compile'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid regex pattern: ${error.message}`
      };
    }
  }

  return {
    isValid: true,
    sanitizedQuery: sanitize ? query.replace(REGEX_SPECIAL_CHARS, '\\$&') : query
  };
}

/**
 * Rate limiting for search operations to prevent abuse
 */
class SearchRateLimiter {
  constructor(maxRequests = 20, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  /**
   * Check if a client IP can make a search request
   * @param {string} clientIp - Client IP address
   * @returns {boolean} True if request is allowed, false if rate limited
   */
  isAllowed(clientIp) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this IP
    const requests = this.requests.get(clientIp) || [];
    
    // Filter out old requests
    const recentRequests = requests.filter(time => time > windowStart);
    
    // Check if under limit
    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(clientIp, recentRequests);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      this.cleanup();
    }

    return true;
  }

  /**
   * Clean up old rate limit entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [ip, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => time > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, recentRequests);
      }
    }
  }

  /**
   * Get remaining requests for an IP
   * @param {string} clientIp - Client IP address
   * @returns {number} Number of remaining requests in current window
   */
  getRemainingRequests(clientIp) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.requests.get(clientIp) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// Create singleton rate limiter with more generous backend limits
const searchRateLimiter = new SearchRateLimiter(20, 60000);

/**
 * Comprehensive search query sanitization and validation for backend
 * @param {string} query - Raw user input
 * @param {string} clientIp - Client IP for rate limiting
 * @returns {object} Validation result with sanitized query
 */
function validateAndSanitizeSearchQuery(query, clientIp) {
  // Rate limiting check
  if (clientIp && !searchRateLimiter.isAllowed(clientIp)) {
    return {
      isValid: false,
      error: 'Too many search requests. Please try again in a minute.',
      remainingRequests: searchRateLimiter.getRemainingRequests(clientIp)
    };
  }

  // Basic validation and sanitization
  const validation = validateSearchQuery(query, {
    maxLength: MAX_QUERY_LENGTH,
    allowRegex: false, // Disable regex for user search queries
    sanitize: true
  });

  if (!validation.isValid) {
    return validation;
  }

  // Additional security checks for common attack patterns
  const sanitized = validation.sanitizedQuery;
  
  // Check for SQL injection patterns (even though we're not using SQL)
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(\b(or|and)\s+[\d\w'"]+\s*=\s*[\d\w'"]+)/i,
    /(;|\||&|`|<|>)/
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        error: 'Search query contains potentially malicious patterns'
      };
    }
  }

  // Check for XSS patterns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        error: 'Search query contains potentially malicious script patterns'
      };
    }
  }

  return {
    isValid: true,
    sanitizedQuery: sanitized,
    remainingRequests: clientIp ? searchRateLimiter.getRemainingRequests(clientIp) : null
  };
}

export {
  validateSearchQuery,
  validateAndSanitizeSearchQuery,
  searchRateLimiter,
  DANGEROUS_PATTERNS,
  SUSPICIOUS_SEQUENCES,
  MAX_QUERY_LENGTH
};