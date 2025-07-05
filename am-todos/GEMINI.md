# Agentic Markdown Todos - Gemini CLI Implementation

This document outlines the implementation details and setup instructions for the "Agentic Markdown Todos" application, as developed by the Gemini CLI agent.

## 1. Vision & Core Concept

**Agentic Markdown Todos** is a smart todo application designed for developers, project managers, and anyone who prefers a Git-based, markdown-first workflow. It transforms a standard GitHub repository into a powerful, intelligent task management system. The core vision is to merge the simplicity and control of plain text files with the power of modern AI.

## 2. Architecture & Tech Stack

The application is a single-page application (SPA) that communicates with two main external services: the GitHub API and a serverless function (simulated locally by a Node.js Express server) that proxies requests to the Google Gemini API.

### Frontend
*   **Framework:** React (with Hooks)
*   **Language:** TypeScript
*   **Styling:** TailwindCSS
*   **Markdown:** `react-markdown` with `remark-gfm` for GitHub-Flavored Markdown rendering.
*   **API Client:** Native `fetch` API for all HTTP requests.

### Backend / Services
*   **AI Model:** Google Gemini (`gemini-2.5-flash`) is used for all intelligent features.
*   **AI Proxy (`/api/gemini`):** A Node.js Express server (located in the `server/` directory) acts as a secure backend.
    *   **Purpose:** It holds the `API_KEY` for the Gemini API as a secure environment variable. The frontend *never* has access to this key.
    *   **Functionality:** It receives requests from the frontend specifying an `action` (e.g., `generateInitialPlan`) and a `payload`. It then constructs the appropriate system prompt and user prompt, calls the Gemini API, and returns the text response to the client.
*   **Data Storage (Source of Truth):** A user-provided GitHub Repository.
    *   The application interacts directly with the GitHub REST API from the client-side for all file-based operations (reading, creating, updating, deleting files).

## 3. Setup and Running the Application

### Prerequisites
*   Node.js and npm installed.
*   A GitHub Personal Access Token (PAT) with `contents` read/write access to your designated todo repository.
*   A Google Gemini API Key.

### Steps

1.  **Navigate to the project directory:**
    ```bash
    cd /root/todo/am-todos
    ```

2.  **Install Frontend Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Tailwind CSS:**
    The `tailwind.config.js` and `postcss.config.js` files have been created and configured. The Tailwind directives have been added to `src/index.css`.

4.  **Configure AI Proxy Server:**
    *   Navigate to the server directory:
        ```bash
        cd server
        ```
    *   Install server dependencies:
        ```bash
        npm install
        ```
    *   Create a `.env` file in the `server/` directory:
        ```
        GEMINI_API_KEY=YOUR_GEMINI_API_KEY
        ```
        Replace `YOUR_GEMINI_API_KEY` with your actual Google Gemini API key.

5.  **Start the AI Proxy Server (in background):**
    From the `server/` directory:
    ```bash
    npm start &
    ```
    This will start the Node.js server, which listens on `http://localhost:3001`. The frontend is configured to proxy `/api` requests to this address.

6.  **Start the React Frontend:**
    Navigate back to the root of the `am-todos` directory:
    ```bash
    cd ..
    npm start
    ```
    This will open the application in your web browser (usually `http://localhost:3000`).

7.  **Configure GitHub Settings in the Application:**
    Upon first launch, the application will prompt you to enter your GitHub Personal Access Token (PAT), Repository Owner (your GitHub username or organization), and Repository Name. These settings are stored locally in your browser's `localStorage`.

## 4. Security Considerations

*   **Gemini API Key:** The key is stored securely as a server-side environment variable in the serverless function environment (simulated by the Node.js server). It is **never** exposed to the client, preventing unauthorized use.
*   **GitHub Personal Access Token (PAT):**
    *   The PAT is stored in the browser's `localStorage`. This means it is sandboxed to the application's origin and is not accessible by other websites.
    *   The application only sends the PAT directly to the `api.github.com` domain over HTTPS.
    *   Users are instructed to create a **fine-grained PAT** with permissions restricted to *only* the specific repository used for the app, minimizing potential exposure if the token were ever compromised.
