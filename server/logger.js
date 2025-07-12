/**
 * Custom logger that only outputs in development mode
 * Automatically disabled in production builds
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
  warn: (...args) => {
    // Always log warnings, even in production  
    console.warn(...args);
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
    console.log(...args);
  }
};

export default logger;