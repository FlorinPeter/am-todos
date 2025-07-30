import logger from '../logger.js';

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.ADMIN_TOKEN;
  
  // If no admin token is set in environment, disable admin endpoints
  if (!adminToken) {
    return res.status(503).json({ error: 'Admin endpoints disabled. Set ADMIN_TOKEN environment variable to enable.' });
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header. Use Bearer token.' });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (token !== adminToken) {
    logger.warn('Unauthorized admin access attempt from IP:', req.ip);
    return res.status(403).json({ error: 'Invalid admin token.' });
  }
  
  next();
};

// Main server token authentication for development vs production
const mainServerTokenAuth = process.env.NODE_ENV === 'development' ? (req, res, next) => next() : adminAuth;

export { adminAuth, mainServerTokenAuth };