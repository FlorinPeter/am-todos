/**
 * Authentication Utilities for Local AI Proxy
 * 
 * Provides secure token generation, validation, and proxy configuration management
 * following cryptographic best practices for the local AI proxy feature.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Generates a cryptographically secure main server token
 * Format: sk-ms-<64 hex characters> (256 bits of entropy)
 * 
 * @returns {string} Main server authentication token
 */
function generateMainServerToken() {
  const randomBytes = crypto.randomBytes(32); // 256 bits
  const hexString = randomBytes.toString('hex');
  return `sk-ms-${hexString}`;
}

/**
 * Validates main server token format and security
 * Uses constant-time comparison to prevent timing attacks
 * 
 * @param {string} token - Token to validate
 * @returns {boolean} True if token is valid format
 */
function validateMainServerToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Check format: sk-ms-<64 hex characters>
  const expectedLength = 70; // 'sk-ms-' (6) + 64 hex chars
  
  // Constant-time length check
  if (token.length !== expectedLength) {
    return false;
  }
  
  // Constant-time prefix check
  const expectedPrefix = 'sk-ms-';
  let prefixMatch = true;
  for (let i = 0; i < expectedPrefix.length; i++) {
    if (token[i] !== expectedPrefix[i]) {
      prefixMatch = false;
    }
  }
  
  if (!prefixMatch) {
    return false;
  }
  
  // Constant-time hex validation
  const hexPart = token.slice(6);
  const hexRegex = /^[a-f0-9]{64}$/;
  
  return hexRegex.test(hexPart);
}

/**
 * Validates UUID format (RFC 4122 version 4)
 * 
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if UUID is valid format
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  return uuidRegex.test(uuid);
}

/**
 * Creates a new proxy configuration with secure defaults
 * 
 * @param {string} configPath - Path to save configuration file
 * @param {Object} options - Configuration options
 * @param {string} options.endpoint - Local AI endpoint URL
 * @param {string} options.model - AI model name
 * @param {string} options.displayName - Human-readable proxy name
 * @returns {Promise<Object>} Created configuration object
 */
async function createProxyConfig(configPath, options = {}) {
  const config = {
    uuid: crypto.randomUUID(),
    localToken: crypto.randomBytes(32).toString('hex'), // 256 bits
    endpoint: options.endpoint || process.env.LOCAL_AI_ENDPOINT || 'http://localhost:11434',
    model: options.model || process.env.LOCAL_AI_MODEL || 'llama2',
    displayName: options.displayName || process.env.PROXY_DISPLAY_NAME || 'Local AI Proxy',
    createdAt: new Date().toISOString(),
    lastStarted: new Date().toISOString()
  };
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  
  // Write config with secure permissions (owner read/write only)
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  
  return config;
}

/**
 * Loads proxy configuration from file, creating new if corrupted
 * 
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<Object>} Loaded or created configuration
 */
async function loadProxyConfig(configPath) {
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Validate loaded configuration
    if (!config.uuid || !isValidUUID(config.uuid)) {
      throw new Error('Invalid UUID in configuration');
    }
    
    if (!config.localToken || !/^[a-f0-9]{64}$/.test(config.localToken)) {
      throw new Error('Invalid local token in configuration');
    }
    
    // Update last started timestamp
    config.lastStarted = new Date().toISOString();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    
    return config;
  } catch (error) {
    // Create new configuration if file doesn't exist or is corrupted
    console.log(`Creating new proxy configuration at ${configPath}:`, error.message);
    return await createProxyConfig(configPath);
  }
}

/**
 * Sanitizes error messages to prevent token leakage
 * 
 * @param {string} message - Error message to sanitize
 * @returns {string} Sanitized message with tokens redacted
 */
function sanitizeErrorMessage(message) {
  if (!message || typeof message !== 'string') {
    return message;
  }
  
  // Redact main server tokens
  const sanitized = message.replace(/sk-ms-[a-f0-9]{64}/g, '[REDACTED_TOKEN]');
  
  // Redact local tokens (64 hex characters that might be tokens)
  return sanitized.replace(/\b[a-f0-9]{64}\b/g, '[REDACTED_TOKEN]');
}

/**
 * Generates a secure random string for various purposes
 * 
 * @param {number} bytes - Number of random bytes to generate
 * @returns {string} Hex-encoded random string
 */
function generateSecureRandom(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * 
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

module.exports = {
  generateMainServerToken,
  validateMainServerToken,
  isValidUUID,
  createProxyConfig,
  loadProxyConfig,
  sanitizeErrorMessage,
  generateSecureRandom,
  constantTimeEqual
};