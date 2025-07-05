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
- **Interactive Markdown Editor**: Direct raw markdown editing with GitHub sync
- **AI-Powered Task Extension**: Any checklist item can be decomposed into sub-tasks
- **AI Chat Assistant**: Natural language commands to modify task lists
- **Task Prioritization & Archiving**: P1-P5 priorities with archive/unarchive functionality
- **Conventional Commits**: AI-generated semantic commit messages for clean Git history

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
- `src/components/`: React components (GitHubSettings, MarkdownViewer, TodoList, NewTodoInput)
- `src/services/`: API layers (githubService, aiService)
- `src/utils/`: Utilities (localStorage, markdown parsing)
- `server/`: Express backend with AI integration

## Important Implementation Details

### GitHub Integration
- Stores todos as markdown files in `/todos` directory of configured repository
- Uses **fine-grained Personal Access Token** restricted to specific repository only
- Automatically generates conventional commit messages for all changes
- File naming: `{timestamp}.md` format (e.g., `my-awesome-task-1668273612.md`)
- Every action (create, update, archive, delete) results in a versioned commit

### AI Integration
- Backend acts as secure proxy to protect Gemini API key (never exposed to client)
- Uses **Gemini 2.5 Flash** model for all intelligent features
- AI functions: `generateInitialPlan()`, `generateCommitMessage()`, task extension, and chat assistant
- Receives requests with `action` and `payload`, constructs system/user prompts, returns text responses
- Supports task decomposition: any checklist item can be broken down into sub-tasks
- Natural language commands via chat interface for task list modifications

### Markdown Processing
- Files use **YAML frontmatter** for metadata (title, createdAt, priority, isArchived, chatHistory)
- `react-markdown` with `remark-gfm` for GitHub-flavored markdown rendering
- Interactive checkboxes that update both UI state and GitHub files
- Custom checkbox component tracks line numbers for precise updates
- Direct raw markdown editing capability with GitHub sync
- Support for priorities (P1-P5) and archiving functionality

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
- **TailwindCSS 3.4.17** with PostCSS configuration
- **Express 5.1.0** backend with CORS enabled
- **Create React App** build system (do not eject)

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
1. User enters goal in `NewTodoInput.tsx` → "GENERATING" placeholder shown
2. `generateInitialPlan()` calls `/api/gemini` with action/payload
3. AI returns markdown checklist → combined with frontmatter
4. `generateCommitMessage()` creates conventional commit message
5. GitHub API creates file via `PUT /repos/{owner}/{repo}/contents/todos/{filename}.md`
6. App refetches todos to sync state

### Checking a Box
1. User clicks checkbox → `MarkdownViewer.tsx` toggles `[ ]` to `[x]`
2. New markdown propagated to `App.tsx` via `onMarkdownChange`
3. `generateCommitMessage()` creates commit for the change
4. GitHub API updates file (requires file's `sha` for version control)
5. App refetches todos to get updated content and new `sha`

### Security Considerations
- **Gemini API Key**: Stored securely as server-side environment variable, never exposed to client
- **GitHub PAT**: Stored in browser localStorage, sandboxed to application origin
- **Fine-grained permissions**: PAT restricted to specific repository only
- **HTTPS only**: All API communications over secure connections