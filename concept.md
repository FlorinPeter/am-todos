# Agentic Markdown Todos: Concept & Architecture

## 1. Vision & Core Concept

**Agentic Markdown Todos** is a smart todo application designed for developers, project managers, and anyone who prefers a Git-based, markdown-first workflow. It transforms a standard GitHub repository into a powerful, intelligent task management system.

The core vision is to merge the simplicity and control of plain text files with the power of modern AI. Instead of being locked into a proprietary platform, your data (your tasks) lives in a format you already own and understand—markdown files in a Git repository. An AI agent assists you in breaking down large goals, managing tasks, and maintaining a clean, version-controlled history of your work.

### Key Principles:

*   **You Own Your Data:** Your tasks are `.md` files in your GitHub repo. You can clone, edit, and manage them with any tool you like.
*   **Git-Powered Workflow:** Every change, from creating a task to checking off an item, is a versioned commit. This provides a complete, auditable history of your progress.
*   **AI as a Partner:** The app integrates an AI agent to act as a strategic partner. It helps with planning, decomposition of tasks, and administrative work like writing commit messages.
*   **Markdown-Native:** The primary interface for interacting with tasks is rich markdown, providing flexibility for notes, code snippets, and structured lists.

---

## 2. Core Features

*   **AI-Powered Task Generation:** Users provide a high-level goal (e.g., "Launch a new marketing website"). The AI agent analyzes the goal and generates a detailed, actionable checklist in markdown format.
*   **GitHub as a Backend:** The application authenticates with the user's GitHub account via a Personal Access Token (PAT). All todos are stored as individual markdown files in a `todos/` directory within a user-specified repository.
*   **Conventional Commits:** The AI automatically generates descriptive [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) messages for every action (create, update, archive, delete), ensuring the repository's Git history is clean, semantic, and easy to follow.
*   **Interactive Markdown Editor:** Users can toggle between view and edit modes with a sophisticated markdown editor featuring:
    *   **Edit/View Toggle:** Switch seamlessly between rendered markdown preview and raw text editing
    *   **Save Progress Tracking:** Visual progress bars showing 6-step save process with real-time feedback
    *   **Unsaved Changes Protection:** Clear indicators and confirmation dialogs prevent accidental data loss
    *   **Full-Featured Editor:** Monospace font, proper indentation, and resize capabilities for comfortable editing
*   **AI-Powered Task Extension:** Any checklist item can be selected for further decomposition. The AI takes the context of the main goal and the specific item and generates more granular sub-tasks, which are then seamlessly inserted into the markdown.
*   **AI Chat Assistant:** A chat interface allows users to give natural language commands to modify the current task list (e.g., "Add a step for user authentication," "Rephrase the second item to be more formal"). The AI edits the markdown and returns the complete, updated file.
*   **Task Prioritization & Archiving:** Users can assign priorities (P1-P5) to tasks and archive/unarchive them. These actions are also saved as commits in the repository.
*   **Secure Settings Management:** Users configure their GitHub repository URL and PAT. The PAT is stored exclusively in the browser's `localStorage` and is never persisted on a server.

---

## 3. Architecture & Tech Stack

The application is a single-page application (SPA) that communicates with two main external services: the GitHub API and a serverless function that proxies requests to the Google Gemini API.

### Frontend

*   **Framework:** React `19` (with Hooks)
*   **Language:** TypeScript
*   **Styling:** TailwindCSS
*   **Markdown:** `react-markdown` with `remark-gfm` for GitHub-Flavored Markdown rendering.
*   **API Client:** Native `fetch` API for all HTTP requests.

### Backend / Services

*   **AI Model:** Google Gemini (`gemini-2.5-flash`) is used for all intelligent features.
*   **AI Proxy (`/api/gemini`):** A serverless function (e.g., Vercel Edge Function) that acts as a secure backend.
    *   **Purpose:** It holds the `API_KEY` for the Gemini API as a secure environment variable. The frontend *never* has access to this key.
    *   **Functionality:** It receives requests from the frontend specifying an `action` (e.g., `generateInitialPlan`) and a `payload`. It then constructs the appropriate system prompt and user prompt, calls the Gemini API, and returns the text response to the client.
*   **Data Storage (Source of Truth):** A user-provided GitHub Repository.
    *   The application interacts directly with the GitHub REST API from the client-side for all file-based operations (reading, creating, updating, deleting files).

### Data Structure

*   **Local Storage:** Persists the user's GitHub settings (`pat`, `owner`, `repo`) in the browser.
*   **GitHub Repository:**
    *   Contains a `todos/` directory.
    *   Each task is a separate file, e.g., `todos/my-awesome-task-1668273612.md`.
    *   Files use **YAML Frontmatter** to store metadata.

#### Frontmatter Schema (`TodoFrontmatter`):

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

---

## 4. Workflows & Data Flow

### A) Creating a New Todo

1.  **User Input:** The user enters a goal (e.g., "Deploy the web app to production") in `NewTodoInput.tsx` and submits.
2.  **UI Update:** The `App.tsx` component adds a temporary "GENERATING" placeholder todo to the list and displays it to the user.
3.  **Generate Plan (AI Call):** `App.tsx` calls `generateInitialPlan()`, which POSTs to the `/api/gemini` proxy with `{ action: 'generateInitialPlan', payload: { goal } }`.
4.  **AI Proxy:** The serverless function receives the request, selects the `SYSTEM_PROMPT_INITIAL`, and calls the Gemini API.
5.  **Markdown Generation:** The Gemini API returns a markdown checklist. The proxy forwards this back to the client.
6.  **Prepare File:** The client now has the markdown content. It combines this with the default frontmatter.
7.  **Generate Commit Message (AI Call):** `App.tsx` calls `generateCommitMessage()`, which POSTs to the `/api/gemini` proxy with details about the new file. The AI returns a conventional commit message (e.g., `feat: Add task "Deploy web app to production"`).
8.  **GitHub API Call:** The `githubService.createOrUpdateTodo()` function is called. It makes a `PUT /repos/{owner}/{repo}/contents/todos/{filename}.md` request to the GitHub API, providing the Base64-encoded file content and the generated commit message.
9.  **Sync State:** After the GitHub API confirms the creation, `App.tsx` triggers a full re-fetch of all todos from the repository to ensure the local state is in sync with the source of truth.

### B) Checking a Box

1.  **User Action:** The user clicks a checkbox in the `MarkdownViewer.tsx` component.
2.  **Client-Side Markdown Update:** An `onChange` event handler identifies the line and toggles the `[ ]` to `[x]`, creating a new markdown string in memory.
3.  **Propagate Change:** The new markdown string is passed up to `App.tsx` via the `onMarkdownChange` prop.
4.  **Handle Mutation:** `App.tsx` triggers its `handleUpdateTodoContent` flow.
5.  **Generate Commit Message (AI Call):** As before, the client calls the proxy to generate a commit message. Given the small change, the AI is prompted to return something like `fix: Complete "Configure CI/CD pipeline"`.
6.  **GitHub API Call:** `githubService.createOrUpdateTodo()` is called again. This time, it includes the file's `sha` (a unique identifier for the file's current version), which is required by the GitHub API for updates.
7.  **Sync State:** The app re-fetches the todo list to get the updated file content and the new `sha`.

---

## 5. Current Implementation Status

As of January 2025, the application has been fully implemented with all core features operational:

### ✅ Completed Features

*   **Complete UI/UX:** Two-panel responsive layout with professional sidebar and mobile hamburger menu
*   **AI-Powered Task Generation:** Full integration with Google Gemini 2.5 Flash for intelligent task creation
*   **Markdown Editor with Progress Tracking:** 
    *   Edit/View mode toggle with sophisticated state management
    *   6-step visual progress bars for all operations (create, save, delete)
    *   Unsaved changes detection with confirmation dialogs
    *   Full-featured textarea editor with monospace font
*   **GitHub Integration:** Complete CRUD operations with proper error handling and retry logic
*   **Interactive Checkboxes:** Real-time task completion with immediate GitHub sync
*   **AI Chat Assistant:** Natural language task modification with persistent chat history
*   **Task Management:** Priority system (P1-P5), archiving, and deletion with confirmation
*   **Smart File Naming:** Human-readable filenames with date prefixes
*   **Auto-Directory Setup:** Automatic `/todos` folder creation
*   **Conventional Commits:** AI-generated semantic commit messages for all operations
*   **Error Handling:** Comprehensive error recovery and user feedback
*   **Testing Infrastructure:** Complete GitHub API integration test suite

### 🏗️ Technical Architecture

*   **Frontend:** React 19.1.0 with TypeScript, TailwindCSS 3.4.17
*   **Backend:** Express 5.1.0 as AI proxy (development) / Future: Vercel Edge Functions
*   **State Management:** React hooks with optimized useCallback patterns
*   **Storage:** GitHub repository as single source of truth
*   **Security:** Fine-grained PAT with repository-specific permissions

### 📱 User Experience

*   **Mobile-First Design:** Fully responsive with touch-friendly interface
*   **Progress Feedback:** Visual progress for all async operations
*   **Data Integrity:** Protection against data loss with confirmation dialogs
*   **Professional UI:** Clean, modern interface with consistent design patterns
*   **Performance:** Sub-second operations with intelligent retry mechanisms

---

## 6. Security Considerations

*   **Gemini API Key:** The key is stored securely as a server-side environment variable in the serverless function environment. It is **never** exposed to the client, preventing unauthorized use.
*   **GitHub Personal Access Token (PAT):**
    *   The PAT is stored in the browser's `localStorage`. This means it is sandboxed to the application's origin and is not accessible by other websites.
    *   The application only sends the PAT directly to the `api.github.com` domain over HTTPS.
    *   Users are instructed to create a **fine-grained PAT** with permissions restricted to *only* the specific repository used for the app, minimizing potential exposure if the token were ever compromised.



