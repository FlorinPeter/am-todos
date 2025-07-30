import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { pathToFileURL } from 'url';
import logger from './logger.js';

// Import configuration
import { detectLocalProxyMode } from './config/proxy.js';
import {
  createApp,
  configureCors,
  configureTrustProxy,
  configureRateLimit
} from './config/app.js';

// Import services
import { startLocalProxy } from './services/localProxy.js';
import { getActiveProxyCount } from './services/proxyManager.js';

// Import middleware
import { configureSecurityMiddleware } from './middleware/security.js';

// Import routes
import healthRoutes from './routes/health.js';
import githubRoutes from './routes/github.js';
import gitlabRoutes from './routes/gitlab.js';
import aiRoutes from './routes/ai.js';
import searchRoutes from './routes/search.js';
import gitRoutes from './routes/git.js';
import proxyRoutes from './routes/proxy.js';

// Import WebSocket handler
import { createWebSocketServer } from './websocket/handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local Proxy Mode Detection with Enhanced Debugging
logger.startup('🔍 Environment Variable Debug:');
logger.startup('   LOCAL_PROXY_MODE raw value:', JSON.stringify(process.env.LOCAL_PROXY_MODE));
logger.startup('   LOCAL_PROXY_MODE type:', typeof process.env.LOCAL_PROXY_MODE);
logger.startup('   LOCAL_PROXY_MODE length:', process.env.LOCAL_PROXY_MODE ? process.env.LOCAL_PROXY_MODE.length : 'undefined');
logger.startup('   Command line args:', process.argv);

// Enhanced environment variable detection - handle multiple formats
const isLocalProxyMode = detectLocalProxyMode();
logger.startup('🎯 Final Local Proxy Mode Decision:', isLocalProxyMode);

// Always create app for testing, but conditionally start servers
const app = createApp();

if (isLocalProxyMode) {
  logger.startup('🏠 LOCAL PROXY MODE DETECTED - Starting as local AI proxy');
  logger.startup('📋 Local Proxy Environment Configuration:');
  logger.startup('   MAIN_SERVER_URL:', process.env.MAIN_SERVER_URL || 'NOT_SET');
  logger.startup('   MAIN_SERVER_TOKEN:', process.env.MAIN_SERVER_TOKEN ? `${process.env.MAIN_SERVER_TOKEN.substring(0, 10)}...` : 'NOT_SET');
  logger.startup('   LOCAL_AI_ENDPOINT:', process.env.LOCAL_AI_ENDPOINT || 'NOT_SET');
  logger.startup('   LOCAL_AI_MODEL:', process.env.LOCAL_AI_MODEL || 'NOT_SET');
  
  // Start local proxy instead of main server
  startLocalProxy().catch(error => {
    logger.error('💔 Failed to start local proxy:', error);
    process.exit(1);
  });
  // Don't initialize main server when in proxy mode
} else {
const port = process.env.PORT || 3001;

// Critical startup logging for Cloud Run (always visible)
logger.startup('🚀 Starting server...');
logger.startup('📝 Environment variables:');
logger.startup('   NODE_ENV:', process.env.NODE_ENV);
logger.startup('   PORT:', process.env.PORT);
logger.startup('   FRONTEND_BUILD_PATH:', process.env.FRONTEND_BUILD_PATH);
logger.startup('🔌 Server will listen on port:', port);

// Configure CORS
configureCors(app);

// Configure trust proxy for Cloud Run
configureTrustProxy(app);

// Configure rate limiting
configureRateLimit(app);

// Configure security middleware
configureSecurityMiddleware(app);

// Mount routes
app.use('/', healthRoutes);
app.use('/', githubRoutes);
app.use('/', gitlabRoutes);
app.use('/', aiRoutes);
app.use('/', searchRoutes);
app.use('/', gitRoutes);
app.use('/', proxyRoutes);

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === 'production') {
  const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
  logger.log('📁 Static files path:', buildPath);
  app.use(express.static(buildPath));
}

// Serve index.html for the root route
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    res.json({ message: 'Agentic Markdown Todos API Server - Development Mode' });
  }
});

// Handle 404 for unknown routes
app.use((req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // In production, serve index.html for client-side routing (SPA behavior)
    const buildPath = process.env.FRONTEND_BUILD_PATH || path.join(__dirname, '../build');
    res.sendFile(path.join(buildPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Route not found', path: req.path });
  }
});

// Create HTTP server from Express app (required for WebSocket integration)
const server = createServer(app);

// Create WebSocket server
const wss = createWebSocketServer(server);

// Only start the server if this file is run directly
// Use path.resolve to handle both relative and absolute paths correctly
if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Start server with WebSocket support on single port (Cloud Run compatible)
  server.listen(port, '0.0.0.0', () => {
    logger.startup(`✅ Server with WebSocket support listening on port ${port}`);
    logger.startup(`🌐 HTTP endpoints: http://0.0.0.0:${port}/api/*`);
    logger.startup(`🔌 WebSocket endpoint: ws://0.0.0.0:${port}/proxy-ws`);
    logger.startup(`🔐 WebSocket auth: ${process.env.MAIN_SERVER_TOKEN ? 'CONFIGURED' : 'NOT_CONFIGURED'}`);
    logger.startup(`📊 Active proxies: ${getActiveProxyCount()}`);
  });
}

} // End of main server mode

// Export the app for testing
export default app;