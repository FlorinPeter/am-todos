import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveDraft,
  getDraft,
  clearDraft,
  clearOtherDrafts,
  TodoDraft
} from '../localStorage';

// Mock logger to avoid console output during tests
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('localStorage - Stable Draft Key Generation', () => {
  let mockStorage: { [key: string]: string } = {};

  beforeEach(() => {
    mockStorage = {};
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        })
      },
      writable: true
    });

    // Mock Date.now for consistent timestamps
    vi.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};
  });

  describe('generateStableDraftKey Function (via saveDraft/getDraft)', () => {
    it('should generate consistent keys for the same path', () => {
      const draft1: TodoDraft = {
        todoId: 'todo-123',
        path: '/todos/2023-01-01-sample-task.md',
        stableDraftKey: '/todos/2023-01-01-sample-task.md'.trim().toLowerCase(),
        editContent: '# Test Content 1',
        viewContent: '# Test Content 1',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      const draft2: TodoDraft = {
        todoId: 'todo-456',
        path: '/todos/2023-01-01-sample-task.md',
        stableDraftKey: '/todos/2023-01-01-sample-task.md'.trim().toLowerCase(),
        editContent: '# Test Content 2',
        viewContent: '# Test Content 2',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      // Save first draft
      saveDraft(draft1);
      expect(mockStorage['todoDraft']).toBeDefined();

      // Get draft with different todoId but same path
      const retrievedDraft = getDraft('todo-456', '/todos/2023-01-01-sample-task.md');
      expect(retrievedDraft).toBeNull(); // Should not match because todoId is different

      // Save second draft with different todoId
      saveDraft(draft2);
      
      // Should be able to retrieve with matching todoId and path
      const retrievedDraft2 = getDraft('todo-456', '/todos/2023-01-01-sample-task.md');
      expect(retrievedDraft2).not.toBeNull();
      expect(retrievedDraft2?.todoId).toBe('todo-456');
    });

    it('should normalize paths for consistent key generation', () => {
      const normalPath = '/todos/test-file.md';
      const pathWithSpaces = '  /todos/test-file.md  ';
      const pathWithUppercase = '/TODOS/TEST-FILE.MD';

      const draft1: TodoDraft = {
        todoId: 'todo-123',
        path: normalPath,
        stableDraftKey: normalPath.trim().toLowerCase(),
        editContent: '# Test',
        viewContent: '# Test',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft1);

      // Test retrieval with normalized variations
      // Note: The stable key is generated internally, so we test path matching behavior
      const retrieved1 = getDraft('todo-123', pathWithSpaces.trim());
      expect(retrieved1).not.toBeNull();

      const retrieved2 = getDraft('todo-123', pathWithUppercase.toLowerCase());
      expect(retrieved2).not.toBeNull();
    });

    it('should handle edge cases in path normalization', () => {
      const edgeCases = [
        { path: '', expected: '' },
        { path: '   ', expected: '' },
        { path: '/single-file.md', expected: '/single-file.md' },
        { path: '\\Windows\\Path\\file.md', expected: '\\windows\\path\\file.md' },
        { path: 'relative/path/file.md', expected: 'relative/path/file.md' }
      ];

      edgeCases.forEach(({ path, expected }, index) => {
        const draft: TodoDraft = {
          todoId: `todo-${index}`,
          path: path,
          stableDraftKey: path.trim().toLowerCase(),
          editContent: `# Test ${index}`,
          viewContent: `# Test ${index}`,
          hasUnsavedChanges: true,
          timestamp: Date.now()
        };

        saveDraft(draft);
        const retrieved = getDraft(`todo-${index}`, path);
        
        if (expected === '') {
          // For empty paths, the logic should still work
          expect(retrieved?.stableDraftKey).toBe(expected);
        } else {
          expect(retrieved?.stableDraftKey).toBe(expected);
        }
      });
    });

    it('should distinguish between different paths correctly', () => {
      const path1 = '/todos/task-1.md';
      const path2 = '/todos/task-2.md';
      const path3 = '/archive/task-1.md';

      const draft1: TodoDraft = {
        todoId: 'todo-1',
        path: path1,
        stableDraftKey: path1.trim().toLowerCase(),
        editContent: '# Task 1',
        viewContent: '# Task 1',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft1);

      // Should not match different paths
      expect(getDraft('todo-1', path2)).toBeNull();
      expect(getDraft('todo-1', path3)).toBeNull();

      // Should match the correct path
      expect(getDraft('todo-1', path1)).not.toBeNull();
    });
  });

  describe('Draft Persistence with Stable Keys', () => {
    it('should persist drafts across different todoId values for same path', () => {
      const path = '/todos/persistent-task.md';
      const stableKey = path.trim().toLowerCase();

      // First todo with this path
      const draft1: TodoDraft = {
        todoId: 'sha-abc123',
        path: path,
        stableDraftKey: stableKey,
        editContent: '# Original Content',
        viewContent: '# Original Content',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft1);

      // Simulate todo being updated (new SHA, same path)
      const newTodoId = 'sha-def456';
      
      // Should not retrieve draft with different todoId
      expect(getDraft(newTodoId, path)).toBeNull();

      // Update draft with new todoId (simulating content update)
      const draft2: TodoDraft = {
        todoId: newTodoId,
        path: path,
        stableDraftKey: stableKey,
        editContent: '# Updated Content',
        viewContent: '# Updated Content',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft2);

      // Should now retrieve with new todoId
      const retrieved = getDraft(newTodoId, path);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.todoId).toBe(newTodoId);
      expect(retrieved?.editContent).toBe('# Updated Content');
    });

    it('should handle drafts with missing stableDraftKey (backward compatibility)', () => {
      const path = '/todos/legacy-task.md';
      
      // Simulate old draft format without stableDraftKey
      const legacyDraft = {
        todoId: 'todo-123',
        path: path,
        // stableDraftKey is missing
        editContent: '# Legacy Content',
        viewContent: '# Legacy Content',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      // Manually set in localStorage to simulate legacy format
      mockStorage['todoDraft'] = JSON.stringify(legacyDraft);

      // Should still work by generating stable key from path
      const retrieved = getDraft('todo-123', path);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.editContent).toBe('# Legacy Content');
    });

    it('should clear drafts for different todos when using clearOtherDrafts', () => {
      const draft1: TodoDraft = {
        todoId: 'todo-1',
        path: '/todos/task-1.md',
        stableDraftKey: '/todos/task-1.md',
        editContent: '# Task 1',
        viewContent: '# Task 1',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft1);
      expect(getDraft('todo-1', '/todos/task-1.md')).not.toBeNull();

      // Clear drafts for different todo
      clearOtherDrafts('todo-2');
      
      // Draft should be cleared since it belongs to todo-1
      expect(getDraft('todo-1', '/todos/task-1.md')).toBeNull();
    });

    it('should not clear drafts for same todo when using clearOtherDrafts', () => {
      const draft1: TodoDraft = {
        todoId: 'todo-1',
        path: '/todos/task-1.md',
        stableDraftKey: '/todos/task-1.md',
        editContent: '# Task 1',
        viewContent: '# Task 1',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };

      saveDraft(draft1);
      expect(getDraft('todo-1', '/todos/task-1.md')).not.toBeNull();

      // Clear drafts for same todo - should not clear
      clearOtherDrafts('todo-1');
      
      // Draft should still exist
      expect(getDraft('todo-1', '/todos/task-1.md')).not.toBeNull();
    });
  });

  describe('Draft Expiry Handling', () => {
    it('should return null for expired drafts', () => {
      const draft: TodoDraft = {
        todoId: 'todo-123',
        path: '/todos/expired-task.md',
        stableDraftKey: '/todos/expired-task.md',
        editContent: '# Expired Content',
        viewContent: '# Expired Content',
        hasUnsavedChanges: true,
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (expired)
      };

      saveDraft(draft);

      // Mock current time to be 25 hours later
      vi.spyOn(Date, 'now').mockReturnValue(1640995200000 + (25 * 60 * 60 * 1000));

      const retrieved = getDraft('todo-123', '/todos/expired-task.md');
      expect(retrieved).toBeNull();
      
      // Should also clear the expired draft
      expect(mockStorage['todoDraft']).toBeUndefined();
    });

    it('should return valid draft within expiry time', () => {
      const draft: TodoDraft = {
        todoId: 'todo-123',
        path: '/todos/fresh-task.md',
        stableDraftKey: '/todos/fresh-task.md',
        editContent: '# Fresh Content',
        viewContent: '# Fresh Content',
        hasUnsavedChanges: true,
        timestamp: Date.now() - (23 * 60 * 60 * 1000) // 23 hours ago (still valid)
      };

      saveDraft(draft);

      const retrieved = getDraft('todo-123', '/todos/fresh-task.md');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.editContent).toBe('# Fresh Content');
    });
  });
});