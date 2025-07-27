/**
 * Centralized Type Definitions
 * 
 * This file contains all shared interfaces and types used across the application.
 * Previously, these were duplicated across multiple components.
 */

/**
 * Chat message interface for the AI chat component.
 * Used in: AIChat
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  checkpointId?: string;
}

/**
 * Todo item interface - Updated for filename-based metadata
 * Used in: TodoSidebar, TodoEditor
 */
export interface Todo {
  id: string;
  title: string;        // Extracted from filename
  content: string;
  frontmatter: {
    tags: string[];     // Only tags remain in frontmatter
  };
  path: string;
  sha: string;
  // Metadata now from filename instead of frontmatter
  priority: number;     // Extracted from filename
  createdAt: string;    // Extracted from filename
  isArchived: boolean;  // Determined by folder location
  // Optional fields used for search results
  isSearchResult?: boolean;
  projectName?: string;
}

/**
 * Todo frontmatter interface - Simplified for filename-based metadata
 * Used in: markdown utils
 */
export interface TodoFrontmatter {
  tags: string[];  // Only tags field remains - provides extensibility
  // REMOVED: title, createdAt, priority, isArchived (now in filename)
  // REMOVED: chatHistory (unused code)
}

/**
 * AI response interface for structured output
 * Used in: aiService, AIChat
 */
export interface AIResponse {
  content: string;
  description: string;
}

/**
 * AI response with fallback for backward compatibility
 * Used in: aiService when parsing potentially unstructured responses
 */
export interface AIResponseWithFallback {
  content: string;
  description?: string;
}

/**
 * Commit message response interface for structured output
 * Used in: aiService, generateCommitMessage
 */
export interface CommitMessageResponse {
  message: string;
  description: string;
}

/**
 * Commit message response with fallback for backward compatibility
 * Used in: aiService when parsing potentially unstructured commit message responses
 */
export interface CommitMessageResponseWithFallback {
  message: string;
  description?: string;
}

/**
 * New todo creation data interface
 * Used in: NewTodoInput, App.tsx handleGoalSubmit
 */
export interface NewTodoData {
  title: string;
  description?: string;
  template?: string;
}

/**
 * Todo template interface for guided AI generation
 * Used in: NewTodoInput, server templates system
 */
export interface TodoTemplate {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'project' | 'bugfix' | 'feature' | 'research' | 'personal';
  systemPrompt: string;
}

/**
 * AI generation response with title and content
 * Used in: aiService generateInitialPlan for structured JSON responses
 */
export interface PlanGenerationResponse {
  title: string;
  content: string;
}