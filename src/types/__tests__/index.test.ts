import { 
  ChatMessage, 
  Todo, 
  TodoFrontmatter, 
  AIResponse, 
  AIResponseWithFallback 
} from '../index';

describe('Type Definitions', () => {
  describe('ChatMessage Interface', () => {
    it('should accept valid ChatMessage with all properties', () => {
      const chatMessage: ChatMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: '2023-01-01T12:00:00.000Z',
        checkpointId: 'checkpoint-123'
      };

      expect(chatMessage.role).toBe('user');
      expect(chatMessage.content).toBe('Test message');
      expect(chatMessage.timestamp).toBe('2023-01-01T12:00:00.000Z');
      expect(chatMessage.checkpointId).toBe('checkpoint-123');
    });

    it('should accept valid ChatMessage without optional checkpointId', () => {
      const chatMessage: ChatMessage = {
        role: 'assistant',
        content: 'Assistant response',
        timestamp: '2023-01-01T12:00:00.000Z'
      };

      expect(chatMessage.role).toBe('assistant');
      expect(chatMessage.content).toBe('Assistant response');
      expect(chatMessage.checkpointId).toBeUndefined();
    });

    it('should enforce role type restrictions', () => {
      // TypeScript would catch this at compile time, but we can test runtime behavior
      const userMessage: ChatMessage = {
        role: 'user' as const,
        content: 'User message',
        timestamp: '2023-01-01T12:00:00.000Z'
      };

      const assistantMessage: ChatMessage = {
        role: 'assistant' as const,
        content: 'Assistant message',
        timestamp: '2023-01-01T12:00:00.000Z'
      };

      expect(['user', 'assistant']).toContain(userMessage.role);
      expect(['user', 'assistant']).toContain(assistantMessage.role);
    });
  });

  describe('Todo Interface', () => {
    it('should accept valid Todo with all properties', () => {
      const todo: Todo = {
        id: 'todo-123',
        title: 'Test Todo',
        content: '# Test Todo\n\n- [ ] Task 1',
        frontmatter: {
          title: 'Test Todo',
          createdAt: '2023-01-01T12:00:00.000Z',
          priority: 3,
          isArchived: false,
          chatHistory: []
        },
        path: '/todos/test.md',
        sha: 'abc123def456'
      };

      expect(todo.id).toBe('todo-123');
      expect(todo.title).toBe('Test Todo');
      expect(todo.frontmatter.priority).toBe(3);
      expect(todo.frontmatter.isArchived).toBe(false);
    });

    it('should accept Todo with optional search result properties', () => {
      const searchTodo: Todo = {
        id: 'search-todo-123',
        title: 'Search Result Todo',
        content: '# Search Result',
        frontmatter: {
          title: 'Search Result Todo',
          createdAt: '2023-01-01T12:00:00.000Z',
          priority: 1,
          isArchived: false,
          chatHistory: []
        },
        path: '/todos/search.md',
        sha: 'search123',
        isSearchResult: true,
        projectName: 'My Project'
      };

      expect(searchTodo.isSearchResult).toBe(true);
      expect(searchTodo.projectName).toBe('My Project');
    });

    it('should accept Todo with chat history', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'user',
          content: 'Add a task',
          timestamp: '2023-01-01T12:00:00.000Z'
        },
        {
          role: 'assistant',
          content: 'Task added',
          timestamp: '2023-01-01T12:01:00.000Z'
        }
      ];

      const todo: Todo = {
        id: 'todo-with-chat',
        title: 'Todo with Chat',
        content: '# Todo with Chat',
        frontmatter: {
          title: 'Todo with Chat',
          createdAt: '2023-01-01T12:00:00.000Z',
          priority: 2,
          isArchived: false,
          chatHistory
        },
        path: '/todos/chat.md',
        sha: 'chat123'
      };

      expect(todo.frontmatter.chatHistory).toHaveLength(2);
      expect(todo.frontmatter.chatHistory[0].role).toBe('user');
      expect(todo.frontmatter.chatHistory[1].role).toBe('assistant');
    });
  });

  describe('TodoFrontmatter Interface', () => {
    it('should accept valid TodoFrontmatter', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Frontmatter Test',
        createdAt: '2023-01-01T12:00:00.000Z',
        priority: 4,
        isArchived: true,
        chatHistory: []
      };

      expect(frontmatter.title).toBe('Frontmatter Test');
      expect(frontmatter.priority).toBe(4);
      expect(frontmatter.isArchived).toBe(true);
      expect(frontmatter.chatHistory).toEqual([]);
    });

    it('should handle priority number values', () => {
      const priorities = [1, 2, 3, 4, 5];
      
      priorities.forEach(priority => {
        const frontmatter: TodoFrontmatter = {
          title: `Priority ${priority} Todo`,
          createdAt: '2023-01-01T12:00:00.000Z',
          priority,
          isArchived: false,
          chatHistory: []
        };

        expect(frontmatter.priority).toBe(priority);
        expect(typeof frontmatter.priority).toBe('number');
      });
    });

    it('should handle boolean isArchived values', () => {
      const archivedFrontmatter: TodoFrontmatter = {
        title: 'Archived Todo',
        createdAt: '2023-01-01T12:00:00.000Z',
        priority: 1,
        isArchived: true,
        chatHistory: []
      };

      const activeFrontmatter: TodoFrontmatter = {
        title: 'Active Todo',
        createdAt: '2023-01-01T12:00:00.000Z',
        priority: 1,
        isArchived: false,
        chatHistory: []
      };

      expect(archivedFrontmatter.isArchived).toBe(true);
      expect(activeFrontmatter.isArchived).toBe(false);
    });
  });

  describe('AIResponse Interface', () => {
    it('should accept valid AIResponse with content and description', () => {
      const response: AIResponse = {
        content: '# Updated Todo\n\n- [x] Completed task\n- [ ] New task',
        description: 'Added a new task to the todo list'
      };

      expect(response.content).toContain('Updated Todo');
      expect(response.description).toBe('Added a new task to the todo list');
    });

    it('should enforce required properties', () => {
      const response: AIResponse = {
        content: 'Required content',
        description: 'Required description'
      };

      expect(response.content).toBeDefined();
      expect(response.description).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(typeof response.description).toBe('string');
    });
  });

  describe('AIResponseWithFallback Interface', () => {
    it('should accept AIResponseWithFallback with content and optional description', () => {
      const responseWithDesc: AIResponseWithFallback = {
        content: '# Updated Content',
        description: 'Optional description present'
      };

      const responseWithoutDesc: AIResponseWithFallback = {
        content: '# Updated Content'
      };

      expect(responseWithDesc.content).toBe('# Updated Content');
      expect(responseWithDesc.description).toBe('Optional description present');
      expect(responseWithoutDesc.content).toBe('# Updated Content');
      expect(responseWithoutDesc.description).toBeUndefined();
    });

    it('should handle backward compatibility scenarios', () => {
      // Simulating responses from different AI service versions
      const modernResponse: AIResponseWithFallback = {
        content: 'Modern response content',
        description: 'Modern response description'
      };

      const legacyResponse: AIResponseWithFallback = {
        content: 'Legacy response content'
        // No description property for backward compatibility
      };

      expect(modernResponse.description).toBeDefined();
      expect(legacyResponse.description).toBeUndefined();
      expect(modernResponse.content).toBeDefined();
      expect(legacyResponse.content).toBeDefined();
    });

    it('should be compatible with AIResponse interface', () => {
      // AIResponseWithFallback should be assignable to AIResponse when description is present
      const responseWithDesc: AIResponseWithFallback = {
        content: 'Test content',
        description: 'Test description'
      };

      // This should work without type errors
      const asAIResponse: AIResponse = {
        content: responseWithDesc.content,
        description: responseWithDesc.description || 'Default description'
      };

      expect(asAIResponse.content).toBe('Test content');
      expect(asAIResponse.description).toBe('Test description');
    });
  });

  describe('Type Compatibility and Integration', () => {
    it('should demonstrate proper usage of all types together', () => {
      const chatHistory: ChatMessage[] = [
        {
          role: 'user',
          content: 'Please add a task for testing',
          timestamp: '2023-01-01T12:00:00.000Z'
        }
      ];

      const frontmatter: TodoFrontmatter = {
        title: 'Integration Test Todo',
        createdAt: '2023-01-01T12:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory
      };

      const todo: Todo = {
        id: 'integration-test',
        title: frontmatter.title,
        content: '# Integration Test\n\n- [ ] Test task',
        frontmatter,
        path: '/todos/integration.md',
        sha: 'integration123'
      };

      const aiResponse: AIResponse = {
        content: '# Integration Test\n\n- [ ] Test task\n- [ ] Added task',
        description: 'Added a new task for testing'
      };

      const fallbackResponse: AIResponseWithFallback = {
        content: aiResponse.content,
        description: aiResponse.description
      };

      expect(todo.frontmatter.chatHistory).toHaveLength(1);
      expect(aiResponse.description).toContain('testing');
      expect(fallbackResponse.content).toBe(aiResponse.content);
    });
  });
});