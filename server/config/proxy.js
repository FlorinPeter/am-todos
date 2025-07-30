import logger from '../logger.js';

// Local AI Proxy Mode Detection
const detectLocalProxyMode = () => {
  const envValue = process.env.LOCAL_PROXY_MODE;
  const hasLocalProxyArg = process.argv.includes('--local-proxy');
  
  // Handle various true values (case-insensitive, trimmed)
  if (envValue) {
    const normalizedValue = envValue.toString().trim().toLowerCase();
    const isTrueValue = ['true', '1', 'yes', 'on'].includes(normalizedValue);
    logger.startup('   Normalized LOCAL_PROXY_MODE value:', normalizedValue);
    logger.startup('   Is true value:', isTrueValue);
    return isTrueValue;
  }
  
  // Check command line argument
  if (hasLocalProxyArg) {
    logger.startup('   Found --local-proxy command line argument');
    return true;
  }
  
  logger.startup('   No local proxy mode detected');
  return false;
};

export { detectLocalProxyMode };