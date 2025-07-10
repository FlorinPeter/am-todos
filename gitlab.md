# GitLab Integration Plan

This document outlines the necessary changes and considerations to extend "Agentic Markdown Todos" to support GitLab.com and private GitLab instances, in addition to the existing GitHub integration.

## 1. Core Principles & Goals

*   **User Choice**: Allow users to seamlessly select between GitHub and GitLab as their Git provider.
*   **Data Ownership**: Continue storing tasks as Markdown files in the user's chosen GitLab repository.
*   **Feature Parity**: Ensure all existing features (task creation, editing, archiving, AI integration, etc.) function identically across both providers.
*   **Secure Authentication**: Utilize GitLab Personal Access Tokens (PATs) with fine-grained permissions.
*   **Configurability**: Support both GitLab.com and self-hosted GitLab instances (requiring a custom API URL).
*   **Test Coverage**: Implement comprehensive unit and integration tests for GitLab-specific functionality.

## 2. Architectural Changes

The primary architectural change will involve abstracting the Git provider logic to allow for interchangeable backends (GitHub and GitLab).

### 2.1. Backend (`server/server.js`)

*   **Keep Existing Routes**: Maintain existing `/api/github` endpoints for backward compatibility.
*   **Add New Routes**: Create new `/api/gitlab` endpoints alongside existing ones.
*   **No Provider Abstraction**: Implement GitLab service directly without complex abstraction layers.
*   **Error Handling**: Ensure consistent error handling across both providers.

### 2.2. Frontend (`src/`)

*   **Context/State Management**: Update the application's state to include the selected Git provider and its specific configuration (e.g., `gitProvider: 'github' | 'gitlab'`, `gitlabInstanceUrl`).
*   **API Calls**: Modify frontend services (e.g., `src/services/githubService.ts` will become `src/services/gitService.ts` or similar) to use the generalized backend API endpoints.

## 3. Frontend Implementation Details

### 3.1. Settings Page (`src/components/GitHubSettings.tsx`)

This component will be renamed (e.g., `GitSettings.tsx`) and significantly refactored.

*   **Provider Selection**: Add a radio button or dropdown to allow users to choose "GitHub" or "GitLab".
*   **Conditional Input Fields**:
    *   If "GitHub" is selected: Display existing fields for GitHub PAT, username, repository, and folder.
    *   If "GitLab" is selected:
        *   Input field for **GitLab Instance URL** (e.g., `https://gitlab.com` or `https://your-private-gitlab.com`). This should default to `https://gitlab.com`.
        *   Input field for **GitLab Personal Access Token**.
        *   Input field for **GitLab Project ID** (or project path with namespace, e.g., `group/subgroup/project-name`). GitLab APIs often use project IDs. We'll need to decide if we want to ask for ID or path and convert. Project path is more user-friendly.
        *   Input field for **GitLab Branch** (e.g., `main`, `master`).
        *   Input field for **GitLab Folder** (e.g., `todos`).
*   **Validation**: Implement client-side validation for GitLab-specific inputs (e.g., valid URL, non-empty PAT/project).
*   **Configuration Sharing**: Update `SettingsSharing.tsx` to include GitLab-specific configuration in the shareable URL/QR code.

### 3.2. Services (`src/services/`)

*   **`src/services/githubService.ts`**: This file will either be renamed to `gitService.ts` and refactored to handle both, or a new `gitlabService.ts` will be created alongside it, with a higher-level `gitService.ts` orchestrating calls.
    *   **`gitlabService.ts` (New)**:
        *   Implement functions for GitLab API interactions:
            *   `getTree(instanceUrl, projectId, branch, path)`: To list files in a directory.
            *   `getFile(instanceUrl, projectId, branch, filePath)`: To read file content.
            *   `createFile(instanceUrl, projectId, branch, filePath, content, commitMessage)`: To create a new file.
            *   `updateFile(instanceUrl, projectId, branch, filePath, content, commitMessage)`: To update an existing file.
            *   `deleteFile(instanceUrl, projectId, branch, filePath, commitMessage)`: To delete a file.
            *   `createDirectory(instanceUrl, projectId, branch, path, commitMessage)`: To create a directory (GitLab doesn't have direct directory creation via API; it's done by creating a file within it).
            *   `getProjectDetails(instanceUrl, projectIdOrPath)`: To verify project existence and get its ID if a path is provided.
        *   Handle GitLab-specific authentication (PAT in headers).
        *   Manage Base64 encoding/decoding for file content.
*   **`src/App.tsx`**: Update `App.tsx` to use the abstracted `gitService` for all Git operations. This includes `fetchTodos`, `handleTodoUpdate`, `handleTodoDelete`, `handleNewTodo`, etc.
*   **`src/utils/localStorage.ts`**: Update `saveSettings` and `loadSettings` to store/retrieve GitLab-specific configuration.

## 4. Backend Implementation Details (`server/`)

### 4.1. `server/server.js`

*   **Route Handling**: Modify existing routes (e.g., `/api/github/todos`) or create new ones (e.g., `/api/git/todos`) to accept a `provider` parameter (e.g., `github`, `gitlab`) and route requests accordingly.
*   **Provider Initialization**: Based on the `provider` and `instanceUrl` (for GitLab), initialize the correct Git service.
*   **API Key Handling**: Ensure GitLab PATs are securely handled and not exposed to the client.

### 4.2. `server/gitlabService.js` (New)

*   **API Client**: Use a library like `node-fetch` or `axios` to make HTTP requests to the GitLab API.
*   **Endpoint Mapping**: Map frontend requests (e.g., "get file content") to the appropriate GitLab REST API endpoints (e.g., `GET /projects/:id/repository/files/:file_path/raw`).
*   **Error Handling**: Translate GitLab API errors into a consistent format for the frontend.
*   **Authentication**: Add `Private-Token` header for PAT authentication.
*   **Content Handling**: Ensure proper Base64 encoding/decoding for file content as required by GitLab API.
*   **Commit Messages**: Ensure commit messages are passed correctly.

## 5. Testing Strategy

### 5.1. Unit Tests

*   **`src/services/gitlabService.test.ts`**:
    *   Test individual GitLab API functions (e.g., `getFile`, `createFile`, `deleteFile`) with mocked API responses.
    *   Verify correct URL construction, headers, and payload formatting.
    *   Test error handling for various GitLab API responses (e.g., 401, 404, 500).
*   **`server/gitlabService.test.js`**:
    *   Similar to frontend unit tests, but for the backend GitLab service.
    *   Mock HTTP requests to GitLab.
*   **`src/components/GitSettings.test.tsx`**:
    *   Test rendering of conditional input fields based on provider selection.
    *   Test input validation.
    *   Test state updates on input changes.

### 5.2. Integration Tests

*   **Extend Existing Tests**: Build upon current test patterns and infrastructure, don't create new testing systems.
*   **Mock-Based Testing**: Use mocked GitLab API responses following existing mock patterns.
*   **Configuration Sharing**: Test that shared URLs correctly pre-populate GitLab settings using existing test utilities.

### 5.3. Manual Testing

*   Thorough manual testing on both GitLab.com and a private GitLab instance (if possible) to ensure all features work as expected.
*   Test edge cases: invalid PATs, non-existent projects, network errors.

## 6. Other Considerations

### 6.1. Environment Variables

*   No new environment variables needed for GitLab integration.
*   All configuration (instance URL, PAT, project) will be user-provided and stored in `localStorage`.
*   Testing will rely on mocking, manual testing will be performed separately.

### 6.2. Dockerfile

*   No direct changes expected to the `Dockerfile` unless new dependencies are introduced for GitLab integration.

### 6.3. Deployment

*   The Cloud Run deployment scripts (`hack/`) should continue to work as they are, as the changes are primarily within the application logic, not the deployment mechanism.

### 6.4. Documentation

*   Update `README.md` with instructions on how to configure GitLab, emphasize sovereign data ownership.
*   Update `FEATURES.md` to reflect GitLab support.
*   Update `CONCEPT.md` to include GitLab integration and strengthen sovereign/self-sovereign messaging.
*   Add a `TROUBLESHOOTING.md` section for common GitLab configuration issues.

## 7. Implementation Steps (High-Level)

1.  **Refactor `GitHubSettings.tsx`**: Rename to `GitSettings.tsx` and implement provider selection and conditional inputs.
2.  **Create `gitlabService.ts` (frontend)**: Implement GitLab API client functions.
3.  **Create `gitlabService.js` (backend)**: Implement GitLab API client functions.
4.  **Abstract Git Logic**: Create a `gitService.ts` (frontend) and `gitProviderService.js` (backend) to orchestrate calls to GitHub/GitLab services.
5.  **Update `App.tsx`**: Use the new abstracted `gitService`.
6.  **Update `localStorage.ts`**: Store GitLab settings.
7.  **Implement Tests**: Write comprehensive unit and integration tests.
8.  **Manual Testing & Debugging**.
9.  **Update Documentation**.

This plan provides a comprehensive roadmap for integrating GitLab. I'll await your confirmation before proceeding with any code changes.

---

# GitLab Integration Implementation Plan

## **Verified Current Implementation**
✅ **GitHub Service**: Comprehensive API client with proxy pattern, Base64 encoding, file operations
✅ **Settings System**: localStorage-based with URL sharing, QR codes, multi-AI provider support  
✅ **Testing Infrastructure**: Vitest, React Testing Library, 60+ tests with integration coverage
✅ **AI Service**: Provider-agnostic architecture already supports multiple backends

## **High-Level Strategy**
**Provider Abstraction**: Create unified `GitService` interface that routes to GitHub or GitLab implementations
**Minimal Disruption**: Extend existing patterns rather than rewriting core logic
**Feature Parity**: Ensure all current features work identically across both providers

## **Implementation Steps**

### **Phase 1: Backend Implementation (2-3 hours)**
1. Create `server/gitlabService.js` - GitLab API implementation
2. Update `server/server.js` - add `/api/gitlab` endpoints alongside existing `/api/github`
3. Implement GitLab-specific API mappings (files, commits, directories)
4. Maintain backward compatibility with existing GitHub routes

### **Phase 2: Frontend Services (2-3 hours)**  
1. Create `src/services/gitlabService.ts` - GitLab API client
2. Create `src/services/gitService.ts` - simple router to GitHub/GitLab services
3. Keep `src/services/githubService.ts` unchanged for backward compatibility
4. Implement GitLab-specific error handling and Base64 encoding

### **Phase 3: Settings & UI (2-3 hours)**
1. Rename `GitHubSettings.tsx` → `GitSettings.tsx` with provider selection
2. Add GitLab fields: instance URL, project ID/path, PAT, branch
3. Update `localStorage.ts` - extend settings interface for GitLab
4. Update `SettingsSharing.tsx` - include GitLab config in QR/URL sharing

### **Phase 4: Testing (2-3 hours)**
1. Create `src/services/__tests__/gitlabService.test.ts` - unit tests with mocks
2. Create `src/services/__tests__/gitService.test.ts` - router tests  
3. Update component tests for provider selection UI
4. Extend existing test patterns, don't create new testing systems
5. Use mocked GitLab API responses following existing patterns

### **Phase 5: Documentation & Polish (1-2 hours)**
1. Update README.md with GitLab configuration instructions and sovereign messaging
2. Update FEATURES.md to document GitLab support
3. Update CONCEPT.md to include GitLab integration and strengthen sovereign/self-sovereign messaging
4. Add troubleshooting section for GitLab-specific issues
5. Manual testing and edge case validation

## **Key Technical Decisions**
- **GitLab API**: Use project ID for API calls (more reliable than paths)
- **Instance URL**: Default to `https://gitlab.com`, support self-hosted
- **Authentication**: Personal Access Token in request headers
- **Branch**: User-configurable (main/master/develop)  
- **File Operations**: Map to GitLab's repository files API endpoints

## **Risk Mitigation**
- Maintain backward compatibility with existing GitHub-only configurations
- Extensive testing with both providers to ensure feature parity
- Clear error messages for GitLab-specific configuration issues
- Fallback mechanisms for API differences between providers

**Total Estimated Time**: 8-12 hours for complete implementation and testing
