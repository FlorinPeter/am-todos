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

### Prerequisites
- Node.js 16+ 
- GitHub Personal Access Token (fine-grained, repository-specific)
- Google Gemini API Key

### Installation

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

3. **Configure environment:**
   ```bash
   # Create server/.env
   echo "GEMINI_API_KEY=your_gemini_api_key_here" > server/.env
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
│   React Frontend │ ←→ │  Express Backend │ ←→ │ External APIs   │
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
./restart.sh  # Only needed for initial setup or rare issues

# Manual start (if needed)
cd server && node server.js &  # Backend
npm start                      # Frontend
```

### Available Scripts

```bash
# Development
npm start              # Start development server
npm test              # Run tests in watch mode
npm run build         # Build for production

# Testing
npm run test:basic    # Run basic feature tests
npm run test:github   # Run GitHub integration tests
npm run test:retry    # Run retry logic tests

# Backend
cd server && node server.js  # Start backend server
```

### Environment Variables

**Backend (`server/.env`):**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

**Frontend Configuration:**
- GitHub settings stored in browser localStorage (PAT, owner, repo, folder)
- No environment variables needed
- Folder defaults to 'todos' for backward compatibility

## 🔒 Security

- **API Keys**: Gemini API key stored server-side only, never exposed to client
- **GitHub Access**: Fine-grained Personal Access Tokens with repository-specific permissions
- **CORS**: Properly configured for production deployment
- **Data Ownership**: All data stored in your GitHub repository under your control

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

### Vercel (Recommended)
1. Deploy frontend to Vercel with environment variables
2. Convert Express server to Vercel Edge Function
3. Update API endpoints from localhost to production URLs

### Traditional Hosting
1. Build frontend: `npm run build`
2. Deploy `build/` folder to static hosting
3. Deploy `server/` to Node.js hosting service
4. Update CORS settings for production domain

## 🧪 Testing

Comprehensive test suite with 100% coverage of critical paths:

```bash
# Run all tests
npm test

# Specific test suites
npm run test:basic      # Component and feature tests
npm run test:github     # GitHub API integration
npm run test:retry      # Error handling and retry logic
```

## 📚 Documentation

- **[FEATURES.md](FEATURES.md)**: Detailed feature implementation evidence
- **[CLAUDE.md](am-todos/CLAUDE.md)**: Development guidelines and architecture details
- **[TESTING.md](am-todos/TESTING.md)**: Comprehensive testing documentation

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