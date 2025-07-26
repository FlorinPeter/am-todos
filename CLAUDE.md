# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Agentic Markdown Todos" - an AI-powered todo application that transforms GitHub repositories into intelligent task management systems. The core vision merges the simplicity of plain text files with modern AI power, ensuring **you own your data** as markdown files in your Git repository.


### Key Principles
- **You Own Your Data**: Tasks are `.md` files in your GitHub repo, editable with any tool
- **Git-Powered Workflow**: Every change is a versioned commit with complete audit history
- **AI as a Partner**: AI assists with planning, task decomposition, and administrative work
- **Markdown-Native**: Primary interface uses rich markdown for flexibility and structure

### Core Features Overview
- **AI-Powered Task Generation**: High-level goals → detailed actionable checklists
- **Intelligent Search**: Real-time search across tasks with folder/repo scope control and keyboard shortcuts
- **Multi-Folder Support**: Organize tasks in configurable folders for different projects
- **Interactive Checkboxes**: Click to toggle task completion with real-time Git sync
- **Markdown Edit Mode**: Toggle between view and edit modes with full editing capabilities
- **Multi-AI Provider Support**: Choose between Google Gemini or OpenRouter (400+ models)

## Development Commands

### Quick Start Development
```bash
# Start both servers (recommended for development)
./hack/restart-dev.sh
```

**Hot Reload**: Both servers support automatic reloading on code changes.  
**Proxy**: Frontend automatically forwards `/api` requests to backend.

## Production Deployment

> **🚀 Complete Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions

### Quick Cloud Run Deployment
```bash
# Prerequisites
sudo ./hack/install-dependencies.sh
gcloud auth login
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Deploy
export SOURCE_IMAGE="ghcr.io/your-username/am-todos:main"
./hack/deploy-all.sh
```

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
  - `GitSettings.tsx`: Configuration interface for GitHub/GitLab PAT and repository
  - `SettingsSharing.tsx`: Configuration sharing modal with QR codes and copyable links
  - `MarkdownViewer.tsx`: Interactive markdown display with AI chat integration
  - `TodoSidebar.tsx`: Priority-sorted task list with mobile hamburger menu
  - `TodoEditor.tsx`: Main content area with task editing and management
  - `NewTodoInput.tsx`: Modal for creating new tasks with AI generation
  - `AIChat.tsx`: Collapsible chat interface for task modifications
- `src/services/`: API layers (githubService, searchService, aiService)
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

### Search Functionality
- **Real-time Search**: Debounced search with 300ms delay for optimal performance
- **Dual Search Scope**: Toggle between "This Folder" and "Entire Repo" search modes
- **Multi-Provider Support**: Works identically with both GitHub and GitLab repositories
- **Keyboard Shortcuts**: Ctrl/Cmd+F to focus search input, Escape to clear search
- **Smart Results Display**: Shows project names for repo-wide searches, preserves priority information
- **Performance Optimized**: Client-side debouncing, result caching, and efficient API calls
- **Error Recovery**: Comprehensive error states with user-friendly messaging and retry options
- **Backend Integration**: `/api/search` endpoint with security validation and rate limit handling

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
- Files use **YAML frontmatter** for metadata (title, createdAt, priority, isArchived)
- `react-markdown` with `remark-gfm` for GitHub-flavored markdown rendering
- **Interactive checkboxes**: Click to toggle with real-time GitHub sync
- **Fixed regex bug**: Proper checkbox pattern matching (`\[[ xX]\]`)
- **Chat interface**: AI chat available but stateless (no persistent history)
- **Priority system**: P1 (Critical/Red) to P5 (Very Low/Gray) with color coding
- **Archive functionality**: Toggle task visibility without deletion

#### Frontmatter Schema Example:
```yaml
---
title: 'Plan a weekend trip to the mountains'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 3
isArchived: false
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

### Technology Stack Specifics {#technology-stack-specifics}
- **React 19.1.0** with TypeScript and hooks-based state management
- **TailwindCSS 4.1.11** with @tailwindcss/vite plugin and responsive design
- **Express 5.1.0** backend with CORS enabled
- **QR Code Library**: `qrcode` package for generating configuration QR codes
- **Create React App** build system (do not eject)
- **Mobile-responsive**: Hamburger menu, touch-friendly interface, responsive breakpoints

## Development Notes

### TailwindCSS Configuration
- Uses TailwindCSS v4 with dedicated `@tailwindcss/vite` plugin
- No longer requires `postcss.config.js` or `tailwind.config.js` files
- Configuration is CSS-based using `@import "tailwindcss"` in index.css

### State Management Pattern
- React hooks with useCallback optimization for performance
- localStorage for GitHub settings persistence
- No external state management library - uses React's built-in state

### Error Handling
- Comprehensive try-catch blocks throughout services
- User-friendly error messages in UI
- Graceful fallbacks for storage and API failures

## Current Status

> **📊 Implementation Status: 100% Complete** - See [FEATURES.md](FEATURES.md) for detailed verification  
> **🧪 Testing Status: 100% Coverage** - See [TESTING.md](TESTING.md) for comprehensive test documentation

All core functionality is implemented and production-ready:
- ✅ AI-powered task generation with multi-provider support
- ✅ Interactive checkboxes with real-time Git sync
- ✅ Multi-folder support for project organization
- ✅ Mobile-responsive design with archive functionality
- ✅ Configuration sharing with QR codes

## Key Workflows

### Configuration Sharing
1. User clicks "Share Config" in Git Settings → Modal opens with generation progress
2. **QR Code Generation**: Creates high-quality QR code for mobile device scanning
3. **URL Generation**: Encodes all settings (PAT, repo details, API keys) in Base64 URL parameter
4. **Copy/Share**: User can copy link or scan QR code to share configuration
5. **Auto-Configuration**: Opening shared URL automatically configures app and saves settings to localStorage
6. **Security Notice**: Clear warning about sensitive data being shared

### Using Search Functionality
1. **Focus Search**: Press Ctrl/Cmd+F or click search input in sidebar
2. **Enter Search Query**: Type search terms (e.g., "deployment", "authentication", "bug fix")
3. **Search Scope Selection**: Toggle between "This Folder" (current project) and "Entire Repo" (all projects)
4. **Real-time Results**: Results appear automatically with 300ms debouncing for performance
5. **Navigate Results**: Click any result to open that task, shows project name for repo-wide searches
6. **Clear Search**: Press Escape key or click clear button to return to normal task list
7. **Error Recovery**: If search fails, retry functionality available with user-friendly error messages

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
3. `processChatMessage()` calls `/api/gemini` with current content (stateless)
4. AI returns updated markdown content
5. App updates task and saves to GitHub with commit message
6. AI chat updates task content without persistent history

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

## Development Workflow

## ⚠️ IMPORTANT: PostToolUse Hook Requirements

**CRITICAL: This project has an active PostToolUse hook that automatically runs comprehensive code quality checks after every Edit, MultiEdit, or Write operation.**

### Mandatory Hook Response Protocol:
1. **PostToolUse Hook Execution**: After any file modification, the hook will automatically display:
   - 📘 **TypeScript Check Results** - Strict type checking with `--strict` flag
   - 📋 **ESLint Check Results** - Code quality and style validation  
   - 📊 **Overall Status** - Pass/fail summary with actionable feedback

2. **MANDATORY: Address All Issues**:  
   - ❌ **TypeScript Errors**: MUST be fixed immediately - these are compilation failures
   - ⚠️ **ESLint Warnings**: MUST be resolved for code quality standards
   - ✅ **Success**: Only proceed when all checks show "✅ PASSED"

3. **Zero Tolerance Policy**:
   - **NO commits** are allowed with failing TypeScript checks
   - **NO warnings** should remain unaddressed in modified files
   - If PostToolUse shows issues, **STOP** and fix them before continuing

4. **Hook Configuration**:
   - Location: `.claude/settings.local.json` PostToolUse configuration
   - Script: `hack/post-edit-hook.sh` → calls `hack/check.sh`
   - Scope: Runs comprehensive project-wide TypeScript + file-specific ESLint checks

### Example Hook Output:
```
🔍 PostToolUse Hook: Running check on modified file: src/services/example.ts
==================================================
📘 TypeScript Check: ✅ PASSED  
📋 ESLint Check: ✅ PASSED
🎉 Overall Result: ALL CHECKS PASSED - File is ready for commit!
==================================================
```

**If you see warnings or errors in PostToolUse output, you MUST fix them before proceeding with any other work.**

### Testing

🚨 **CRITICAL: Anti-Test-Cluttering Guidelines**

**This project consolidated 109 → 33 test files (69.7% reduction) while achieving 78.93% coverage. Follow these guidelines to prevent test cluttering.**

#### Test File Organization Rules

**✅ CORRECT: One Comprehensive File per Component/Service**
```bash
# ✅ GOOD - Consolidated approach  
githubService.test.ts     # ALL githubService functionality (50 tests)
MarkdownViewer.test.tsx   # ALL MarkdownViewer functionality (38 tests)
localStorage.test.ts      # ALL localStorage functionality (102 tests)
```

**❌ WRONG: Multiple Specialized Files (NEVER DO THIS)**
```bash
# ❌ BAD - Causes test cluttering (this was eliminated)
githubService.test.ts
githubService.core.test.ts
githubService.integration.test.ts
githubService.errorHandling.test.ts
[...and 10+ more files testing the same service]
```

#### Anti-Patterns to Avoid
**NEVER create these suffixed files:**
- `Component.draft.test.tsx` → Add to `Component.test.tsx`
- `Component.strategy.test.tsx` → Add to `Component.test.tsx`  
- `service.integration.test.ts` → Add to `service.test.ts`
- `service.errorHandling.test.ts` → Add to `service.test.ts`

**Rule**: If tempted to create `X.something.test.ts`, add those tests to `X.test.ts` instead.

#### Local Development
```bash
npm test              # Interactive test runner (watch mode)
npm run test:basic    # Run feature validation tests only
npm run test:coverage # Full coverage report (same as CI)
npm run test:all-fast # Fast test execution without coverage (24% faster)
```

**Coverage Analysis Timeout Requirement:**
When running coverage analysis for accurate results, both the Bash tool timeout and test timeout need to be configured properly:

```bash
# Use 5-minute timeout for accurate coverage measurement
npm run test:coverage -- --testTimeout=300000
```

**IMPORTANT for Claude Code users:** When using the Bash tool to run coverage commands, set the `timeout` parameter to `300000` (5 minutes):
```typescript
// Example Bash tool usage for coverage
Bash({
  command: "npm run test:coverage",
  timeout: 300000,  // 5 minutes in milliseconds
  description: "Run coverage analysis with 5-minute timeout"
})
```

This dual timeout configuration prevents:
- Test failures due to longer-running tests (via `--testTimeout=300000`)
- Bash tool timeouts before tests complete (via `timeout: 300000`)
- Incomplete coverage analysis in CI/CD pipelines

#### Server Tests (Backend API)
```bash
# Server tests (excluded from main suite)
npx vitest run --run server/__tests__/server.test.js --config /dev/null
```

#### CI/CD Pipeline Testing
The GitHub Actions CI pipeline runs `npm run test:coverage` in Ubuntu with Node.js 20.x and 22.x matrix testing.

### Git Workflow
- Use `main` branch for development
- Conventional commits with descriptive messages
- Professional commit history maintained

### Restart Development Environment
```bash
./hack/restart-dev.sh  # Restart both servers (rarely needed due to hot reload)
```

## Coverage Improvement Guidelines

### Quick Coverage Analysis
```bash
# Get comprehensive coverage report
npm run test:coverage -- --testTimeout=300000
```

### Target Selection Strategy
**Focus on high-impact targets:**
- **85-95% coverage files**: Usually missing error paths or edge cases
- **Utility functions**: Pure functions with clear inputs/outputs
- **Error handling paths**: Often untested but easy to mock

**Avoid for efficiency:**
- **Complex UI components**: High setup overhead, low ROI
- **Files <50% coverage**: Often require architectural changes

### Common Coverage Patterns
```typescript
// Error handling
it('should handle API errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  expect(await serviceFunction()).toBeNull();
});

// Edge cases
it('should handle invalid inputs', () => {
  expect(validateInput(null)).toBe(defaultValue);
});

// Utility function branches
const testCases = [
  { input: 1, expected: 'P1 - Critical' },
  { input: 2, expected: 'P2 - High' }
];
testCases.forEach(({ input, expected }) => {
  it(`should return ${expected} for input ${input}`, () => {
    expect(getLabel(input)).toBe(expected);
  });
});
```

### Workflow
1. **Test individual files**: `npm test src/path/file.test.ts -- --coverage`
2. **Identify uncovered lines**: Focus on error paths and edge cases
3. **Add targeted tests**: Cover missing branches systematically  
4. **Verify improvement**: Re-run coverage to confirm gains

**Current Status**: 78.93% coverage achieved (excellent production standard)

