# 📋 Agentic Markdown Todos

[![CI](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml/badge.svg)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FlorinPeter/am-todos/badges/test-badge.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FlorinPeter/am-todos/badges/coverage-badge.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
[![Docker Build](https://github.com/FlorinPeter/am-todos/actions/workflows/docker-build.yml/badge.svg)](https://github.com/FlorinPeter/am-todos/actions/workflows/docker-build.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Version](https://img.shields.io/github/package-json/v/FlorinPeter/am-todos)](https://github.com/FlorinPeter/am-todos)
[![React](https://img.shields.io/github/package-json/dependency-version/FlorinPeter/am-todos/react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/FlorinPeter/am-todos/typescript)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)

> **Transform your GitHub repository into an intelligent task management system**

An AI-powered todo application that merges the simplicity of plain text markdown files with modern AI capabilities. Your tasks live as `.md` files in your GitHub repository, ensuring **you own your data** while leveraging AI for smart task planning and management.

## ✨ Key Features

- **🤖 AI-Powered Task Generation**: Transform high-level goals into detailed actionable checklists
- **📝 Git-Native Storage**: Tasks stored as markdown files in your GitHub/GitLab repository with full version control
- **📁 Multi-Folder Support**: Organize tasks in different folders for multiple projects
- **💬 AI Chat Assistant**: Natural language commands to modify and enhance your tasks
- **📱 Mobile-First Design**: Responsive interface with hamburger menu and touch-friendly controls
- **⚡ Real-Time Sync**: Instant Git synchronization with progress tracking
- **🎯 Smart Priority System**: P1-P5 color-coded priority management
- **📦 Archive System**: Hide completed tasks without losing data

> **📋 Complete Feature List**: See [FEATURES.md](FEATURES.md) for detailed implementation evidence  
> **🏗 Architecture Details**: See [CONCEPT.md](CONCEPT.md) for design principles and vision

## 🚀 Quick Start

### ☁️ Deploy to Google Cloud Run (Recommended)

Deploy to Google Cloud Run for a production-ready, scalable solution:

```bash
# Prerequisites: Install Docker and gcloud CLI
sudo ./hack/install-dependencies.sh

# Authenticate and set project
gcloud auth login
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Deploy latest version
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:latest"
./hack/deploy-all.sh
```

### 🐳 Deploy with Docker (Local)

For local development or testing:

```bash
# Run the latest version
docker run -p 3001:3001 ghcr.io/florinpeter/am-todos:latest

# Or run a specific version
docker run -p 3001:3001 ghcr.io/florinpeter/am-todos:latest

# Using docker-compose
curl -O https://raw.githubusercontent.com/FlorinPeter/am-todos/main/docker-compose.yml
docker-compose up -d
```

**Access the app at:** http://localhost:3001

### 📦 Available Container Images

- **Latest stable**: `ghcr.io/florinpeter/am-todos:latest`
- **Platform support**: linux/amd64, linux/arm64
- **Registry**: [GitHub Container Registry](https://github.com/FlorinPeter/am-todos/pkgs/container/am-todos)

### 💻 Development Setup

For local development and customization:

#### Prerequisites
- Node.js 16+ 
- GitHub Personal Access Token (fine-grained, repository-specific)
- AI API Key (Google Gemini or OpenRouter)

#### Installation

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd todo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

3. **Configure AI Provider:**
   
   The application supports multiple AI providers. Choose one:
   
   **Option A: Google Gemini (Default)**
   ```bash
   # Get API key from: https://makersuite.google.com/app/apikey
   # Configure in the web UI settings
   ```
   
   **Option B: OpenRouter (400+ Models)**
   ```bash
   # Get API key from: https://openrouter.ai/keys
   # Configure in the web UI settings
   # Supports models like: anthropic/claude-3.5-sonnet, openai/gpt-4o, etc.
   ```

4. **Start the application:**
   ```bash
   # Terminal 1: Start backend
   cd server && node server.js
   
   # Terminal 2: Start frontend  
   npm start
   ```

5. **Access the app:**
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### GitHub Setup

1. **Create a fine-grained Personal Access Token**:
   - Go to GitHub Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens
   - Select your target repository
   - Grant **Contents** permission (read/write)

2. **Configure in the app**:
   - Click the settings icon in the top-right
   - Enter your GitHub username, repository name, token, and folder name
   - Choose a folder name (defaults to 'todos') - examples: 'work-tasks', 'personal', 'project-alpha'
   - The app will automatically create the directory structure for your chosen folder

## 🏗️ Architecture

> **📖 Detailed Architecture**: See [CONCEPT.md](CONCEPT.md) for complete design documentation

### Three-Layer Design
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  React Frontend │ ←→ │  Express Backend │ ←→ │ External APIs   │
│                 │    │                  │    │                 │
│ • UI Components │    │ • AI Proxy       │    │ • GitHub/GitLab │
│ • State Mgmt    │    │ • Security Layer │    │ • Google Gemini │
│ • Git Client    │    │ • CORS Handling  │    │ • OpenRouter    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow
1. **User Input** → High-level goal or task modification
2. **AI Processing** → Backend calls Gemini AI for intelligent planning
3. **GitHub Storage** → Generated tasks saved as markdown files
4. **Real-Time UI** → Frontend displays interactive markdown with live updates

## 📁 Project Structure

```
am-todos/
├── src/
│   ├── components/          # React components
│   │   ├── TodoEditor.tsx   # Main task editor
│   │   ├── TodoSidebar.tsx  # Task list navigation
│   │   ├── AIChat.tsx       # AI chat interface
│   │   └── ...
│   ├── services/            # API integrations
│   │   ├── githubService.ts # GitHub API client
│   │   └── aiService.ts     # Gemini AI client
│   └── utils/               # Helper functions
├── server/                  # Express backend
│   ├── server.js           # Main server file
│   └── package.json        # Backend dependencies
├── public/                 # Static assets
└── package.json           # Frontend dependencies
```

## 🛠️ Development

> **👩‍💻 Development Guide**: See [CLAUDE.md](CLAUDE.md) for complete development documentation  
> **🧪 Testing Guide**: See [TESTING.md](TESTING.md) for test coverage and validation  
> **🚀 Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment

### Quick Development Start

```bash
# Start development environment
cd server && node server.js &  # Backend
npm start                      # Frontend
```

### Key Development Commands

```bash
npm start              # Development server  
npm run build          # Production build
npm run test:basic     # Run feature validation tests
./hack/restart-dev.sh  # Restart both servers (rarely needed)
```



## 🔒 Security

- **AI API Keys**: Stored in browser localStorage, proxied through backend for security
- **Multi-Provider Support**: Choose between Google Gemini or OpenRouter with 400+ models
- **GitHub Access**: Fine-grained Personal Access Tokens with repository-specific permissions
- **Container Security**: Non-root user, minimal Alpine Linux base, security scanning
- **CORS**: Properly configured for production deployment
- **Data Ownership**: All data stored in your GitHub repository under your control
- **No Server-Side Secrets**: All configuration done through secure web UI

## 📚 Documentation

- **📋 [FEATURES.md](FEATURES.md)** - Detailed feature list with implementation evidence
- **🏗 [CONCEPT.md](CONCEPT.md)** - Architecture, vision, and design principles  
- **👩‍💻 [CLAUDE.md](CLAUDE.md)** - Complete development guide and workflows
- **🧪 [TESTING.md](TESTING.md)** - Test coverage, validation, and CI/CD
- **🚀 [DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment with Docker and Cloud Run
- **🎨 [STYLE_GUIDE.md](STYLE_GUIDE.md)** - UI/UX standards and component patterns

## 📱 Usage Examples

> **📖 Complete Usage Guide**: See [CONCEPT.md](CONCEPT.md) for detailed usage scenarios

### Quick Start Example
1. **Create task**: "Plan weekend camping trip"
2. **AI generates**: Detailed checklist with gear, reservations, route planning
3. **Organize**: Use checkboxes to track progress  
4. **Archive**: Move completed tasks to archive when done

## 📋 Releases

[View all releases](https://github.com/FlorinPeter/am-todos/releases)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the development setup in `CLAUDE.md`
4. Run tests: `npm test`
5. Commit changes: `git commit -m 'feat: add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is open source and available under the MIT License.



---

**Made with ❤️ using React, TypeScript, TailwindCSS, Google Gemini AI, and Claude Code**

*Transform your repository into an intelligent task management system today!*
