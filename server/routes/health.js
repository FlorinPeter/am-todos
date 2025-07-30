import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const port = process.env.PORT || 3001;
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: port,
    nodeEnv: process.env.NODE_ENV 
  });
});

// Version info endpoint (public - used by settings page)
router.get('/api/version', (req, res) => {
  res.status(200).json({
    version: process.env.VERSION || '0.1.0',
    gitSha: process.env.GIT_SHA || 'development',
    gitTag: process.env.GIT_TAG || null,
    buildDate: process.env.BUILD_DATE || null,
    nodeEnv: process.env.NODE_ENV
  });
});

// Memory usage endpoint (protected)
router.get('/api/memory', adminAuth, (req, res) => {
  const memUsage = process.memoryUsage();
  const formatBytes = (bytes) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };
  
  res.status(200).json({
    timestamp: new Date().toISOString(),
    memory: {
      rss: formatBytes(memUsage.rss), // Resident Set Size - total memory allocated
      heapTotal: formatBytes(memUsage.heapTotal), // Total heap allocated
      heapUsed: formatBytes(memUsage.heapUsed), // Heap actually used
      external: formatBytes(memUsage.external), // External memory (C++ objects)
      arrayBuffers: formatBytes(memUsage.arrayBuffers || 0) // ArrayBuffers
    },
    raw: memUsage, // Raw bytes for calculations
    uptime: process.uptime() + ' seconds'
  });
});

export default router;