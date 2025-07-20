import { describe, it, expect } from 'vitest';
import { ChatMessage, Todo, TodoFrontmatter } from '../index';

describe('Centralized Types', () => {
  describe('ChatMessage interface', () => {
    it('should properly type ChatMessage objects', () => {
      const chatMessage: ChatMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      expect(chatMessage.role).toBe('user');
      expect(chatMessage.content).toBe('Test message');
      expect(chatMessage.timestamp).toBe('2023-01-01T00:00:00.000Z');
      expect(chatMessage.checkpointId).toBeUndefined();
    });

    it('should support optional checkpointId field', () => {
      const chatMessageWithCheckpoint: ChatMessage = {
        role: 'assistant',
        content: 'AI response',
        timestamp: '2023-01-01T00:00:00.000Z',
        checkpointId: 'checkpoint_123'
      };

      expect(chatMessageWithCheckpoint.checkpointId).toBe('checkpoint_123');
    });

    it('should enforce role type constraints', () => {
      const userMessage: ChatMessage = {
        role: 'user' as const,
        content: 'User message',
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      const assistantMessage: ChatMessage = {
        role: 'assistant' as const,
        content: 'Assistant message',
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      expect(userMessage.role).toBe('user');
      expect(assistantMessage.role).toBe('assistant');
    });
  });

  describe('Todo interface', () => {
    it('should properly type Todo objects', () => {
      const todo: Todo = {
        id: 'todo-123',
        title: 'Test Todo',
        content: '# Test Content\n\n- [ ] Task 1',
        frontmatter: {
          title: 'Test Todo',
          createdAt: '2023-01-01T00:00:00.000Z',
          priority: 3,
          isArchived: false,
          chatHistory: []
        },
        path: 'todos/test-todo.md',
        sha: 'abc123'
      };

      expect(todo.id).toBe('todo-123');
      expect(todo.title).toBe('Test Todo');
      expect(todo.frontmatter.priority).toBe(3);
      expect(todo.frontmatter.isArchived).toBe(false);
      expect(todo.frontmatter.chatHistory).toEqual([]);
    });

    it('should support optional search result fields', () => {
      const searchResultTodo: Todo = {
        id: 'search-123',
        title: 'Search Result',
        content: 'Content',
        frontmatter: {
          title: 'Search Result',
          createdAt: '2023-01-01T00:00:00.000Z',
          priority: 2,
          isArchived: false,
          chatHistory: []
        },
        path: 'project/todo.md',
        sha: 'def456',
        isSearchResult: true,
        projectName: 'project'
      };

      expect(searchResultTodo.isSearchResult).toBe(true);
      expect(searchResultTodo.projectName).toBe('project');
    });

    it('should properly type frontmatter with chat history', () => {
      const todoWithChat: Todo = {
        id: 'todo-chat',
        title: 'Todo with Chat',
        content: 'Content',
        frontmatter: {
          title: 'Todo with Chat',
          createdAt: '2023-01-01T00:00:00.000Z',
          priority: 1,
          isArchived: false,
          chatHistory: [
            {
              role: 'user',
              content: 'Add a task',
              timestamp: '2023-01-01T00:00:00.000Z'
            },
            {
              role: 'assistant',
              content: 'Task added',
              timestamp: '2023-01-01T00:01:00.000Z',
              checkpointId: 'checkpoint_456'
            }
          ]
        },
        path: 'todos/chat-todo.md',
        sha: 'ghi789'
      };

      expect(todoWithChat.frontmatter.chatHistory).toHaveLength(2);
      expect(todoWithChat.frontmatter.chatHistory[0].role).toBe('user');
      expect(todoWithChat.frontmatter.chatHistory[1].checkpointId).toBe('checkpoint_456');
    });
  });

  describe('TodoFrontmatter interface', () => {
    it('should properly type TodoFrontmatter objects', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Frontmatter Test',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 4,
        isArchived: true,
        chatHistory: []
      };

      expect(frontmatter.title).toBe('Frontmatter Test');
      expect(frontmatter.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(frontmatter.priority).toBe(4);
      expect(frontmatter.isArchived).toBe(true);
      expect(frontmatter.chatHistory).toEqual([]);
    });

    it('should support different priority levels', () => {
      const priorities = [1, 2, 3, 4, 5];
      
      priorities.forEach(priority => {
        const frontmatter: TodoFrontmatter = {
          title: `Priority ${priority} Task`,
          createdAt: '2023-01-01T00:00:00.000Z',
          priority: priority,
          isArchived: false,
          chatHistory: []
        };

        expect(frontmatter.priority).toBe(priority);
      });
    });

    it('should properly type complex chat history in frontmatter', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Complex Chat History',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 2,
        isArchived: false,
        chatHistory: [
          {
            role: 'user',
            content: 'Create a complex task',
            timestamp: '2023-01-01T00:00:00.000Z'
          },
          {
            role: 'assistant',
            content: 'Task created with multiple steps',
            timestamp: '2023-01-01T00:01:00.000Z',
            checkpointId: 'checkpoint_complex'
          },
          {
            role: 'user',
            content: 'Add more details',
            timestamp: '2023-01-01T00:02:00.000Z'
          }
        ]
      };

      expect(frontmatter.chatHistory).toHaveLength(3);
      expect(frontmatter.chatHistory[1].checkpointId).toBe('checkpoint_complex');
      expect(frontmatter.chatHistory[2].checkpointId).toBeUndefined();
    });
  });

  describe('Type consistency', () => {
    it('should maintain consistency between Todo frontmatter and TodoFrontmatter interface', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Consistency Test',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: [
          {
            role: 'user',
            content: 'Test consistency',
            timestamp: '2023-01-01T00:00:00.000Z'
          }
        ]
      };

      const todo: Todo = {
        id: 'consistency-test',
        title: 'Consistency Test',
        content: 'Test content',
        frontmatter: frontmatter, // Should be assignable
        path: 'todos/test.md',
        sha: 'jkl012'
      };

      expect(todo.frontmatter).toEqual(frontmatter);
    });
  });
});