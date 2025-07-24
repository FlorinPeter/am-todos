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

### Testing

#### Test File Naming Convention (Semantic Clarity)
Test files follow semantic naming to indicate their specific purpose:

**Services Tests:**
- `[service].test.ts` - Core/comprehensive functionality tests
- `[service].delegation.test.ts` - Service delegation patterns (gitService)
- `[service].environment.test.ts` - Environment detection logic
- `[service].errorHandling.test.ts` - Error scenarios and fallbacks
- `[service].conditionalLogic.test.ts` - Specific conditional branches
- `[service].folderFiltering.test.ts` - Folder pattern matching
- `[service].apiUrl.test.ts` - API URL generation logic
- `[service].taskMovement.test.ts` - Task archiving/unarchiving
- `[service].integration.test.ts` - Real API integration tests
- `[service].validation.test.ts` - Input validation and error paths

**Utils Tests:**
- `[util].test.ts` - Main functionality tests
- `[util].urlEncoding.test.ts` - URL encoding/decoding logic
- `[util].draft.test.ts` - Draft persistence functionality  
- `[util].chatSession.test.ts` - Chat session management

**Component Tests:**
- `[component].test.tsx` - Core component functionality
- `[component].draft.test.tsx` - Draft integration features
- `[component].strategy.test.tsx` - Rendering strategies
- `[component].quick.test.tsx` - Focused interaction tests
- `[component].chatPersistence.test.tsx` - Chat persistence features

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

## Coverage Improvement Process

### Systematic Coverage Grinding Methodology

When working to improve test coverage systematically, follow this proven workflow to identify and implement high-impact coverage improvements efficiently.

#### 1. Initial Coverage Analysis
```bash
# Get comprehensive coverage report with proper timeout
npm run test:coverage -- --testTimeout=300000

# Extract coverage summary for analysis
npm run test:coverage -- --testTimeout=300000 | grep -A 50 "% Coverage report"
```

#### 2. Identify Low-Hanging Fruit Targets
Focus on files with these characteristics:
- **85-95% coverage**: Usually just missing error paths or edge cases
- **Small line gaps**: Files with only 5-20 uncovered lines
- **Utility functions**: Pure functions with clear inputs/outputs
- **Error handling paths**: Often untested but easy to mock

**Avoid these targets for efficiency:**
- **App.tsx**: Complex integration, low ROI
- **Files <50% coverage**: Often require architectural changes
- **Complex UI components**: High setup overhead

#### 3. Target Analysis Commands
```bash
# Analyze individual file coverage
npm test src/services/__tests__/[service].test.ts -- --coverage

# Check specific file coverage details
npm test src/utils/__tests__/[util].test.ts -- --coverage

# Get coverage for component
npm test src/components/__tests__/[Component].test.tsx -- --coverage
```

#### 4. Systematic Implementation Process

**Step 1: Test Individual Files First**
```bash
# Always test the specific file individually before full coverage
npm test src/[path]/__tests__/[file].test.[ts|tsx]
```

**Step 2: Identify Uncovered Lines**
- Read the source file around uncovered line numbers
- Categorize: error paths, edge cases, fallbacks, utility functions
- Prioritize by effort vs. impact ratio

**Step 3: Add Targeted Tests**
Focus on these common patterns:
- **Error handling**: Mock dependencies to throw errors
- **Fallback paths**: Test when primary logic fails
- **Edge cases**: Boundary conditions, invalid inputs
- **Utility functions**: All branches of switch/if statements

**Step 4: Verify Individual File Improvement**
```bash
# Confirm tests pass and coverage improves
npm test src/[path]/__tests__/[file].test.[ts|tsx]
```

**Step 5: Run Full Coverage Analysis**
```bash
# Measure overall impact
npm run test:coverage -- --testTimeout=300000
```

#### 5. Example Coverage Improvement Session

```bash
# 1. Initial analysis
npm run test:coverage -- --testTimeout=300000 | grep -A 50 "% Coverage report"

# 2. Identify targets (example output analysis)
# aiService.ts     |   88.09 |    85.96 |     100 |   88.09 | ...50-156,238-239 
# searchService.ts |   92.74 |    78.33 |     100 |   92.74 | ...47-249,260-262
# localStorage.ts  |   89.91 |    85.78 |     100 |   89.91 | ...09-315,319-325

# 3. Test individual targets
npm test src/services/__tests__/aiService.integration.test.ts
npm test src/services/__tests__/searchService.test.ts  
npm test src/utils/__tests__/localStorage.test.ts

# 4. Implement improvements (add tests for uncovered lines)
# ... edit test files to cover missing paths ...

# 5. Verify improvements
npm test src/services/__tests__/aiService.integration.test.ts
npm test src/services/__tests__/searchService.test.ts
npm test src/utils/__tests__/localStorage.test.ts

# 6. Final coverage analysis
npm run test:coverage -- --testTimeout=300000 | grep -A 50 "% Coverage report"
```

#### 6. Common Coverage Patterns and Solutions

**Error Path Coverage:**
```typescript
// Pattern: Cover catch blocks and error handling
it('should handle API errors gracefully', async () => {
  mockFetch.mockRejectedValue(new Error('Network error'));
  const result = await serviceFunction();
  expect(result).toBeNull();
});
```

**Fallback Logic Coverage:**
```typescript
// Pattern: Cover fallback when primary logic fails
it('should use fallback when primary method fails', () => {
  const spy = vi.spyOn(primaryMethod, 'execute')
    .mockReturnValue({ isValid: false, error: 'Failed' });
  const result = mainFunction(input);
  expect(result).toEqual(fallbackResult);
});
```

**Edge Case Coverage:**  
```typescript
// Pattern: Cover boundary conditions and invalid inputs
it('should handle edge case with invalid priority', () => {
  const result = getPriorityLabel(99); // Invalid priority
  expect(result).toBe('P3 - Medium'); // Default case
});
```

**Utility Function Coverage:**
```typescript
// Pattern: Test all branches of utility functions
const testCases = [
  { input: 1, expected: 'P1 - Critical' },
  { input: 2, expected: 'P2 - High' },
  // ... cover all cases including default
];
testCases.forEach(({ input, expected }) => {
  it(`should return ${expected} for priority ${input}`, () => {
    expect(getPriorityLabel(input)).toBe(expected);
  });
});
```

#### 7. Coverage Impact Tracking

Track improvements systematically:
```bash
# Before improvements
# aiService.ts: 88.09% → target 95%+
# searchService.ts: 92.74% → target 98%+  
# localStorage.ts: 89.91% → target 95%+

# After improvements  
# aiService.ts: 88.09% → 92.38% (+4.3%)
# searchService.ts: 92.74% → 95.85% (+3.1%)
# localStorage.ts: 51.89% → 89.91% (+38%)
```

#### 8. Commit Strategy

Use structured commit messages documenting coverage improvements:
```bash
git commit -m "test: Enhance coverage for [files] - systematic improvements

Coverage Increases:
• [file1]: X% → Y% (+Z%)
  - [specific improvements]
• [file2]: X% → Y% (+Z%) 
  - [specific improvements]

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>"
```

This methodology provides a systematic, efficient approach to coverage improvement that maximizes impact while minimizing effort.

