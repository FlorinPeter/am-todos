import { vi, describe, it, expect, beforeEach } from 'vitest';

// Create a proper localStorage mock
const createLocalStorageMock = () => {
  const store = {} as Record<string, string>;
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get store() { return store; }
  };
};

const mockLocalStorage = createLocalStorageMock();

// Mock the global localStorage
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Now import the functions
import { saveSelectedTodoId, loadSelectedTodoId, clearSelectedTodoId } from '../utils/localStorage';

describe('Selected Todo Persistence', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Basic Persistence Operations', () => {
    it('should save and load selected todo ID', () => {
      const testTodoId = 'test-todo-123';
      
      // Save todo ID
      saveSelectedTodoId(testTodoId);
      
      // Load todo ID
      const loadedTodoId = loadSelectedTodoId();
      
      expect(loadedTodoId).toBe(testTodoId);
    });

    it('should handle null values correctly', () => {
      // Save null should clear the storage
      saveSelectedTodoId(null);
      
      const loadedTodoId = loadSelectedTodoId();
      
      expect(loadedTodoId).toBeNull();
    });

    it('should clear selected todo ID', () => {
      const testTodoId = 'test-todo-456';
      
      // Save todo ID first
      saveSelectedTodoId(testTodoId);
      expect(loadSelectedTodoId()).toBe(testTodoId);
      
      // Clear todo ID
      clearSelectedTodoId();
      
      // Should return null after clearing
      expect(loadSelectedTodoId()).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return null when no todo ID is stored', () => {
      const loadedTodoId = loadSelectedTodoId();
      expect(loadedTodoId).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw an error
      expect(() => saveSelectedTodoId('test-todo')).not.toThrow();

      // Restore original implementation
      localStorage.setItem = originalSetItem;
    });
  });

  describe('Auto-Selection Logic Simulation', () => {
    it('should simulate the selection priority logic', () => {
      const mockTodos = [
        { id: 'todo-1', title: 'First Todo' },
        { id: 'todo-2', title: 'Second Todo' },
        { id: 'todo-3', title: 'Third Todo' }
      ];

      // Test scenario: Page reload with persisted selection
      saveSelectedTodoId('todo-2');
      const persistedTodoId = loadSelectedTodoId();
      const persistedTodo = mockTodos.find(todo => todo.id === persistedTodoId);
      
      expect(persistedTodo).toBeDefined();
      expect(persistedTodo?.id).toBe('todo-2');
    });

    it('should verify localStorage integration works', () => {
      // Test that our functions interact with localStorage correctly
      const testId = 'integration-test-todo';
      
      saveSelectedTodoId(testId);
      
      // Verify direct localStorage access
      expect(mockLocalStorage.store['selectedTodoId']).toBe(testId);
      
      // Verify our load function
      expect(loadSelectedTodoId()).toBe(testId);
      
      // Test clearing
      clearSelectedTodoId();
      expect(mockLocalStorage.store['selectedTodoId']).toBeUndefined();
      expect(loadSelectedTodoId()).toBeNull();
    });
  });

  describe('Project Switching Simulation', () => {
    it('should handle project switching workflow', () => {
      const project1TodoId = 'project1-todo-123';
      const project2TodoId = 'project2-todo-456';

      // User works in project 1
      saveSelectedTodoId(project1TodoId);
      expect(loadSelectedTodoId()).toBe(project1TodoId);

      // User switches to project 2 - should clear selection
      clearSelectedTodoId();
      expect(loadSelectedTodoId()).toBeNull();

      // User selects todo in project 2
      saveSelectedTodoId(project2TodoId);
      expect(loadSelectedTodoId()).toBe(project2TodoId);

      // Switch back to project 1 - should clear again
      clearSelectedTodoId();
      expect(loadSelectedTodoId()).toBeNull();
    });
  });
});