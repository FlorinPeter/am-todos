import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseRateLimitError, generateRateLimitMessage, showRateLimitNotification, RateLimitInfo } from '../rateLimitHandler';

// Mock logger
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Rate Limit Handler', () => {
  let mockLogger: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const logger = await import('../logger');
    mockLogger = logger.default;
  });

  describe('parseRateLimitError', () => {
    it('should detect 429 status code in error message', () => {
      const error = { message: 'Request failed with status 429' };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(true);
      expect(result.provider).toBe('github');
      expect(mockLogger.log).toHaveBeenCalledWith('Rate limit detected:', {
        provider: 'github',
        retryAfter: undefined,
        nextAvailableTime: undefined
      });
    });

    it('should detect "too many requests" in error message', () => {
      const error = { message: 'Too Many Requests' };
      const result = parseRateLimitError(error, 'gitlab');

      expect(result.isRateLimited).toBe(true);
      expect(result.provider).toBe('gitlab');
    });

    it('should detect "rate limit" in error message', () => {
      const error = { message: 'Rate limit exceeded' };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(true);
      expect(result.provider).toBe('github');
    });

    it('should return false for non-rate-limit errors', () => {
      const error = { message: 'Network error' };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(false);
      expect(result.provider).toBe('github');
      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should handle errors without message property', () => {
      const error = {};
      const result = parseRateLimitError(error, 'gitlab');

      expect(result.isRateLimited).toBe(false);
      expect(result.provider).toBe('gitlab');
    });

    it('should handle errors with null message', () => {
      const error = { message: null };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(false);
      expect(result.provider).toBe('github');
    });

    it('should parse "15 minutes" retry time', () => {
      const error = { message: 'Rate limit exceeded, try again in 15 minutes' };
      const beforeTime = Date.now();
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(true);
      expect(result.retryAfter).toBe('15 minutes');
      expect(result.nextAvailableTime).toBeInstanceOf(Date);
      
      const expectedTime = beforeTime + 15 * 60 * 1000;
      const actualTime = result.nextAvailableTime!.getTime();
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(1000); // Within 1 second tolerance
    });

    it('should parse "retry after" with custom time format', () => {
      const error = { message: 'Too many requests, retry after: 30 seconds' };
      const result = parseRateLimitError(error, 'gitlab');

      expect(result.isRateLimited).toBe(true);
      expect(result.retryAfter).toBe('30 seconds');
      expect(result.nextAvailableTime).toBeUndefined();
    });

    it('should parse "retry after" with different format', () => {
      const error = { message: 'Rate limited, retry after 5 minutes' };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(true);
      expect(result.retryAfter).toBe('5 minutes');
    });

    it('should handle case-insensitive matching', () => {
      const error = { message: 'RATE LIMIT EXCEEDED' };
      const result = parseRateLimitError(error, 'gitlab');

      expect(result.isRateLimited).toBe(true);
      expect(result.provider).toBe('gitlab');
    });

    it('should handle mixed case in retry after parsing', () => {
      const error = { message: 'Error 429: Retry After 10 MINUTES' };
      const result = parseRateLimitError(error, 'github');

      expect(result.isRateLimited).toBe(true);
      expect(result.retryAfter).toBe('10 minutes'); // Lowercase due to errorMessage.toLowerCase()
    });
  });

  describe('generateRateLimitMessage', () => {
    it('should generate GitHub rate limit message without retry info', () => {
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'github'
      };

      const message = generateRateLimitMessage(rateLimitInfo);

      expect(message).toContain('🚧 GitHub Rate Limit Reached');
      expect(message).toContain('GitHub API rate limit');
      expect(message).toContain('💡 Tips to avoid rate limits');
      expect(message).toContain('GitHub account');
      expect(message).not.toContain('⏰ Try again in:');
      expect(message).not.toContain('🕐 Available again at:');
    });

    it('should generate GitLab rate limit message with retry after', () => {
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'gitlab',
        retryAfter: '5 minutes'
      };

      const message = generateRateLimitMessage(rateLimitInfo);

      expect(message).toContain('🚧 GitLab Rate Limit Reached');
      expect(message).toContain('GitLab API rate limit');
      expect(message).toContain('⏰ Try again in: 5 minutes');
      expect(message).toContain('GitLab account');
    });

    it('should generate message with next available time', () => {
      const nextTime = new Date('2023-12-25T15:30:00Z');
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'github',
        nextAvailableTime: nextTime
      };

      const message = generateRateLimitMessage(rateLimitInfo);

      expect(message).toContain('🕐 Available again at:');
      expect(message).toContain(nextTime.toLocaleTimeString());
    });

    it('should generate message with both retry after and next available time', () => {
      const nextTime = new Date('2023-12-25T15:30:00Z');
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'gitlab',
        retryAfter: '15 minutes',
        nextAvailableTime: nextTime
      };

      const message = generateRateLimitMessage(rateLimitInfo);

      expect(message).toContain('🚧 GitLab Rate Limit Reached');
      expect(message).toContain('⏰ Try again in: 15 minutes');
      expect(message).toContain('🕐 Available again at:');
      expect(message).toContain(nextTime.toLocaleTimeString());
      expect(message).toContain('💡 Tips to avoid rate limits');
    });

    it('should include helpful tips in all messages', () => {
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'github'
      };

      const message = generateRateLimitMessage(rateLimitInfo);

      expect(message).toContain('Avoid refreshing the page repeatedly');
      expect(message).toContain('Close other tabs using the same');
      expect(message).toContain('Wait a few minutes before trying again');
      expect(message).toContain('The app will work normally once the rate limit resets');
    });
  });

  describe('showRateLimitNotification', () => {
    let originalWindow: any;
    let originalAlert: any;
    let mockAlert: any;

    beforeEach(() => {
      originalWindow = global.window;
      originalAlert = global.alert;
      mockAlert = vi.fn();
    });

    afterEach(() => {
      global.window = originalWindow;
      global.alert = originalAlert;
    });

    it('should log error message and call alert when window.alert exists', () => {
      // Mock window.alert to not actually show alert in tests
      global.window = { 
        alert: mockAlert,
        // Override any other alert references to prevent JSDOM errors
        ...global.window
      };
      
      // Also mock the global alert function directly
      global.alert = mockAlert;
      
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'github',
        retryAfter: '10 minutes'
      };

      showRateLimitNotification(rateLimitInfo);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Rate limit notification:',
        expect.stringContaining('🚧 GitHub Rate Limit Reached')
      );
      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining('🚧 GitHub Rate Limit Reached')
      );
    });

    it('should handle environment without window object', () => {
      global.window = undefined;
      
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'gitlab'
      };

      // Should not throw error
      expect(() => showRateLimitNotification(rateLimitInfo)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle window without alert function', () => {
      global.window = {} as any;
      
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'github'
      };

      expect(() => showRateLimitNotification(rateLimitInfo)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should call generateRateLimitMessage internally', () => {
      global.window = { 
        alert: mockAlert,
        ...global.window
      };
      global.alert = mockAlert;
      
      const rateLimitInfo: RateLimitInfo = {
        isRateLimited: true,
        provider: 'gitlab',
        retryAfter: '5 minutes',
        nextAvailableTime: new Date('2023-12-25T15:30:00Z')
      };

      showRateLimitNotification(rateLimitInfo);

      const loggedMessage = mockLogger.error.mock.calls[0][1];
      expect(loggedMessage).toContain('🚧 GitLab Rate Limit Reached');
      expect(loggedMessage).toContain('⏰ Try again in: 5 minutes');
      expect(loggedMessage).toContain('🕐 Available again at:');
    });
  });
});