# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Agentic Markdown Todos" - an AI-powered todo application that transforms GitHub repositories into intelligent task management systems. The core vision merges the simplicity of plain text files with modern AI power, ensuring **you own your data** as markdown files in your Git repository.

> **📋 For detailed feature verification with code evidence, see [FEATURES.md](FEATURES.md)**

### Key Principles
- **You Own Your Data**: Tasks are `.md` files in your GitHub repo, editable with any tool
- **Git-Powered Workflow**: Every change is a versioned commit with complete audit history
- **AI as a Partner**: AI assists with planning, task decomposition, and administrative work
- **Markdown-Native**: Primary interface uses rich markdown for flexibility and structure

### Core Features Overview
> **📋 Complete Feature List**: See [FEATURES.md](FEATURES.md) for detailed implementation evidence

Key development features:
- **AI-Powered Task Generation**: High-level goals → detailed actionable checklists
- **Multi-Folder Support**: Organize tasks in configurable folders for different projects
- **Interactive Checkboxes**: Click to toggle task completion with real-time Git sync
- **Markdown Edit Mode**: Toggle between view and edit modes with full editing capabilities
- **Multi-AI Provider Support**: Choose between Google Gemini or OpenRouter (400+ models)

## Development Commands

### Frontend Development
```bash
npm start          # Run development server (localhost:3000)
npm test           # Run tests in watch mode
npm run build      # Build for production
```

### Backend Development
```bash
cd server
node server.js     # Run backend server (localhost:3001)
```

### Full Development Setup
1. Start backend: `cd server && node server.js`
2. Start frontend: `npm start` (in root directory)  
3. The frontend proxy forwards `/api` requests to the backend

**Hot Reload**: Both frontend and backend support hot reload, so code changes are automatically reflected. The restart script is rarely needed.

**Manual Restart**: If needed, use `./hack/restart-dev.sh` to restart both servers.

## Production Deployment

### Google Cloud Run Deployment
The application is production-ready for Google Cloud Run deployment using the scripts in the `hack/` directory.

#### Prerequisites
```bash
# Install dependencies (run once)
sudo ./hack/install-dependencies.sh

# Authenticate with Google Cloud
gcloud auth login
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

#### Quick Deployment
```bash
# Deploy latest GitHub image
export SOURCE_IMAGE="ghcr.io/your-username/am-todos:main"
./hack/deploy-all.sh
```

#### Deployment Options
1. **Complete deployment (Recommended)**: `./hack/deploy-all.sh`
2. **Pull and retag existing image**: `./hack/pull-and-push.sh && ./hack/deploy-to-cloud-run.sh`
3. **Build from source**: `./hack/build-and-push.sh && ./hack/deploy-to-cloud-run.sh`

#### Environment Configuration
- **Development**: Uses `localhost:3001` proxy and direct GitHub/AI API calls
- **Production**: Uses relative URLs, deployed as single container with frontend + backend
- **Region**: Frankfurt (europe-west3) by default
- **Scaling**: 0-10 instances with 1Gi memory and 1 CPU per instance

## Development vs Production Differences

### Key Configuration Changes
| Aspect | Development | Production |
|--------|-------------|------------|
| **API URLs** | `http://localhost:3001/api/*` (via proxy) | Relative URLs `/api/*` |
| **Frontend Serving** | React dev server (port 3000) | Express static serving |
| **Backend** | Separate Node.js process (port 3001) | Integrated with frontend container |
| **Environment Variables** | Set in local shell | Set via Cloud Run deployment |
| **Port Handling** | Fixed ports (3000/3001) | Cloud Run dynamic PORT |
| **CORS** | Handled by proxy | Handled by Express CORS middleware |

### Development-Specific Files
- `package.json` - Contains `"proxy": "http://localhost:3001"` for dev proxy
- `.env.local` - Local environment variables (if used)
- `restart.sh` - Development server restart script

### Production-Specific Files
- `Dockerfile` - Multi-stage build for production container
- `hack/` - Cloud Run deployment scripts
- Container handles both frontend and backend in single process

### Important Notes for Developers

1. **API URL Handling**: The frontend automatically detects production vs development:
   ```typescript
   const BACKEND_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
   ```

2. **Environment Variables**: 
   - Development: Set in local shell or `.env.local`
   - Production: Set via Cloud Run `--set-env-vars` parameter

3. **Static Files**: 
   - Development: Served by React dev server
   - Production: Served by Express with SPA fallback routing

4. **Debugging**:
   - Development: Use browser dev tools and Node.js debugging
   - Production: Use Cloud Run logs and health check endpoint

5. **Hot Reload**: Only available in development mode via React dev server

### Testing Production Locally
To test production build locally:
```bash
# Build production version
npm run build

# Start production server
NODE_ENV=production node server/server.js

# Access at http://localhost:3001
```

## Architecture Overview

### Three-Layer Architecture
1. **React Frontend** (src/): UI components and state management
2. **Express Backend** (server/): AI API proxy and security layer
3. **External Services**: GitHub API (data storage) + Google Gemini (AI processing)

### Key Data Flow
- User enters high-level goal → Backend calls Gemini AI → Generated plan saved to GitHub → Frontend displays interactive markdown with checkboxes

### File Structure Patterns
- `src/components/`: React components
  - `GitHubSettings.tsx`: Configuration interface for GitHub PAT and repository
  - `SettingsSharing.tsx`: Configuration sharing modal with QR codes and copyable links
  - `MarkdownViewer.tsx`: Interactive markdown display with AI chat integration
  - `TodoSidebar.tsx`: Priority-sorted task list with mobile hamburger menu
  - `TodoEditor.tsx`: Main content area with task editing and management
  - `NewTodoInput.tsx`: Modal for creating new tasks with AI generation
  - `AIChat.tsx`: Collapsible chat interface for task modifications
- `src/services/`: API layers (githubService, aiService)
- `src/utils/`: Utilities (localStorage with URL encoding/decoding, markdown parsing)
- `server/`: Express backend with AI integration

## Important Implementation Details

### GitHub Integration
- Stores todos as markdown files in configurable directory of your repository (defaults to `/todos`)
- **Multi-folder support**: Organize tasks in different folders for multiple projects (e.g., `work-tasks`, `personal`, `client-alpha`)
- Uses **fine-grained Personal Access Token** restricted to specific repository only
- **Smart file naming**: `YYYY-MM-DD-task-slug.md` format (e.g., `2025-01-05-deploy-web-app.md`)
- **Auto-directory creation**: Creates folder and `/archive` subfolder with `.gitkeep` if missing
- **Delete functionality**: Complete file removal from repository with confirmation
- **Unicode support**: Proper Base64 encoding handles special characters and emojis
- Every action (create, update, archive, delete) results in a versioned commit

### AI Integration
- Backend acts as secure proxy to protect AI API keys (never exposed to client)
- **Multi-Provider Support**: Choose between Google Gemini or OpenRouter
- **Gemini Integration**: Direct API access with models like `gemini-2.5-flash`, `gemini-1.5-pro`
- **OpenRouter Integration**: Access to 400+ models including `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `meta-llama/llama-3.1-70b-instruct:free`
- **AI functions**: `generateInitialPlan()`, `generateCommitMessage()`, `processChatMessage()`
- **Chat interface**: Collapsible AI chat at bottom of each task for natural language modifications
- **Loading feedback**: Step-by-step progress indicators during AI processing
- **Task generation**: High-level goals converted to detailed actionable checklists
- **Commit automation**: AI generates conventional commit messages for all changes
- **Flexible model selection**: Custom model specification per provider
- Unified API endpoint (`/api/ai`) handles both providers with OpenAI-compatible format

### Markdown Processing
- Files use **YAML frontmatter** for metadata (title, createdAt, priority, isArchived, chatHistory)
- `react-markdown` with `remark-gfm` for GitHub-flavored markdown rendering
- **Interactive checkboxes**: Click to toggle with real-time GitHub sync
- **Fixed regex bug**: Proper checkbox pattern matching (`\[[ xX]\]`)
- **Chat history storage**: Persistent AI conversation history in frontmatter
- **Priority system**: P1 (Critical/Red) to P5 (Very Low/Gray) with color coding
- **Archive functionality**: Toggle task visibility without deletion

#### Frontmatter Schema Example:
```yaml
---
title: 'Plan a weekend trip to the mountains'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 3
isArchived: false
chatHistory:
  - role: 'user'
    content: 'Add a task to book a cabin'
---
```

### Configuration Requirements
- **Backend**: Requires AI API keys (no `.env` file needed - keys provided via UI)
- **AI Providers**: 
  - **Gemini**: Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
  - **OpenRouter**: Get API key from [OpenRouter](https://openrouter.ai/keys) - access to 400+ models
- **Frontend**: All settings stored in localStorage (PAT, repo details, folder, AI provider, API keys)
- **Configuration Sharing**: Complete settings encoded in Base64 URLs for cross-device sharing
- **Folder Support**: Defaults to 'todos' for backward compatibility, can be changed to any folder name
- **Proxy**: Frontend configured to proxy `/api` requests to `localhost:3001`

### Technology Stack Specifics
- **React 19.1.0** with TypeScript and hooks-based state management
- **TailwindCSS 3.4.17** with PostCSS configuration and responsive design
- **Express 5.1.0** backend with CORS enabled
- **QR Code Library**: `qrcode` package for generating configuration QR codes
- **Create React App** build system (do not eject)
- **Mobile-responsive**: Hamburger menu, touch-friendly interface, responsive breakpoints

## Development Notes

### PostCSS Configuration
- Uses `tailwindcss` and `autoprefixer` plugins
- Configuration in `postcss.config.js` - maintain object format for compatibility

### State Management Pattern
- React hooks with useCallback optimization for performance
- localStorage for GitHub settings persistence
- No external state management library - uses React's built-in state

### Error Handling
- Comprehensive try-catch blocks throughout services
- User-friendly error messages in UI
- Graceful fallbacks for storage and API failures

## Current Status (Latest Updates)

> **📊 Implementation Status: 100% Complete** - See [FEATURES.md](FEATURES.md) for detailed verification  
> **🧪 Testing Status: 100% Coverage** - See [TESTING.md](TESTING.md) for comprehensive test documentation

The archive functionality has been fully implemented and debugged:

### Recent Archive Fixes (Current Session)
1. **Tab Count Display**: Fixed App.tsx lines 661 and 671 to use `allTodos.filter()` instead of `todos.filter()` for accurate tab counts
2. **Sidebar Archive Display**: Fixed TodoSidebar.tsx line 62 to remove duplicate `isArchived` filter that was preventing archived tasks from appearing
3. **Complete Archive Workflow**: Archive/unarchive operations now work correctly with proper task counts and sidebar display
4. **Server Logs**: Confirmed backend is properly fetching both active and archived todos from GitHub API

### Current Functionality Status
- ✅ **Active/Archive Tab Switching**: Works correctly with accurate counts
- ✅ **Archive/Unarchive Tasks**: Full bidirectional movement between active and archive
- ✅ **Sidebar Display**: Shows appropriate tasks based on selected view mode
- ✅ **Task Counts**: Real-time accurate counts for both active and archived tasks
- ✅ **Data Persistence**: All operations properly sync with GitHub repository
- ✅ **Mobile Responsiveness**: Archive functionality works on mobile devices
- ✅ **Configuration Sharing**: URL-based sharing with QR codes for cross-device setup
- ✅ **Multi-AI Provider Support**: Full Gemini and OpenRouter integration with 400+ model access

## Key Workflows

### Configuration Sharing
1. User clicks "Share Config" in GitHub Settings → Modal opens with generation progress
2. **QR Code Generation**: Creates high-quality QR code for mobile device scanning
3. **URL Generation**: Encodes all settings (PAT, repo details, API keys) in Base64 URL parameter
4. **Copy/Share**: User can copy link or scan QR code to share configuration
5. **Auto-Configuration**: Opening shared URL automatically configures app and saves settings to localStorage
6. **Security Notice**: Clear warning about sensitive data being shared

### AI Provider Setup
1. **Choose Provider**: In Settings → AI Provider Configuration, select "Google Gemini" or "OpenRouter"
2. **Gemini Setup**: 
   - Get free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Enter key in "Google Gemini API Key" field
   - Optionally specify model (e.g., `gemini-2.5-flash`, `gemini-1.5-pro`)
3. **OpenRouter Setup**:
   - Get API key from [OpenRouter](https://openrouter.ai/keys) 
   - Enter key in "OpenRouter API Key" field
   - Specify model (e.g., `anthropic/claude-3.5-sonnet`, `openai/gpt-4o`, `meta-llama/llama-3.1-70b-instruct:free`)
4. **Save Settings** and test by creating a new task

### Creating a New Todo
1. User clicks "New Task" → Modal appears with input field
2. User enters goal → **Loading overlay** shows with progress steps:
   - 🤖 Generating task plan with AI...
   - 📝 Preparing task content...
   - 💬 Generating commit message...
   - 📂 Setting up repository...
   - 💾 Saving to GitHub...
   - 🔄 Refreshing task list...
3. `generateInitialPlan()` calls `/api/gemini` with action/payload
4. AI returns markdown checklist → combined with frontmatter
5. `generateCommitMessage()` creates conventional commit message
6. **Auto-directory creation**: Creates `/todos` folder if missing
7. GitHub API creates file with smart naming: `YYYY-MM-DD-task-slug.md`
8. App refreshes and auto-selects new task

### Editing Tasks with Markdown Editor
1. User clicks "Edit" button in markdown viewer → Editor mode activates
2. **Edit interface** appears with:
   - Full-width textarea with monospace font for raw markdown editing
   - "Unsaved changes" indicator when content is modified
   - Save/Cancel buttons in the header
3. User edits markdown content directly
4. Click "Save" → **Progress overlay** shows with steps:
   - 🔍 Preparing to save... (10%)
   - 📝 Preparing content... (25%)
   - 🤖 Generating commit message... (50%)
   - 💾 Saving to GitHub... (75%)
   - 🔄 Refreshing task list... (90%)
   - ✅ Save completed! (100%)
5. `handleTodoUpdate()` processes the save with full error handling
6. App refreshes task content and returns to view mode

### Using AI Chat Assistant
1. User clicks "AI Chat Assistant" at bottom of task → Chat interface expands
2. User types natural language command (e.g., "Add a step for user authentication")
3. `processChatMessage()` calls `/api/gemini` with current content and chat history
4. AI returns updated markdown content
5. App updates task and saves to GitHub with commit message
6. Chat history stored in frontmatter for context

### Managing Tasks
- **Priority changes**: Dropdown selector (P1-P5) with color-coded badges
- **Archive/unarchive**: Toggle button to hide/show completed tasks
- **Delete tasks**: Red trash button with confirmation dialog
- **Mobile navigation**: Hamburger menu for sidebar on mobile devices
- **Auto-refresh**: Tasks update automatically after any change

### Security Considerations
- **Gemini API Key**: Stored securely as server-side environment variable, never exposed to client
- **GitHub PAT**: Stored in browser localStorage, sandboxed to application origin
- **Fine-grained permissions**: PAT restricted to specific repository only
- **HTTPS only**: All API communications over secure connections

## Recent Improvements (Latest Session)

### UI/UX Enhancements
- **Two-panel layout**: Professional sidebar + main content design
- **Mobile responsiveness**: Hamburger menu, touch-friendly interface
- **Progress tracking**: Visual progress bars for all operations (create, save, delete)
- **Markdown edit mode**: Toggle between view and edit modes with full editing capabilities
- **Smart file naming**: Date-prefixed, human-readable file names
- **Auto-directory setup**: No manual `/todos` folder creation needed
- **Real-time updates**: Immediate task list refresh and auto-selection
- **Unsaved changes protection**: Visual indicators and confirmation dialogs

### Functionality Additions
- **Markdown editor**: Full-featured text editor with monospace font and syntax support
- **Save progress tracking**: 6-step visual feedback during save operations
- **Delete tasks**: Complete removal with confirmation dialog and progress tracking
- **AI chat interface**: Bottom-of-task collapsible chat for modifications
- **Priority management**: Visual P1-P5 system with color coding
- **Archive system**: Hide/show tasks without deletion
- **Configuration sharing**: Generate shareable URLs and QR codes for cross-device setup
- **Multi-AI provider support**: Flexible switching between Gemini and OpenRouter with 400+ model access
- **Error handling**: Comprehensive debugging and user feedback
- **Unicode support**: Fixed Base64 encoding for special characters

### Technical Fixes
- **Edit mode state management**: Proper handling of edit/view transitions with data integrity
- **Progress overlay system**: Consistent progress bars across all operations
- **Build system**: Fixed TailwindCSS PostCSS configuration
- **TypeScript errors**: Resolved error handling and type safety
- **Regex bug**: Fixed checkbox pattern matching in MarkdownViewer
- **State management**: Improved refresh logic and dependency handling
- **Mobile layout**: Fixed sidebar height and responsive breakpoints
- **Archive tab counts**: Fixed incorrect tab counts showing 0 by using allTodos instead of filtered todos array
- **Archive sidebar display**: Fixed archived tasks not appearing in sidebar by removing duplicate isArchived filter in TodoSidebar component

### Development Workflow
- **Git integration**: Modern `main` branch instead of `master`
- **Comprehensive logging**: Detailed debugging throughout application
- **Documentation**: Updated CLAUDE.md with complete implementation details
- **Commit history**: Professional conventional commits with Claude attribution
- **Testing infrastructure**: Created comprehensive GitHub API integration tests
- **Restart script**: Use `./hack/restart-dev.sh` to restart both servers when needed (rarely required due to hot reload)