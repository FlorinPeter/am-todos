import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveViewMode,
  loadViewMode,
  clearViewMode,
  ViewMode
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

describe('localStorage - View Mode Persistence', () => {
  let mockStorage: { [key: string]: string } = {};
  let mockLocalStorage: any;

  beforeEach(() => {
    mockStorage = {};
    
    mockLocalStorage = {
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
    };

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockStorage = {};
  });

  describe('saveViewMode', () => {
    it('should save active view mode to localStorage', () => {
      saveViewMode('active');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('viewMode', 'active');
      expect(mockStorage['viewMode']).toBe('active');
    });

    it('should save archived view mode to localStorage', () => {
      saveViewMode('archived');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('viewMode', 'archived');
      expect(mockStorage['viewMode']).toBe('archived');
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage quota exceeded');
      });

      // Should not throw an error
      expect(() => saveViewMode('active')).not.toThrow();
    });

    it('should accept only valid ViewMode values', () => {
      const validModes: ViewMode[] = ['active', 'archived'];
      
      validModes.forEach(mode => {
        expect(() => saveViewMode(mode)).not.toThrow();
      });
    });
  });

  describe('loadViewMode', () => {
    it('should load active view mode from localStorage', () => {
      mockStorage['viewMode'] = 'active';
      
      const result = loadViewMode();
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('viewMode');
      expect(result).toBe('active');
    });

    it('should load archived view mode from localStorage', () => {
      mockStorage['viewMode'] = 'archived';
      
      const result = loadViewMode();
      
      expect(result).toBe('archived');
    });

    it('should return default "active" when no view mode is stored', () => {
      // mockStorage is empty by default
      
      const result = loadViewMode();
      
      expect(result).toBe('active');
    });

    it('should return default "active" for invalid stored values', () => {
      const invalidValues = ['invalid', 'random', '', 'null', 'undefined', '123'];
      
      invalidValues.forEach(invalidValue => {
        mockStorage['viewMode'] = invalidValue;
        
        const result = loadViewMode();
        
        expect(result).toBe('active');
      });
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      const result = loadViewMode();
      
      // Should return default value and not throw
      expect(result).toBe('active');
    });

    it('should handle null return from localStorage.getItem', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = loadViewMode();
      
      expect(result).toBe('active');
    });

    it('should validate stored values strictly', () => {
      // Test case sensitivity
      mockStorage['viewMode'] = 'ACTIVE';
      expect(loadViewMode()).toBe('active'); // Should default because it's not exactly 'active'
      
      mockStorage['viewMode'] = 'Active';
      expect(loadViewMode()).toBe('active'); // Should default because it's not exactly 'active'
      
      mockStorage['viewMode'] = 'ARCHIVED';
      expect(loadViewMode()).toBe('active'); // Should default because it's not exactly 'archived'
    });
  });

  describe('clearViewMode', () => {
    it('should remove view mode from localStorage', () => {
      // Set up initial state
      mockStorage['viewMode'] = 'archived';
      
      clearViewMode();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('viewMode');
      expect(mockStorage['viewMode']).toBeUndefined();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      // Should not throw an error
      expect(() => clearViewMode()).not.toThrow();
    });

    it('should work even when no view mode is stored', () => {
      // mockStorage is empty by default
      
      expect(() => clearViewMode()).not.toThrow();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('viewMode');
    });
  });

  describe('ViewMode Integration Workflow', () => {
    it('should support complete save-load-clear cycle', () => {
      // Save active mode
      saveViewMode('active');
      expect(loadViewMode()).toBe('active');
      
      // Switch to archived mode
      saveViewMode('archived');
      expect(loadViewMode()).toBe('archived');
      
      // Clear mode
      clearViewMode();
      expect(loadViewMode()).toBe('active'); // Should default to active
    });

    it('should maintain view mode across multiple operations', () => {
      // Set archived mode
      saveViewMode('archived');
      
      // Multiple loads should return consistent results
      expect(loadViewMode()).toBe('archived');
      expect(loadViewMode()).toBe('archived');
      expect(loadViewMode()).toBe('archived');
      
      // Verify localStorage was called appropriately
      expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid mode switching', () => {
      const modes: ViewMode[] = ['active', 'archived', 'active', 'archived'];
      
      modes.forEach(mode => {
        saveViewMode(mode);
        expect(loadViewMode()).toBe(mode);
      });
      
      // Final state should be 'archived'
      expect(loadViewMode()).toBe('archived');
    });

    it('should persist view mode across browser sessions (simulated)', () => {
      // Save in "first session"
      saveViewMode('archived');
      
      // Simulate page reload by creating new localStorage mock but keeping storage
      const persistedStorage = { ...mockStorage };
      
      // Create new mock localStorage with persisted data
      const newMockLocalStorage = {
        getItem: vi.fn((key: string) => persistedStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          persistedStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete persistedStorage[key];
        }),
        clear: vi.fn(() => {
          Object.keys(persistedStorage).forEach(key => delete persistedStorage[key]);
        })
      };
      
      Object.defineProperty(window, 'localStorage', {
        value: newMockLocalStorage,
        writable: true
      });
      
      // Load in "second session"
      const result = loadViewMode();
      expect(result).toBe('archived');
    });
  });

  describe('Type Safety and Validation', () => {
    it('should only accept valid ViewMode union types', () => {
      // TypeScript should prevent this at compile time, but we test runtime behavior
      const validModes: ViewMode[] = ['active', 'archived'];
      
      validModes.forEach(mode => {
        expect(() => saveViewMode(mode)).not.toThrow();
      });
    });

    it('should handle edge cases in stored data', () => {
      const edgeCases = [
        '',
        ' ',
        'null',
        'undefined',
        '0',
        'false',
        'true',
        'active ',
        ' archived',
        'active\n',
        'archived\t'
      ];
      
      edgeCases.forEach(edgeCase => {
        mockStorage['viewMode'] = edgeCase;
        const result = loadViewMode();
        expect(result).toBe('active'); // All should default to 'active'
      });
    });

    it('should handle JSON-like strings in storage', () => {
      const jsonLikeValues = [
        '{"mode": "active"}',
        '["active"]',
        'null',
        'true',
        'false',
        '123'
      ];
      
      jsonLikeValues.forEach(jsonValue => {
        mockStorage['viewMode'] = jsonValue;
        const result = loadViewMode();
        expect(result).toBe('active'); // All should default to 'active'
      });
    });
  });
});