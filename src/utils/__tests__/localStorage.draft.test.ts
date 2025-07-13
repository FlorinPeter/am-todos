import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock logger to avoid console output during tests
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking logger
import { 
  saveDraft, 
  getDraft, 
  clearDraft, 
  clearOtherDrafts, 
  TodoDraft 
} from '../localStorage';

describe('Draft Persistence', () => {
  const mockTodoId = 'sha-123456';
  const mockPath = '/todos/2025-01-05-test-task.md';
  const mockEditContent = '# Test Task\n\n- [ ] First item\n- [x] Completed item';
  const mockViewContent = '# Test Task\n\n- [x] First item\n- [x] Completed item';

  const mockDraft: TodoDraft = {
    todoId: mockTodoId,
    path: mockPath,
    editContent: mockEditContent,
    viewContent: mockViewContent,
    hasUnsavedChanges: true,
    timestamp: Date.now()
  };

  // Create a working localStorage implementation for tests
  let mockStorage: { [key: string]: string } = {};

  beforeEach(() => {
    // Clear mock storage
    mockStorage = {};
    
    // Replace localStorage with working implementation
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => { mockStorage[key] = value; },
        removeItem: (key: string) => { delete mockStorage[key]; },
        clear: () => { mockStorage = {}; },
      },
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    mockStorage = {};
  });

  describe('saveDraft', () => {
    it('should save draft to localStorage', () => {
      saveDraft(mockDraft);

      const saved = localStorage.getItem('todoDraft');
      expect(saved).toBeTruthy();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.todoId).toBe(mockTodoId);
      expect(parsed.path).toBe(mockPath);
      expect(parsed.editContent).toBe(mockEditContent);
      expect(parsed.viewContent).toBe(mockViewContent);
      expect(parsed.hasUnsavedChanges).toBe(true);
      expect(parsed.timestamp).toBeTypeOf('number');
    });

    it('should overwrite existing draft when saving new one', () => {
      // Save first draft
      saveDraft(mockDraft);

      // Save second draft with different content
      const newDraft = {
        ...mockDraft,
        todoId: 'sha-different',
        editContent: 'Different content'
      };
      saveDraft(newDraft);

      const saved = localStorage.getItem('todoDraft');
      const parsed = JSON.parse(saved!);
      expect(parsed.todoId).toBe('sha-different');
      expect(parsed.editContent).toBe('Different content');
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw error
      expect(() => saveDraft(mockDraft)).not.toThrow();

      // Restore original method
      localStorage.setItem = originalSetItem;
    });
  });

  describe('getDraft', () => {
    it('should return null when no draft exists', () => {
      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBe(null);
    });

    it('should return draft when it exists and matches todo', () => {
      saveDraft(mockDraft);

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBeTruthy();
      expect(result!.todoId).toBe(mockTodoId);
      expect(result!.path).toBe(mockPath);
      expect(result!.editContent).toBe(mockEditContent);
      expect(result!.viewContent).toBe(mockViewContent);
      expect(result!.hasUnsavedChanges).toBe(true);
    });

    it('should return null when todoId does not match', () => {
      saveDraft(mockDraft);

      const result = getDraft('different-id', mockPath);
      expect(result).toBe(null);
    });

    it('should return null when path does not match', () => {
      saveDraft(mockDraft);

      const result = getDraft(mockTodoId, '/different/path.md');
      expect(result).toBe(null);
    });

    it('should return null and clear expired draft', () => {
      // Create expired draft (25 hours old)
      const expiredDraft = {
        ...mockDraft,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      localStorage.setItem('todoDraft', JSON.stringify(expiredDraft));

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBe(null);

      // Should have cleared the expired draft
      expect(localStorage.getItem('todoDraft')).toBe(null);
    });

    it('should handle localStorage parse errors gracefully', () => {
      // Store invalid JSON
      localStorage.setItem('todoDraft', 'invalid-json');

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBe(null);
    });
  });

  describe('clearDraft', () => {
    it('should clear existing draft', () => {
      saveDraft(mockDraft);
      expect(localStorage.getItem('todoDraft')).toBeTruthy();

      clearDraft();
      expect(localStorage.getItem('todoDraft')).toBe(null);
    });

    it('should handle clearing when no draft exists', () => {
      expect(() => clearDraft()).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Storage error');
      });

      expect(() => clearDraft()).not.toThrow();

      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('clearOtherDrafts', () => {
    it('should clear draft when it belongs to different todo', () => {
      saveDraft(mockDraft);
      expect(localStorage.getItem('todoDraft')).toBeTruthy();

      clearOtherDrafts('different-todo-id');
      expect(localStorage.getItem('todoDraft')).toBe(null);
    });

    it('should not clear draft when it belongs to current todo', () => {
      saveDraft(mockDraft);
      expect(localStorage.getItem('todoDraft')).toBeTruthy();

      clearOtherDrafts(mockTodoId);
      expect(localStorage.getItem('todoDraft')).toBeTruthy();
    });

    it('should handle when no draft exists', () => {
      expect(() => clearOtherDrafts('any-id')).not.toThrow();
    });

    it('should handle localStorage parse errors gracefully', () => {
      localStorage.setItem('todoDraft', 'invalid-json');
      expect(() => clearOtherDrafts('any-id')).not.toThrow();
    });
  });

  describe('Draft expiry', () => {
    it('should preserve draft within 24 hours', () => {
      const recentDraft = {
        ...mockDraft,
        timestamp: Date.now() - (23 * 60 * 60 * 1000) // 23 hours ago
      };
      
      localStorage.setItem('todoDraft', JSON.stringify(recentDraft));

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBeTruthy();
      expect(result!.todoId).toBe(mockTodoId);
    });

    it('should clear draft after 24 hours', () => {
      const expiredDraft = {
        ...mockDraft,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      localStorage.setItem('todoDraft', JSON.stringify(expiredDraft));

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBe(null);
      expect(localStorage.getItem('todoDraft')).toBe(null);
    });
  });

  describe('Edge cases', () => {
    it('should handle draft with missing properties', () => {
      const incompleteDraft = {
        todoId: mockTodoId,
        path: mockPath,
        // Missing other properties
      };
      
      localStorage.setItem('todoDraft', JSON.stringify(incompleteDraft));

      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBeTruthy();
      // Should still return the object even if incomplete
      expect(result!.todoId).toBe(mockTodoId);
      expect(result!.path).toBe(mockPath);
    });

    it('should handle very large draft content', () => {
      const largeDraft = {
        ...mockDraft,
        editContent: 'x'.repeat(10000), // 10KB of content
        viewContent: 'y'.repeat(10000)
      };

      expect(() => saveDraft(largeDraft)).not.toThrow();
      
      const result = getDraft(mockTodoId, mockPath);
      expect(result).toBeTruthy();
      expect(result!.editContent).toHaveLength(10000);
    });

    it('should handle special characters in content', () => {
      const specialDraft = {
        ...mockDraft,
        editContent: '# Test 🚀\n\n- [ ] Task with émojis and àccénts\n- [x] ✅ Done',
        path: '/todos/2025-01-05-tâsk-with-spéciàl-chars.md'
      };

      saveDraft(specialDraft);
      
      const result = getDraft(mockTodoId, specialDraft.path);
      expect(result).toBeTruthy();
      expect(result!.editContent).toContain('🚀');
      expect(result!.editContent).toContain('émojis');
      expect(result!.path).toContain('spéciàl');
    });
  });
});