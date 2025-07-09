# Agentic Markdown Todos - Backend Server

> **Express.js backend** providing AI API proxy and GitHub API security layer

## 🚀 **Quick Start**

```bash
cd server
npm install
node server.js
```

Server runs on `http://localhost:3001` by default.

## 🔧 **Configuration**

### **No Environment Variables Required**
As of January 2025, this server **no longer requires** environment variables or `.env` files:

- ✅ **No GEMINI_API_KEY needed**: Users provide their own API keys through the UI
- ✅ **No dotenv setup**: Simplified deployment and configuration
- ✅ **User-owned keys**: Each user manages their own API access

### **Previous Setup (Deprecated)**
```bash
# ❌ NO LONGER NEEDED
# GEMINI_API_KEY=your_api_key_here
```

## 🛡️ **Security Features**

### **GitHub API Proxy Protection**
- **Repository validation**: Only allows access to user-specified repositories
- **Endpoint filtering**: Restricts access to safe GitHub API endpoints
- **Header sanitization**: Filters and validates all request headers
- **Path validation**: Prevents access to unauthorized API paths

### **Gemini AI Proxy**
- **Per-request API keys**: Users provide keys for each request
- **No server-side storage**: API keys never stored or logged on server
- **Request isolation**: Each user's requests are completely isolated

## 📡 **API Endpoints**

### **POST /api/github**
Secure proxy for GitHub API requests.

**Request Body**:
```json
{
  "path": "/repos/owner/repo/contents/file.md",
  "method": "GET|POST|PUT|DELETE",
  "headers": { "Authorization": "token ghp_..." },
  "body": {...},
  "owner": "github-username",
  "repo": "repository-name"
}
```

**Security Restrictions**:
- Only allows `/repos/{owner}/{repo}/contents/**` paths
- Only allows `/repos/{owner}/{repo}/commits` paths
- Validates repository ownership matches request
- Filters dangerous headers and methods

### **POST /api/gemini**
Proxy for Google Gemini AI API calls.

**Request Body**:
```json
{
  "action": "generateInitialPlan|generateCommitMessage|processChatMessage",
  "payload": { "goal": "Task description" },
  "apiKey": "AIzaSy..."
}
```

**Supported Actions**:
- `generateInitialPlan`: Convert goals into markdown task lists
- `generateCommitMessage`: Create conventional commit messages
- `processChatMessage`: Process AI chat interactions

### **POST /api/git-history**
Fetch commit history for specific files.

**Request Body**:
```json
{
  "path": "todos/task.md",
  "owner": "github-username", 
  "repo": "repository-name"
}
```

### **POST /api/file-at-commit**
Get file content at specific commit SHA.

**Request Body**:
```json
{
  "path": "todos/task.md",
  "sha": "commit-sha",
  "owner": "github-username",
  "repo": "repository-name"
}
```

## 🚀 **Deployment**

### **Node.js Deployment**
```bash
# Install dependencies
npm install

# Start server
node server.js

# Or with PM2
pm2 start server.js --name "am-todos-backend"
```

### **Docker Deployment**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./
EXPOSE 3001
CMD ["node", "server.js"]
```

### **Environment Variables (Optional)**
```bash
PORT=3001  # Default port (optional)
```

## 🔍 **Development**

### **Local Testing**
```bash
# Start server with logging
node server.js

# Test GitHub proxy
curl -X POST http://localhost:3001/api/github \
  -H "Content-Type: application/json" \
  -d '{"path":"/repos/user/repo/contents/","method":"GET","owner":"user","repo":"repo"}'

# Test Gemini API
curl -X POST http://localhost:3001/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"action":"generateInitialPlan","payload":{"goal":"Test task"},"apiKey":"your-key"}'
```

### **CORS Configuration**
The server is configured to accept requests from all origins during development. For production, consider restricting CORS to your specific frontend domain.

## 🛠 **Dependencies**

```json
{
  "express": "^4.18.0",
  "cors": "^2.8.5", 
  "@google/generative-ai": "^0.2.0"
}
```

## 📝 **Changelog**

### **v2.0.0 - January 2025**
- **BREAKING**: Removed server-side API key requirement
- **NEW**: User-provided API keys for Gemini AI
- **REMOVED**: dotenv dependency
- **IMPROVED**: Enhanced security with per-request API keys

### **v1.0.0 - Initial Release**
- GitHub API proxy with security validation
- Gemini AI integration
- Git history and file version endpoints
- Server-side API key management (deprecated)

---

*Backend server for Agentic Markdown Todos - Secure, scalable, user-owned API keys* ✅