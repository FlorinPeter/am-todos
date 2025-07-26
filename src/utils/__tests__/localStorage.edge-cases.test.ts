/**
 * localStorage Edge Cases Tests - Validation, Error Handling, and Edge Cases
 * Consolidated from multiple redundant test files focusing on validation and error scenarios
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Shared localStorage mock setup (consolidated from 6 files)
const store = {} as Record<string, string>;

const mockLocalStorage = {
  getItem: vi.fn().mockImplementation((key: string) => store[key] || null),
  setItem: vi.fn().mockImplementation((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn().mockImplementation((key: string) => {
    delete store[key];
  }),
  clear: vi.fn().mockImplementation(() => {
    Object.keys(store).forEach(key => delete store[key]);
  }),
  get store() { return store; }
};

// Mock the global localStorage
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Shared logger mock (consolidated from 6 files)
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Import functions after mocking
import { 
  decodeSettingsFromUrl,
  encodeSettingsToUrl,
  loadSettings,
  saveSettings,
  saveViewMode,
  loadViewMode,
  clearViewMode,
  saveDraft,
  getDraft,
  clearDraft,
  ViewMode,
  TodoDraft
} from '../localStorage';
import logger from '../logger';

describe('localStorage - Edge Cases and Validation', () => {
  beforeEach(() => {
    // Clear the store
    Object.keys(store).forEach(key => delete store[key]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('URL Encoding Edge Cases - Compressed Format', () => {
    it('should decode compressed GitHub settings with all fields', () => {
      // Test the compressed format path
      const compressedData = {
        g: 0, // github
        p: 'test-pat',
        o: 'test-owner', 
        r: 'test-repo',
        f: 'custom-folder',
        a: 0, // gemini
        gk: 'gemini-key',
        m: 'gemini-model'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      // Verify all compressed fields are properly decoded
      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'github',
        folder: 'custom-folder',
        aiProvider: 'gemini',
        geminiApiKey: 'gemini-key',
        aiModel: 'gemini-model'
      }));
    });

    it('should decode compressed GitLab settings with GitLab provider flag', () => {
      const compressedData = {
        g: 1, // gitlab
        f: 'tasks',
        a: 1, // openrouter
        ok: 'openrouter-key',
        m: 'claude-model',
        gl: {
          u: 'https://gitlab.example.com', // Fixed: should be 'u' not 'iu'
          t: 'gitlab-token',
          i: '123' // Fixed: should be 'i' not 'pi'
        }
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'gitlab',
        folder: 'tasks',
        aiProvider: 'openrouter',
        openRouterApiKey: 'openrouter-key',
        aiModel: 'claude-model',
        gitlab: {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '123',
          token: 'gitlab-token',
          branch: 'main'
        }
      }));
    });

    it('should handle malformed compressed data gracefully', () => {
      const malformedData = 'invalid-base64-data!!!';
      
      const result = decodeSettingsFromUrl(malformedData);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle invalid JSON in compressed data', () => {
      const invalidJson = btoa('{ invalid json structure }');
      
      const result = decodeSettingsFromUrl(invalidJson);
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle missing required fields in compressed data', () => {
      const incompleteData = {
        g: 0, // github but missing required fields
        gh: {
          p: 'some-pat',
          o: 'some-owner',
          r: 'some-repo'
        }
      };

      const encoded = btoa(JSON.stringify(incompleteData));
      const result = decodeSettingsFromUrl(encoded);

      // Should still return object but with default values
      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'github',
        folder: 'todos',
        github: expect.objectContaining({
          pat: 'some-pat',
          owner: 'some-owner',
          repo: 'some-repo'
        })
      }));
    });
  });

  describe('Settings Validation Edge Cases', () => {
    it('should handle localStorage storage exceptions', () => {
      // Mock localStorage to throw error
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      const settings = {
        gitProvider: 'github' as const,
        pat: 'test-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      };

      expect(() => saveSettings(settings)).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Error saving settings to localStorage', expect.any(Error));
    });

    it('should handle corrupted JSON data in localStorage', () => {
      store['githubSettings'] = '{ corrupted json data }';
      
      const result = loadSettings();
      
      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle extremely large settings objects', () => {
      const largeSettings = {
        gitProvider: 'github' as const,
        pat: 'x'.repeat(10000), // Very large PAT
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      };

      expect(() => saveSettings(largeSettings)).not.toThrow();
    });

    it('should handle settings with special characters', () => {
      const specialSettings = {
        gitProvider: 'github' as const,
        pat: 'token-with-special-chars-!@#$%^&*()',
        owner: 'user-with-中文',
        repo: 'repo-with-émojis-🚀',
        folder: 'folder-with-spaces and symbols'
      };

      saveSettings(specialSettings);
      const result = loadSettings();
      
      // loadSettings migrates to new format and adds defaults
      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'github',
        folder: 'folder-with-spaces and symbols',
        github: expect.objectContaining({
          pat: 'token-with-special-chars-!@#$%^&*()',
          owner: 'user-with-中文',
          repo: 'repo-with-émojis-🚀',
          branch: 'main'
        })
      }));
    });
  });

  describe('Draft Management Edge Cases', () => {
    it('should handle draft operations with special characters in paths', () => {
      const specialPath = '/todos/中文-task-🚀-émojis.md';
      const todoId = 'test-todo';
      const content = '# Special content';
      
      expect(() => saveDraft({
        todoId,
        path: specialPath,
        stableDraftKey: specialPath.trim().toLowerCase(),
        editContent: content,
        viewContent: content,
        hasUnsavedChanges: true,
        timestamp: Date.now()
      })).not.toThrow();
    });

    it('should handle very long draft content', () => {
      const longContent = '# Very Long Content\n\n' + 'x'.repeat(100000);
      const todoId = 'test-todo';
      const path = '/todos/test.md';

      expect(() => saveDraft({
        todoId,
        path,
        stableDraftKey: path.trim().toLowerCase(),
        editContent: longContent,
        viewContent: longContent,
        hasUnsavedChanges: true,
        timestamp: Date.now()
      })).not.toThrow();
    });

    it('should handle draft with null/undefined content', () => {
      const todoId = 'test-todo';
      const path = '/todos/test.md';

      expect(() => saveDraft({
        todoId,
        path,
        stableDraftKey: path.trim().toLowerCase(),
        editContent: null as any,
        viewContent: undefined as any,
        hasUnsavedChanges: false,
        timestamp: Date.now()
      })).not.toThrow();
    });

    it('should handle corrupted draft data gracefully', () => {
      const todoId = 'test-todo';
      const path = '/todos/test.md';
      store[`todoDraft`] = '{ invalid json for draft }';
      
      const result = getDraft(todoId, path);
      
      expect(result).toBeNull();
    });

    it('should handle localStorage errors during draft operations', () => {
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const todoId = 'test-todo';
      const path = '/todos/test.md';

      expect(() => saveDraft({
        todoId,
        path,
        stableDraftKey: path.trim().toLowerCase(),
        editContent: 'content',
        viewContent: 'view',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      })).not.toThrow();
    });
  });

  describe('View Mode Edge Cases', () => {
    it('should handle invalid view mode values gracefully', () => {
      const invalidMode = 'invalid-mode' as ViewMode;
      
      expect(() => saveViewMode(invalidMode)).not.toThrow();
    });

    it('should handle corrupted view mode data', () => {
      store['viewMode'] = 'corrupted-data';
      
      const result = loadViewMode();
      
      expect(result).toBe('active'); // Default fallback
    });

    it('should handle archived view mode', () => {
      saveViewMode('archived');
      const result = loadViewMode();
      
      expect(result).toBe('archived');
    });

    it('should handle view mode clearing', () => {
      saveViewMode('archived');
      expect(() => clearViewMode()).not.toThrow();
      
      const result = loadViewMode();
      expect(result).toBe('active'); // Should reset to default
    });
  });

  describe('Concurrent Operations Edge Cases', () => {
    it('should handle multiple simultaneous localStorage operations', async () => {
      const operations = [
        () => saveSettings({ gitProvider: 'github' as const, pat: 'token1', owner: 'user1', repo: 'repo1', folder: 'todos' }),
        () => saveDraft({
          todoId: 'todo1',
          path: '/path1',
          stableDraftKey: '/path1',
          editContent: 'content1',
          viewContent: 'view1',
          hasUnsavedChanges: true,
          timestamp: Date.now()
        }),
        () => saveViewMode('archived'),
        () => saveDraft({
          todoId: 'todo3',
          path: '/path3',
          stableDraftKey: '/path3',
          editContent: 'content3',
          viewContent: 'view3',
          hasUnsavedChanges: true,
          timestamp: Date.now()
        }),
        () => saveSettings({ gitProvider: 'gitlab' as const, token: 'token2', instanceUrl: 'https://gitlab.com', projectId: '123', folder: 'tasks' })
      ];

      await Promise.all(operations.map(op => Promise.resolve(op())));

      // All operations should complete without throwing
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid successive operations on same key', () => {
      const todoId = 'rapid-test';
      
      for (let i = 0; i < 100; i++) {
        saveDraft({
          todoId,
          path: `/path${i}`,
          stableDraftKey: `/path${i}`,
          editContent: `content${i}`,
          viewContent: `view${i}`,
          hasUnsavedChanges: true,
          timestamp: Date.now()
        });
      }

      expect(() => getDraft(todoId, '/path99')).not.toThrow();
    });
  });

  describe('Memory and Storage Edge Cases', () => {
    it('should handle localStorage quota exceeded gracefully', () => {
      let callCount = 0;
      mockLocalStorage.setItem.mockImplementation(() => {
        callCount++;
        if (callCount > 2) {
          throw new DOMException('QuotaExceededError');
        }
      });

      const settings = {
        gitProvider: 'github' as const,
        pat: 'test-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos'
      };

      // First few calls should work, then quota exceeded
      saveSettings(settings);
      saveDraft({
        todoId: 'todo1',
        path: '/path1',
        stableDraftKey: '/path1',
        editContent: 'content1',
        viewContent: 'view1',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      });
      
      // This should handle the quota exceeded error gracefully
      expect(() => saveDraft({
        todoId: 'todo2',
        path: '/path2',
        stableDraftKey: '/path2',
        editContent: 'content2',
        viewContent: 'view2',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      })).not.toThrow();
    });

    it('should handle browser storage disabled scenarios', () => {
      // Mock localStorage to be null (storage disabled)
      const originalLocalStorage = global.localStorage;
      Object.defineProperty(global, 'localStorage', {
        value: null,
        writable: true
      });

      expect(() => loadSettings()).not.toThrow();
      expect(() => saveSettings({ gitProvider: 'github' as const, pat: 'token', owner: 'user', repo: 'repo', folder: 'todos' })).not.toThrow();
      
      // Restore localStorage for subsequent tests
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    });
  });

  describe('Data Validation Edge Cases', () => {
    it('should handle empty strings in folder field', () => {
      const settingsWithEmptyFolder = {
        gitProvider: 'github' as const,
        pat: 'valid-pat',
        owner: 'valid-owner',
        repo: 'valid-repo',
        folder: '', // Empty folder should get default
        aiProvider: 'gemini' as const
      };

      // Directly set in store to simulate localStorage behavior
      store['githubSettings'] = JSON.stringify(settingsWithEmptyFolder);
      
      const result = loadSettings();
      
      // Should migrate from legacy format and apply default for empty folder
      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'github',
        folder: 'todos', // Default applied when folder is empty
        aiProvider: 'gemini',
        github: expect.objectContaining({
          pat: 'valid-pat',
          owner: 'valid-owner',
          repo: 'valid-repo',
          branch: 'main'
        })
      }));
    });

    it('should handle null and undefined values in settings', () => {
      const settingsWithNulls = {
        gitProvider: 'github' as const,
        pat: null as any,
        owner: undefined as any,
        repo: 'test-repo',
        folder: 'todos'
      };

      expect(() => saveSettings(settingsWithNulls)).not.toThrow();
    });

    it('should handle settings with extra unknown properties', () => {
      const settingsWithExtra = {
        gitProvider: 'github' as const,
        pat: 'test-token',
        owner: 'test-user',
        repo: 'test-repo',
        folder: 'todos',
        aiProvider: 'gemini' as const,
        unknownProperty: 'should-be-preserved',
        anotherExtra: 123
      };

      // Directly set in store to simulate localStorage behavior
      store['githubSettings'] = JSON.stringify(settingsWithExtra);
      
      const result = loadSettings();
      
      // Should migrate from legacy format successfully (unknown properties are cleaned during migration for security)
      expect(result).toEqual(expect.objectContaining({
        gitProvider: 'github',
        folder: 'todos',
        aiProvider: 'gemini',
        github: expect.objectContaining({
          pat: 'test-token',
          owner: 'test-user',
          repo: 'test-repo',
          branch: 'main'
        })
      }));
      
      // Unknown properties are not preserved during migration for security
      expect(result).not.toHaveProperty('unknownProperty');
      expect(result).not.toHaveProperty('anotherExtra');
    });
  });
});