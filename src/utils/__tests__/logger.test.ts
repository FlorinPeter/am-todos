import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import logger from '../logger';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
const mockConsoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset NODE_ENV
    delete (process.env as any).NODE_ENV;
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'development';
    });

    test('logs debug messages in development', () => {
      logger.debug('Debug message', { data: 'test' });
      
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        'Debug message',
        { data: 'test' }
      );
    });

    test('logs info messages in development', () => {
      logger.info('Info message', { data: 'test' });
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Info message',
        { data: 'test' }
      );
    });

    test('logs warn messages in development', () => {
      logger.warn('Warning message', { data: 'test' });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning message',
        { data: 'test' }
      );
    });

    test('logs error messages in development', () => {
      logger.error('Error message', { error: new Error('test') });
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error message',
        { error: new Error('test') }
      );
    });

    test('logs using log method in development', () => {
      logger.log('Log message', { data: 'test' });
      
      expect(mockConsoleLog).toHaveBeenCalledWith(
        'Log message',
        { data: 'test' }
      );
    });

    test('handles multiple arguments in development', () => {
      logger.info('Message', 'arg1', 'arg2', { data: 'test' });
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Message',
        'arg1',
        'arg2',
        { data: 'test' }
      );
    });

    test('handles no additional arguments in development', () => {
      logger.error('Simple error');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Simple error'
      );
    });
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'production';
    });

    test('does not log debug messages in production', () => {
      logger.debug('Debug message', { data: 'test' });
      
      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    test('does not log info messages in production', () => {
      logger.info('Info message', { data: 'test' });
      
      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    test('does not log via log method in production', () => {
      logger.log('Log message', { data: 'test' });
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    test('logs warn messages in production', () => {
      logger.warn('Warning message', { data: 'test' });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning message',
        { data: 'test' }
      );
    });

    test('logs error messages in production', () => {
      logger.error('Error message', { error: new Error('test') });
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error message',
        { error: new Error('test') }
      );
    });

    test('handles Error objects in production', () => {
      const error = new Error('Test error');
      logger.error('Failed operation', error);
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Failed operation',
        error
      );
    });
  });

  describe('Test Environment', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'test';
    });

    test('does not log debug messages in test environment', () => {
      logger.debug('Debug message');
      
      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    test('does not log info messages in test environment', () => {
      logger.info('Info message');
      
      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    test('does not log via log method in test environment', () => {
      logger.log('Log message');
      
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    test('logs warn messages in test environment', () => {
      logger.warn('Warning message');
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Warning message'
      );
    });

    test('logs error messages in test environment', () => {
      logger.error('Error message');
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Error message'
      );
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'development';
    });

    test('handles undefined/null values', () => {
      logger.info('Message with null', null, undefined);
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Message with null',
        null,
        undefined
      );
    });

    test('handles circular references in objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      logger.debug('Circular object', circularObj);
      
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        'Circular object',
        circularObj
      );
    });

    test('handles very long strings', () => {
      const longString = 'a'.repeat(10000);
      logger.info('Long string test', longString);
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        'Long string test',
        longString
      );
    });

    test('handles mixed argument types', () => {
      logger.warn(
        'Mixed args',
        42,
        true,
        ['array', 'items'],
        { object: 'value' },
        new Date('2024-01-01')
      );
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Mixed args',
        42,
        true,
        ['array', 'items'],
        { object: 'value' },
        new Date('2024-01-01')
      );
    });

    test('handles empty message', () => {
      logger.error('');
      
      expect(mockConsoleError).toHaveBeenCalledWith('');
    });

    test('handles numeric message', () => {
      logger.info(42 as any);
      
      expect(mockConsoleInfo).toHaveBeenCalledWith(42);
    });

    test('handles boolean message', () => {
      logger.log(true as any);
      
      expect(mockConsoleLog).toHaveBeenCalledWith(true);
    });
  });

  describe('Integration with Real Errors', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'development';
    });

    test('logs network errors', () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      
      logger.error('API call failed', { 
        error: networkError,
        url: 'https://api.example.com',
        status: 500
      });
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'API call failed',
        { 
          error: networkError,
          url: 'https://api.example.com',
          status: 500
        }
      );
    });

    test('logs validation errors', () => {
      const validationErrors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' }
      ];
      
      logger.warn('Validation failed', { errors: validationErrors });
      
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        'Validation failed',
        { errors: validationErrors }
      );
    });

    test('logs performance metrics', () => {
      const metrics = {
        operation: 'fetchTodos',
        duration: 1250,
        count: 15,
        timestamp: Date.now()
      };
      
      logger.debug('Performance metrics', metrics);
      
      expect(mockConsoleDebug).toHaveBeenCalledWith(
        'Performance metrics',
        metrics
      );
    });
  });

  describe('Environment Detection', () => {
    test('handles undefined NODE_ENV as development', () => {
      delete (process.env as any).NODE_ENV;
      
      logger.debug('Debug message');
      
      // Should not log since NODE_ENV is undefined (not 'development')
      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });

    test('handles empty NODE_ENV', () => {
      (process.env as any).NODE_ENV = '';
      
      logger.info('Info message');
      
      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    test('handles case-sensitive NODE_ENV', () => {
      (process.env as any).NODE_ENV = 'DEVELOPMENT';
      
      logger.debug('Debug message');
      
      expect(mockConsoleDebug).not.toHaveBeenCalled();
    });
  });
});