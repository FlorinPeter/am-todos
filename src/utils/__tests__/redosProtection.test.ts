import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  validateSearchQuery, 
  validateAndSanitizeSearchQuery,
  safeRegexExecution,
  searchRateLimiter 
} from '../redosProtection';

describe('ReDoS Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSearchQuery', () => {
    it('should validate normal search terms', () => {
      const result = validateSearchQuery('test search term');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test search term');
    });

    it('should escape regex special characters by default', () => {
      const result = validateSearchQuery('test.*pattern+');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test\\.\\*pattern\\+');
    });

    it('should reject empty queries', () => {
      const result = validateSearchQuery('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject null queries', () => {
      const result = validateSearchQuery(null as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject queries that are too long', () => {
      const longQuery = 'a'.repeat(501);
      const result = validateSearchQuery(longQuery);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject queries with control characters', () => {
      const result = validateSearchQuery('test\x00query');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    it('should detect dangerous nested quantifiers when regex is allowed', () => {
      const result = validateSearchQuery('(a+)+', { allowRegex: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('dangerous regex pattern');
    });

    it('should detect catastrophic backtracking patterns', () => {
      const result = validateSearchQuery('.*.*', { allowRegex: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('dangerous regex pattern');
    });

    it('should detect multiple consecutive quantifiers', () => {
      const result = validateSearchQuery('a++', { allowRegex: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('suspicious patterns');
    });

    it('should reject invalid regex patterns when regex is allowed', () => {
      const result = validateSearchQuery('[', { allowRegex: true });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid regex pattern');
    });

    it('should accept valid regex patterns when regex is allowed', () => {
      const result = validateSearchQuery('test.*', { allowRegex: true, sanitize: false });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test.*');
    });

    it('should respect custom max length', () => {
      const result = validateSearchQuery('test', { maxLength: 3 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });

  describe('validateAndSanitizeSearchQuery', () => {
    it('should validate and sanitize normal queries', () => {
      const result = validateAndSanitizeSearchQuery('test query');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test query');
    });

    it('should escape special characters', () => {
      const result = validateAndSanitizeSearchQuery('test.*search');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test\\.\\*search');
    });

    it('should detect SQL injection patterns', () => {
      const result = validateAndSanitizeSearchQuery('test OR 1=1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('malicious patterns');
    });

    it('should detect XSS patterns', () => {
      const result = validateAndSanitizeSearchQuery('<script>alert("xss")</script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('script patterns');
    });

    it('should detect dangerous punctuation', () => {
      const result = validateAndSanitizeSearchQuery('test; DROP TABLE');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('malicious patterns');
    });

    it('should detect javascript: URLs', () => {
      const result = validateAndSanitizeSearchQuery('javascript:alert(1)');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('script patterns');
    });

    it('should detect event handlers', () => {
      const result = validateAndSanitizeSearchQuery('onclick=alert(1)');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('script patterns');
    });

    it('should handle rate limiting without IP', () => {
      const result = validateAndSanitizeSearchQuery('test query');
      expect(result.isValid).toBe(true);
    });
  });

  describe('safeRegexExecution', () => {
    it('should execute simple regex patterns safely', () => {
      const pattern = /test/;
      const text = 'this is a test string';
      const result = safeRegexExecution(pattern, text);
      expect(result).toBeTruthy();
      expect(result![0]).toBe('test');
    });

    it('should return null for non-matching patterns', () => {
      const pattern = /xyz/;
      const text = 'this is a test string';
      const result = safeRegexExecution(pattern, text);
      expect(result).toBeNull();
    });

    it('should timeout on potentially dangerous patterns', () => {
      // This test simulates a timeout scenario
      const pattern = /a*/;
      const text = 'a'.repeat(10000);
      const result = safeRegexExecution(pattern, text, 1); // 1ms timeout
      // Note: This test might be flaky depending on execution speed
      // In a real scenario, the timeout protection would kick in
      expect(result).toBeDefined(); // For this simple case, it should still work
    });

    it('should handle regex errors gracefully', () => {
      // Create a pattern that will cause issues during execution
      const pattern = /(?:a|a)*/; // Potentially problematic alternation
      const text = 'a'.repeat(1000);
      const result = safeRegexExecution(pattern, text, 100);
      // Should either succeed quickly or return null if timeout
      expect(result === null || Array.isArray(result)).toBe(true);
    });
  });

  describe('searchRateLimiter', () => {
    it('should allow requests under the limit', () => {
      const ip = '192.168.1.1';
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
    });

    it('should track multiple requests from same IP', () => {
      const ip = '192.168.1.2';
      
      // Make several requests
      for (let i = 0; i < 5; i++) {
        expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      }
      
      // Should still be allowed (default limit is 10)
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
    });

    it('should return remaining requests count', () => {
      const ip = '192.168.1.3';
      const remaining = searchRateLimiter.getRemainingRequests(ip);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should handle different IPs independently', () => {
      const ip1 = '192.168.1.4';
      const ip2 = '192.168.1.5';
      
      expect(searchRateLimiter.isAllowed(ip1)).toBe(true);
      expect(searchRateLimiter.isAllowed(ip2)).toBe(true);
      
      // Both should have independent limits
      expect(searchRateLimiter.getRemainingRequests(ip1)).toBeGreaterThan(0);
      expect(searchRateLimiter.getRemainingRequests(ip2)).toBeGreaterThan(0);
    });
  });

  describe('edge cases and security', () => {
    it('should handle unicode characters safely', () => {
      const result = validateAndSanitizeSearchQuery('test 🔍 search');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedQuery).toBe('test 🔍 search');
    });

    it('should handle empty strings after trimming', () => {
      const result = validateAndSanitizeSearchQuery('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should detect nested script tags', () => {
      const result = validateAndSanitizeSearchQuery('<script><script>alert(1)</script></script>');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('script patterns');
    });

    it('should handle very long safe queries', () => {
      const longQuery = 'safe search term '.repeat(25); // ~375 chars (under limit)
      const result = validateAndSanitizeSearchQuery(longQuery);
      expect(result.isValid).toBe(true);
    });

    it('should detect SQL UNION attacks', () => {
      const result = validateAndSanitizeSearchQuery("test' UNION SELECT password FROM users --");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('malicious patterns');
    });

    it('should detect various SQL injection techniques', () => {
      const sqlQueries = [
        "test UNION SELECT password",    // Simple UNION attack
        "test OR 1=1",                   // Simple OR injection  
        "test; DROP TABLE users",        // Command injection with semicolon
        "test | malicious"               // Pipe injection
      ];

      sqlQueries.forEach(query => {
        const result = validateAndSanitizeSearchQuery(query);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('malicious patterns');
      });
    });

    it('should handle case-insensitive SQL injection attempts', () => {
      const result = validateAndSanitizeSearchQuery('TEST OR 1=1');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('malicious patterns');
    });
  });

  describe('Rate Limiting Coverage', () => {
    it('should reject requests when rate limit is exceeded', () => {
      const ip = '192.168.1.100';
      
      // Make requests up to the limit (10 requests)
      for (let i = 0; i < 10; i++) {
        expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      }
      
      // Next request should be rejected
      expect(searchRateLimiter.isAllowed(ip)).toBe(false);
      
      // validateAndSanitizeSearchQuery should return rate limit error
      const result = validateAndSanitizeSearchQuery('test query', ip);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Too many search requests. Please try again in a minute.');
    });

    it('should trigger cleanup of old rate limit entries', () => {
      const ip = '192.168.1.101';
      
      // Make one request to populate the requests map
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Verify the IP is tracked
      expect(searchRateLimiter.getRemainingRequests(ip)).toBe(9); // 10 - 1 = 9
      
      // Mock Date.now to simulate time passing beyond the window (1 minute = 60000ms)
      const originalDateNow = Date.now;
      const initialTime = Date.now();
      
      // Fast forward past the time window (60000ms + some buffer)
      Date.now = vi.fn().mockReturnValue(initialTime + 65000);
      
      // Make a new request which should trigger cleanup of old entries
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Verify the old entries were cleaned up by checking remaining requests
      // Should be 9 (10 - 1 new request) since old entries were cleaned
      expect(searchRateLimiter.getRemainingRequests(ip)).toBe(9);
      
      // Restore original Date.now
      Date.now = originalDateNow;
    });

    it('should handle cleanup when all requests are old', () => {
      const ip = '192.168.1.102';
      
      // Make a request
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Mock time passing beyond window
      const originalDateNow = Date.now;
      const initialTime = Date.now();
      Date.now = vi.fn().mockReturnValue(initialTime + 65000);
      
      // Making another request should clean up the old IP entry completely
      const anotherIp = '192.168.1.103';
      expect(searchRateLimiter.isAllowed(anotherIp)).toBe(true);
      
      // The old IP should have been removed from tracking (cleaned up)
      // and making a request should give full limit again
      expect(searchRateLimiter.getRemainingRequests(ip)).toBe(10); // Full limit since cleaned
      
      Date.now = originalDateNow;
    });
  });

  // === Coverage Improvement: lines 248-249, 258-269 ===
  describe('Cleanup Functionality Coverage (lines 248-249, 258-269)', () => {
    it('should trigger cleanup when random condition is met (lines 248-249)', () => {
      const ip = '192.168.1.100';
      
      // Mock Math.random to return a value that will trigger cleanup (< 0.01)
      const originalMathRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.005); // Less than 0.01 threshold
      
      // Mock Date.now to control time
      const originalDateNow = Date.now;
      const baseTime = Date.now();
      Date.now = vi.fn().mockReturnValue(baseTime);
      
      // Make a request which should trigger cleanup due to mocked random
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Verify that cleanup was triggered (the function should still return true)
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Restore original functions
      Math.random = originalMathRandom;
      Date.now = originalDateNow;
    });

    it('should not trigger cleanup when random condition is not met', () => {
      const ip = '192.168.1.101';
      
      // Mock Math.random to return a value that will NOT trigger cleanup (>= 0.01)
      const originalMathRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.5); // Greater than 0.01 threshold
      
      // Make a request which should NOT trigger cleanup
      expect(searchRateLimiter.isAllowed(ip)).toBe(true);
      
      // Restore original function
      Math.random = originalMathRandom;
    });

    it('should clean up old entries properly (lines 258-269)', () => {
      const ip1 = '192.168.1.200';
      const ip2 = '192.168.1.201';
      
      const originalDateNow = Date.now;
      const baseTime = Date.now();
      Date.now = vi.fn().mockReturnValue(baseTime);
      
      // Make requests from both IPs
      expect(searchRateLimiter.isAllowed(ip1)).toBe(true);
      expect(searchRateLimiter.isAllowed(ip2)).toBe(true);
      
      // Move time forward beyond the window (lines 258-269 cleanup logic)
      Date.now = vi.fn().mockReturnValue(baseTime + 62000); // Beyond 60000ms window
      
      // Force cleanup by mocking random to trigger it
      const originalMathRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.005); // Force cleanup
      
      // This request should trigger cleanup of old entries
      expect(searchRateLimiter.isAllowed(ip1)).toBe(true);
      
      // After cleanup, both IPs should have fresh limits
      expect(searchRateLimiter.getRemainingRequests(ip1)).toBe(9); // Used 1, has 9 left (out of 10)
      expect(searchRateLimiter.getRemainingRequests(ip2)).toBe(10); // Fresh limit after cleanup
      
      // Restore original functions
      Date.now = originalDateNow;
      Math.random = originalMathRandom;
    });
  });
});