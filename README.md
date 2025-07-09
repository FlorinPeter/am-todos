# 📋 Agentic Markdown Todos

> **Transform your GitHub repository into an intelligent task management system**

An AI-powered todo application that merges the simplicity of plain text markdown files with modern AI capabilities. Your tasks live as `.md` files in your GitHub repository, ensuring **you own your data** while leveraging AI for smart task planning and management.

## ✨ Key Features

- **🤖 AI-Powered Task Generation**: Transform high-level goals into detailed actionable checklists
- **📝 GitHub-Native Storage**: Tasks stored as markdown files in configurable folders within your repository with full version control
- **📁 Multi-Folder Support**: Organize tasks in different folders for multiple projects (e.g., 'work-tasks', 'personal', 'client-alpha')
- **💬 AI Chat Assistant**: Natural language commands to modify and enhance your tasks
- **📱 Mobile-First Design**: Responsive interface with hamburger menu and touch-friendly controls
- **⚡ Real-Time Sync**: Instant GitHub synchronization with progress tracking
- **🎯 Smart Priority System**: P1-P5 color-coded priority management
- **📦 Archive System**: Hide completed tasks without losing data
- **🔄 Version Control**: Complete git history with conventional commit messages
- **🚀 Hot Reload Development**: Fast development cycle with automatic reloading

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
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:main"
./hack/deploy-all.sh
```

### 🐳 Deploy with Docker (Local)

For local development or testing:

```bash
# Run the latest version
docker run -p 3001:3001 ghcr.io/florinpeter/am-todos:latest

# Or run a specific version
docker run -p 3001:3001 ghcr.io/florinpeter/am-todos:v1.0.0

# Using docker-compose
curl -O https://raw.githubusercontent.com/FlorinPeter/am-todos/main/docker-compose.yml
docker-compose up -d
```

**Access the app at:** http://localhost:3001

### 📦 Available Container Images

- **Latest stable**: `ghcr.io/florinpeter/am-todos:latest`
- **Specific versions**: `ghcr.io/florinpeter/am-todos:v1.0.0`
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
   cd todo/am-todos
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

### Three-Layer Design
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  React Frontend │ ←→ │  Express Backend │ ←→ │ External APIs   │
│                 │    │                  │    │                 │
│ • UI Components │    │ • AI Proxy       │    │ • GitHub API    │
│ • State Mgmt    │    │ • Security Layer │    │ • Google Gemini │
│ • GitHub Client │    │ • CORS Handling  │    │                 │
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

### Hot Reload Development
Both frontend and backend support hot reload for fast development:

```bash
# Start both servers (recommended)
cd am-todos
./hack/restart-dev.sh  # Only needed for initial setup or rare issues

# Manual start (if needed)
cd server && node server.js &  # Backend
npm start                      # Frontend
```

### Available Scripts

```bash
# Development
npm start              # Start development server
npm run dev            # Start development server
npm run build          # Build for production

# Testing
npm test              # Run tests in watch mode
npm run test:basic    # Run basic feature tests
npm run test:github   # Run GitHub integration tests
npm run test:retry    # Run retry logic tests
npm run test:integration # Run integration tests
npm run test:github-basic # Run basic github integration tests
npm run test:github-stress # Run stress tests for github
npm run test:last-file # Run last file deletion test

# Backend
cd server && node server.js  # Start backend server
```



## 🔒 Security

- **AI API Keys**: Stored in browser localStorage, proxied through backend for security
- **Multi-Provider Support**: Choose between Google Gemini or OpenRouter with 400+ models
- **GitHub Access**: Fine-grained Personal Access Tokens with repository-specific permissions
- **Container Security**: Non-root user, minimal Alpine Linux base, security scanning
- **CORS**: Properly configured for production deployment
- **Data Ownership**: All data stored in your GitHub repository under your control
- **No Server-Side Secrets**: All configuration done through secure web UI

## 📱 Usage Examples

### Multi-Folder Project Organization
**Organize different aspects of your life in separate project folders:**

1. **Professional Work** (`work-tasks`): Sprint planning, project milestones, team tasks
2. **Personal Life** (`personal`): Home improvement, hobby projects, personal goals
3. **Client Projects** (`client-alpha`, `client-beta`): Separate folders per client for better organization
4. **Side Projects** (`side-project-blog`, `startup-idea`): Keep side hustles organized

**Switching Between Projects:**
- Use the project dropdown in the header (desktop) or compact indicator (mobile)
- Click "New Project" to create additional folders with automatic setup
- Each project has its own active and archive directories
- Folder names support letters, numbers, underscores, and hyphens

**Example Folder Structure Created:**
```
your-repo/
├── work-tasks/
│   ├── .gitkeep
│   ├── 2025-01-07-sprint-planning.md
│   └── archive/
│       └── .gitkeep
├── personal/
│   ├── .gitkeep  
│   ├── 2025-01-07-home-renovation.md
│   └── archive/
└── client-alpha/
    ├── .gitkeep
    └── archive/
```

### Creating a Task
1. Click "New Task" 
2. Enter: *"Plan a weekend camping trip"*
3. AI generates detailed checklist stored in your configured folder:
   ```markdown
   # Plan a weekend camping trip
   
   ## Research and Planning
   - [ ] Choose camping location and check availability
   - [ ] Check weather forecast for the weekend
   - [ ] Research hiking trails and activities in the area
   
   ## Packing and Preparation
   - [ ] Pack camping gear (tent, sleeping bags, etc.)
   - [ ] Prepare meals and snacks for the trip
   - [ ] Check vehicle and plan route
   ```

### Using AI Chat
1. Open any task
2. Click "AI Chat Assistant" at the bottom
3. Type: *"Add a section for emergency preparedness"*
4. AI updates the task with relevant safety items

### Priority Management
- **P1 (Critical)**: Red badge - Urgent deadline items
- **P2 (High)**: Orange badge - Important next steps  
- **P3 (Medium)**: Yellow badge - Standard tasks
- **P4 (Low)**: Blue badge - Nice-to-have items
- **P5 (Very Low)**: Gray badge - Someday/maybe items

## 🚀 Deployment

### 🐳 Container Deployment (Recommended)

**Production-ready container images are automatically built and published:**

#### Docker Run
```bash
# Latest stable version
docker run -d \
  --name am-todos \
  -p 3001:3001 \
  --restart unless-stopped \
  ghcr.io/florinpeter/am-todos:latest
```

#### Docker Compose
```bash
# Download compose file
curl -O https://raw.githubusercontent.com/FlorinPeter/am-todos/main/docker-compose.yml

# Run in production mode
docker-compose up -d

# View logs
docker-compose logs -f
```

#### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: am-todos
spec:
  replicas: 2
  selector:
    matchLabels:
      app: am-todos
  template:
    metadata:
      labels:
        app: am-todos
    spec:
      containers:
      - name: am-todos
        image: ghcr.io/florinpeter/am-todos:v1.0.0
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: am-todos-service
spec:
  selector:
    app: am-todos
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

### 🔄 CI/CD and Releases

The project includes automated workflows for:

- **Continuous Integration**: Tests and builds on every push
- **Container Builds**: Multi-platform images (amd64/arm64) on main branch updates
- **Release Management**: Versioned container images when creating Git tags
- **Automated Deployment**: Ready for GitOps workflows

**Create a new release:**
```bash
git tag v1.1.0
git push origin v1.1.0
# Automatically builds and publishes ghcr.io/florinpeter/am-todos:v1.1.0
```

## 🧪 Testing

Comprehensive test suite with 100% coverage of critical paths:

```bash
# Run all tests
npm test

# Specific test suites
npm run test:basic      # Component and feature tests
npm run test:github     # GitHub API integration
npm run test:retry      # Error handling and retry logic
npm run test:integration # Run integration tests
npm run test:github-basic # Run basic github integration tests
npm run test:github-stress # Run stress tests for github
npm run test:last-file # Run last file deletion test
```

## 📚 Documentation

- **[FEATURES.md](FEATURES.md)**: Detailed feature implementation evidence
- **[CLAUDE.md](am-todos/CLAUDE.md)**: Development guidelines and architecture details  
- **[TESTING.md](am-todos/TESTING.md)**: Comprehensive testing documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Complete deployment guide with examples

## 📋 Releases

### Latest Release: v1.0.0

**Container Images:**
- `ghcr.io/florinpeter/am-todos:v1.0.0` - Specific version
- `ghcr.io/florinpeter/am-todos:latest` - Latest stable

**Features:**
- ✅ Multi-AI provider support (Gemini + OpenRouter with 400+ models)
- ✅ Production-ready container deployment
- ✅ Multi-platform support (linux/amd64, linux/arm64)
- ✅ Complete multi-folder project organization
- ✅ Mobile-responsive design with touch support
- ✅ Real-time GitHub synchronization
- ✅ Configuration sharing with QR codes

**Deployment:**
```bash
docker run -p 3001:3001 ghcr.io/florinpeter/am-todos:v1.0.0
```

### Release Notes
- [View all releases](https://github.com/FlorinPeter/am-todos/releases)
- [Container registry](https://github.com/FlorinPeter/am-todos/pkgs/container/am-todos)
- [Deployment guide](DEPLOYMENT.md)

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

## 🔗 Related Projects

- **Obsidian**: Note-taking with markdown files
- **Notion**: All-in-one workspace with AI features
- **GitHub Issues**: Native GitHub task management
- **Linear**: Modern issue tracking with AI

---

**Made with ❤️ using React, TypeScript, TailwindCSS, and Google Gemini AI**

*Transform your repository into an intelligent task management system today!*
