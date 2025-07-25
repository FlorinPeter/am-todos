/**
 * ReDoS (Regular Expression Denial of Service) Protection Utility
 * Addresses security vulnerability: Missing ReDoS protection in search operations
 */

export interface RedosValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedQuery?: string;
}

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
 * @param query - User input search query
 * @param options - Configuration options
 * @returns Validation result with sanitized query if safe
 */
export const validateSearchQuery = (
  query: string,
  options: {
    maxLength?: number;
    allowRegex?: boolean;
    sanitize?: boolean;
  } = {}
): RedosValidationResult => {
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
  // eslint-disable-next-line no-control-regex
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
        error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  return {
    isValid: true,
    sanitizedQuery: sanitize ? query.replace(REGEX_SPECIAL_CHARS, '\\$&') : query
  };
};

/**
 * Safe regex execution with timeout protection
 * @param pattern - Regex pattern to execute
 * @param text - Text to search
 * @param timeoutMs - Maximum execution time in milliseconds
 * @returns Match result or null if timeout/error
 */
export const safeRegexExecution = (
  pattern: RegExp,
  text: string,
  timeoutMs: number = 1000
): RegExpMatchArray | null => {
  const start = Date.now();
  
  try {
    // Simple timeout protection using iteration count
    // More sophisticated implementations could use Worker threads
    let iterations = 0;
    const maxIterations = Math.min(text.length * 10, 100000);
    
    const originalExec = pattern.exec;
    pattern.exec = function(str) {
      iterations++;
      if (iterations > maxIterations || (Date.now() - start) > timeoutMs) {
        throw new Error('Regex execution timeout');
      }
      return originalExec.call(this, str);
    };
    
    const result = text.match(pattern);
    
    // Restore original exec method
    pattern.exec = originalExec;
    
    return result;
  } catch (error) {
    return null;
  }
};

/**
 * Rate limiting for search operations to prevent abuse
 */
class SearchRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a client IP can make a search request
   * @param clientIp - Client IP address
   * @returns True if request is allowed, false if rate limited
   */
  isAllowed(clientIp: string): boolean {
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
  private cleanup(): void {
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
   * @param clientIp - Client IP address
   * @returns Number of remaining requests in current window
   */
  getRemainingRequests(clientIp: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const requests = this.requests.get(clientIp) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}

// Export singleton rate limiter
export const searchRateLimiter = new SearchRateLimiter();

/**
 * Comprehensive search query sanitization and validation
 * @param query - Raw user input
 * @param clientIp - Client IP for rate limiting
 * @returns Validation result with sanitized query
 */
export const validateAndSanitizeSearchQuery = (
  query: string,
  clientIp?: string
): RedosValidationResult => {
  // Rate limiting check
  if (clientIp && !searchRateLimiter.isAllowed(clientIp)) {
    return {
      isValid: false,
      error: 'Too many search requests. Please try again in a minute.'
    };
  }

  // Basic validation and sanitization
  const trimmedQuery = query.trim();
  const validation = validateSearchQuery(trimmedQuery, {
    maxLength: MAX_QUERY_LENGTH,
    allowRegex: false, // Disable regex for user search queries
    sanitize: true
  });

  if (!validation.isValid) {
    return validation;
  }

  // Additional security checks for common attack patterns
  const sanitized = validation.sanitizedQuery!;
  
  // Check for XSS patterns first (more specific)
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(trimmedQuery)) {
      return {
        isValid: false,
        error: 'Search query contains potentially malicious script patterns'
      };
    }
  }

  // Check for SQL injection patterns (even though we're not using SQL)
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    /(\b(or|and)\s+[\d\w'"]+\s*=\s*[\d\w'"]+)/i,
    /(;|\||&|`)/  // Removed < and > to avoid conflict with XSS detection
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(trimmedQuery)) {
      return {
        isValid: false,
        error: 'Search query contains potentially malicious patterns'
      };
    }
  }

  return {
    isValid: true,
    sanitizedQuery: sanitized
  };
};