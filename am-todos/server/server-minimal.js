const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Debug logging for Cloud Run
console.log('🚀 Starting minimal server...');
console.log('📝 Environment variables:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);
console.log('🔌 Server will listen on port:', port);

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: port,
    nodeEnv: process.env.NODE_ENV 
  });
});

// Simple test endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AM-Todos Minimal Server', status: 'running', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Minimal server successfully listening at http://0.0.0.0:${port}`);
  console.log(`🌐 Health check available at http://0.0.0.0:${port}/health`);
});