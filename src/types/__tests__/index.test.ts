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
          tags: []
        },
        path: '/todos/test.md',
        sha: 'abc123def456',
        priority: 3,
        createdAt: '2023-01-01T12:00:00.000Z',
        isArchived: false
      };

      expect(todo.id).toBe('todo-123');
      expect(todo.title).toBe('Test Todo');
      expect(todo.priority).toBe(3);
      expect(todo.isArchived).toBe(false);
    });

    it('should accept Todo with optional search result properties', () => {
      const searchTodo: Todo = {
        id: 'search-todo-123',
        title: 'Search Result Todo',
        content: '# Search Result',
        frontmatter: {
          tags: []
        },
        path: '/todos/search.md',
        sha: 'search123',
        priority: 1,
        createdAt: '2023-01-01T12:00:00.000Z',
        isArchived: false,
        isSearchResult: true,
        projectName: 'My Project'
      };

      expect(searchTodo.isSearchResult).toBe(true);
      expect(searchTodo.projectName).toBe('My Project');
    });

    it('should accept Todo with tags', () => {
      const todo: Todo = {
        id: 'todo-with-tags',
        title: 'Todo with Tags',
        content: '# Todo with Tags',
        frontmatter: {
          tags: ['work', 'urgent']
        },
        path: '/todos/tagged.md',
        sha: 'tagged123',
        priority: 2,
        createdAt: '2023-01-01T12:00:00.000Z',
        isArchived: false
      };

      expect(todo.frontmatter.tags).toHaveLength(2);
      expect(todo.frontmatter.tags[0]).toBe('work');
      expect(todo.frontmatter.tags[1]).toBe('urgent');
    });
  });

  describe('TodoFrontmatter Interface', () => {
    it('should accept valid TodoFrontmatter with tags', () => {
      const frontmatter: TodoFrontmatter = {
        tags: ['work', 'urgent', 'feature']
      };

      expect(frontmatter.tags).toEqual(['work', 'urgent', 'feature']);
      expect(Array.isArray(frontmatter.tags)).toBe(true);
    });

    it('should handle empty tags array', () => {
      const frontmatter: TodoFrontmatter = {
        tags: []
      };

      expect(frontmatter.tags).toEqual([]);
      expect(frontmatter.tags).toHaveLength(0);
    });

    it('should handle string tags', () => {
      const tags = ['bug-fix', 'high-priority', 'client-work'];
      const frontmatter: TodoFrontmatter = {
        tags
      };

      expect(frontmatter.tags).toBe(tags);
      expect(frontmatter.tags).toContain('bug-fix');
      expect(frontmatter.tags).toContain('high-priority');
      expect(frontmatter.tags).toContain('client-work');
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
      
      // Verify ChatMessage type structure
      expect(chatHistory[0].role).toBe('user');

      const frontmatter: TodoFrontmatter = {
        tags: ['integration']
      };

      const todo: Todo = {
        id: 'integration-test',
        title: 'Integration Test Todo',
        createdAt: '2023-01-01T12:00:00.000Z',
        priority: 3,
        isArchived: false,
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

      expect(todo.frontmatter.tags).toContain('integration');
      expect(aiResponse.description).toContain('testing');
      expect(fallbackResponse.content).toBe(aiResponse.content);
    });
  });
});