import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to import the logger after setting up the environment
describe('Logger', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  beforeEach(() => {
    // Mock all console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    // Restore everything
    Object.assign(console, originalConsole);
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
    // Clear module cache to force re-import
    vi.resetModules();
  });

  it('should log messages when NODE_ENV is development', async () => {
    process.env.NODE_ENV = 'development';
    
    // Import logger after setting environment
    const { default: logger } = await import('../logger');
    
    logger.log('test message');
    logger.info('info message');
    logger.debug('debug message'); // eslint-disable-line testing-library/no-debugging-utils
    
    expect(console.log).toHaveBeenCalledWith('test message');
    expect(console.info).toHaveBeenCalledWith('info message');
    expect(console.debug).toHaveBeenCalledWith('debug message');
  });

  it('should not log development messages when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    
    // Import logger after setting environment
    const { default: logger } = await import('../logger');
    
    logger.log('test message');
    logger.info('info message');
    logger.debug('debug message'); // eslint-disable-line testing-library/no-debugging-utils
    
    expect(console.log).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('should always log errors and warnings regardless of environment', async () => {
    process.env.NODE_ENV = 'production';
    
    const { default: logger } = await import('../logger');
    
    logger.error('error message');
    logger.warn('warning message');
    
    expect(console.error).toHaveBeenCalledWith('error message');
    expect(console.warn).toHaveBeenCalledWith('warning message');
  });

  it('should handle multiple arguments', async () => {
    process.env.NODE_ENV = 'development';
    
    const { default: logger } = await import('../logger');
    
    logger.log('message', 'arg2', 'arg3');
    logger.error('error', { code: 500 });
    
    expect(console.log).toHaveBeenCalledWith('message', 'arg2', 'arg3');
    expect(console.error).toHaveBeenCalledWith('error', { code: 500 });
  });

  it('should handle edge cases', async () => {
    process.env.NODE_ENV = 'development';
    
    const { default: logger } = await import('../logger');
    
    logger.log();
    logger.log(null, undefined);
    logger.error('', 0, false);
    
    expect(console.log).toHaveBeenCalledWith();
    expect(console.log).toHaveBeenCalledWith(null, undefined);
    expect(console.error).toHaveBeenCalledWith('', 0, false);
  });
});