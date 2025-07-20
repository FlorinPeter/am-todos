/**
 * Centralized Type Definitions
 * 
 * This file contains all shared interfaces and types used across the application.
 * Previously, these were duplicated across multiple components.
 */

/**
 * Chat message interface for AI interactions
 * Used in: TodoSidebar, TodoEditor, AIChat, localStorage
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  checkpointId?: string; // Optional link to checkpoint for AI responses
}

/**
 * Todo item interface
 * Used in: TodoSidebar, TodoEditor
 */
export interface Todo {
  id: string;
  title: string;
  content: string;
  frontmatter: {
    title: string;
    createdAt: string;
    priority: number;
    isArchived: boolean;
    chatHistory: ChatMessage[];
  };
  path: string;
  sha: string;
  // Optional fields used for search results
  isSearchResult?: boolean;
  projectName?: string;
}

/**
 * Todo frontmatter interface for markdown parsing
 * Used in: markdown utils
 */
export interface TodoFrontmatter {
  title: string;
  createdAt: string;
  priority: number;
  isArchived: boolean;
  chatHistory: ChatMessage[];
}