# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Agentic Markdown Todos" - an AI-powered todo application that transforms GitHub repositories into intelligent task management systems. The core vision merges the simplicity of plain text files with modern AI power, ensuring **you own your data** as markdown files in your Git repository.

### Key Principles
- **You Own Your Data**: Tasks are `.md` files in your GitHub repo, editable with any tool
- **Git-Powered Workflow**: Every change is a versioned commit with complete audit history
- **AI as a Partner**: AI assists with planning, task decomposition, and administrative work
- **Markdown-Native**: Primary interface uses rich markdown for flexibility and structure

### Core Features
- **AI-Powered Task Generation**: High-level goals → detailed actionable checklists
- **Two-Panel Responsive Layout**: Sidebar task list + main content area with mobile support
- **AI Chat Assistant**: Natural language commands to modify task lists (integrated at bottom of tasks)
- **Interactive Checkboxes**: Click to toggle task completion with real-time GitHub sync
- **Markdown Edit Mode**: Toggle between view and edit modes with full markdown editing capabilities
- **Task Management**: Create, edit, delete, archive, and prioritize tasks (P1-P5)
- **Mobile-First Design**: Hamburger menu, responsive layout, touch-friendly interface
- **Progress Tracking**: Visual progress bars for create, save, and delete operations with step-by-step feedback
- **Smart File Naming**: User-friendly names like `2025-01-05-task-name.md` instead of timestamps
- **Auto-Directory Setup**: Automatically creates `/todos` folder if missing
- **Real-Time Updates**: Instant refresh and auto-selection of new tasks
- **Conventional Commits**: AI-generated semantic commit messages for clean Git history
- **Unsaved Changes Protection**: Clear indicators and confirmation dialogs prevent data loss

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

**Note**: The concept document mentions this should be a serverless function (e.g., Vercel Edge Function) rather than Express server for production deployment.

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
  - `MarkdownViewer.tsx`: Interactive markdown display with AI chat integration
  - `TodoSidebar.tsx`: Priority-sorted task list with mobile hamburger menu
  - `TodoEditor.tsx`: Main content area with task editing and management
  - `NewTodoInput.tsx`: Modal for creating new tasks with AI generation
  - `AIChat.tsx`: Collapsible chat interface for task modifications
- `src/services/`: API layers (githubService, aiService)
- `src/utils/`: Utilities (localStorage, markdown parsing)
- `server/`: Express backend with AI integration

## Important Implementation Details

### GitHub Integration
- Stores todos as markdown files in `/todos` directory of configured repository
- Uses **fine-grained Personal Access Token** restricted to specific repository only
- **Smart file naming**: `YYYY-MM-DD-task-slug.md` format (e.g., `2025-01-05-deploy-web-app.md`)
- **Auto-directory creation**: Creates `/todos` folder with `.gitkeep` if missing
- **Delete functionality**: Complete file removal from repository with confirmation
- **Unicode support**: Proper Base64 encoding handles special characters and emojis
- Every action (create, update, archive, delete) results in a versioned commit

### AI Integration
- Backend acts as secure proxy to protect Gemini API key (never exposed to client)
- Uses **Gemini 2.5 Flash** model for all intelligent features
- **AI functions**: `generateInitialPlan()`, `generateCommitMessage()`, `processChatMessage()`
- **Chat interface**: Collapsible AI chat at bottom of each task for natural language modifications
- **Loading feedback**: Step-by-step progress indicators during AI processing
- **Task generation**: High-level goals converted to detailed actionable checklists
- **Commit automation**: AI generates conventional commit messages for all changes
- Receives requests with `action` and `payload`, constructs system/user prompts, returns text responses

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
- **Backend**: Requires `.env` file with `GEMINI_API_KEY`
- **Frontend**: GitHub settings stored in localStorage (PAT, repo owner, repo name)
- **Proxy**: Frontend configured to proxy `/api` requests to `localhost:3001`

### Technology Stack Specifics
- **React 19.1.0** with TypeScript and hooks-based state management
- **TailwindCSS 3.4.17** with PostCSS configuration and responsive design
- **Express 5.1.0** backend with CORS enabled
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

## Key Workflows

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

### Development Workflow
- **Git integration**: Modern `main` branch instead of `master`
- **Comprehensive logging**: Detailed debugging throughout application
- **Documentation**: Updated CLAUDE.md with complete implementation details
- **Commit history**: Professional conventional commits with Claude attribution
- **Testing infrastructure**: Created comprehensive GitHub API integration tests