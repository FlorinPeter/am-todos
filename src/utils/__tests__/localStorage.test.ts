import { vi, describe, it, expect, beforeEach } from 'vitest';

// Create a proper localStorage mock
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

// Mock the logger
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Now import the functions
import { 
  saveSettings,
  loadSettings,
  encodeSettingsToUrl,
  decodeSettingsFromUrl,
  getUrlConfig,
  saveCheckpoint, 
  getCheckpoints, 
  clearCheckpoints, 
  generateCheckpointId,
  saveSelectedTodoId,
  loadSelectedTodoId,
  clearSelectedTodoId,
  Checkpoint 
} from '../localStorage';
import logger from '../logger';

describe('localStorage functions', () => {
  beforeEach(() => {
    // Clear the store
    Object.keys(store).forEach(key => delete store[key]);
    vi.clearAllMocks();
  });

  describe('generateCheckpointId', () => {
    it('generates unique checkpoint IDs', () => {
      const id1 = generateCheckpointId();
      const id2 = generateCheckpointId();
      
      expect(id1).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('follows the expected format', () => {
      const id = generateCheckpointId();
      expect(id).toMatch(/^checkpoint_\d{13}_[a-z0-9]{9}$/);
    });
  });

  describe('saveCheckpoint', () => {
    const mockCheckpoint: Checkpoint = {
      id: 'test-checkpoint-1',
      content: '# Test Content\n\n- [ ] Task 1',
      timestamp: '2023-01-01T12:00:00.000Z',
      chatMessage: 'Add a new task',
      description: 'Add a new task'
    };

    it('saves checkpoint to localStorage', () => {
      saveCheckpoint('task-1', mockCheckpoint);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-1',
        JSON.stringify([mockCheckpoint])
      );
    });

    it('appends to existing checkpoints', () => {
      const existingCheckpoint: Checkpoint = {
        id: 'existing-checkpoint',
        content: '# Existing Content',
        timestamp: '2023-01-01T11:00:00.000Z',
        chatMessage: 'Previous task',
        description: 'Previous task'
      };

      // Set up existing checkpoint
      store['checkpoints_task-1'] = JSON.stringify([existingCheckpoint]);
      
      saveCheckpoint('task-1', mockCheckpoint);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-1',
        JSON.stringify([existingCheckpoint, mockCheckpoint])
      );
    });

    it('limits checkpoints to 20 items', () => {
      // Create 21 checkpoints
      const checkpoints: Checkpoint[] = [];
      for (let i = 0; i < 21; i++) {
        checkpoints.push({
          id: `checkpoint-${i}`,
          content: `Content ${i}`,
          timestamp: new Date().toISOString(),
          chatMessage: `Message ${i}`,
          description: `Description ${i}`
        });
      }

      // Save all checkpoints one by one
      checkpoints.forEach(cp => saveCheckpoint('task-1', cp));

      // Get the final state
      const savedCheckpoints = getCheckpoints('task-1');
      
      expect(savedCheckpoints).toHaveLength(20);
      expect(savedCheckpoints[0].id).toBe('checkpoint-1'); // First one should be removed
      expect(savedCheckpoints[19].id).toBe('checkpoint-20'); // Last one should be kept
    });

    it('handles localStorage errors gracefully', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage full');
      });

      expect(() => saveCheckpoint('task-1', mockCheckpoint)).not.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error saving checkpoint to localStorage',
        expect.any(Error)
      );

      loggerSpy.mockRestore();
    });
  });

  describe('getCheckpoints', () => {
    it('returns empty array when no checkpoints exist', () => {
      const checkpoints = getCheckpoints('non-existent-task');
      expect(checkpoints).toEqual([]);
    });

    it('returns stored checkpoints', () => {
      const mockCheckpoints: Checkpoint[] = [
        {
          id: 'checkpoint-1',
          content: '# Content 1',
          timestamp: '2023-01-01T12:00:00.000Z',
          chatMessage: 'Message 1',
          description: 'Description 1'
        },
        {
          id: 'checkpoint-2',
          content: '# Content 2',
          timestamp: '2023-01-01T13:00:00.000Z',
          chatMessage: 'Message 2',
          description: 'Description 2'
        }
      ];

      store['checkpoints_task-1'] = JSON.stringify(mockCheckpoints);
      
      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual(mockCheckpoints);
    });

    it('handles localStorage errors gracefully', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual([]);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error loading checkpoints from localStorage',
        expect.any(Error)
      );

      loggerSpy.mockRestore();
    });

    it('handles corrupted JSON data gracefully', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      store['checkpoints_task-1'] = 'invalid json';
      
      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual([]);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error loading checkpoints from localStorage',
        expect.any(Error)
      );

      loggerSpy.mockRestore();
    });
  });

  describe('clearCheckpoints', () => {
    it('removes checkpoints from localStorage', () => {
      store['checkpoints_task-1'] = JSON.stringify([]);
      
      clearCheckpoints('task-1');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('checkpoints_task-1');
      expect(store['checkpoints_task-1']).toBeUndefined();
    });

    it('handles localStorage errors gracefully', () => {
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => clearCheckpoints('task-1')).not.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error clearing checkpoints from localStorage',
        expect.any(Error)
      );

      loggerSpy.mockRestore();
    });
  });

  describe('Integration scenarios', () => {
    it('verifies localStorage interactions for save operations', () => {
      const checkpoint: Checkpoint = {
        id: 'test-checkpoint',
        content: '# Test Content',
        timestamp: new Date().toISOString(),
        chatMessage: 'Test message',
        description: 'Test description'
      };

      // Save checkpoint
      saveCheckpoint('workflow-test', checkpoint);
      
      // Verify localStorage was called correctly
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_workflow-test',
        JSON.stringify([checkpoint])
      );
    });

    it('verifies localStorage interactions for clear operations', () => {
      // Clear checkpoints
      clearCheckpoints('workflow-test');
      
      // Verify localStorage was called correctly
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('checkpoints_workflow-test');
    });

    it('verifies localStorage interactions for separate task isolation', () => {
      const checkpoint1: Checkpoint = {
        id: 'checkpoint-1',
        content: 'Content 1',
        timestamp: new Date().toISOString(),
        chatMessage: 'Message 1',
        description: 'Description 1'
      };

      const checkpoint2: Checkpoint = {
        id: 'checkpoint-2',
        content: 'Content 2',
        timestamp: new Date().toISOString(),
        chatMessage: 'Message 2',
        description: 'Description 2'
      };

      saveCheckpoint('task-1', checkpoint1);
      saveCheckpoint('task-2', checkpoint2);

      // Verify localStorage was called with different keys
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-1',
        JSON.stringify([checkpoint1])
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-2',
        JSON.stringify([checkpoint2])
      );
    });
  });

  describe('Settings Management', () => {
    const mockGitHubSettings = {
      pat: 'github-token',
      owner: 'testuser',
      repo: 'test-repo',
      folder: 'todos',
      geminiApiKey: 'gemini-key',
      aiProvider: 'gemini' as const,
      openRouterApiKey: '',
      aiModel: 'gemini-2.5-flash',
      gitProvider: 'github' as const,
      instanceUrl: '',
      projectId: '',
      token: '',
      branch: 'main'
    };
    
    beforeEach(() => {
      // Ensure mock implementations are reset
      mockLocalStorage.getItem.mockImplementation((key: string) => store[key] || null);
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      mockLocalStorage.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });
    });

    const mockGitLabSettings = {
      pat: '',
      owner: '',
      repo: '',
      folder: 'work-tasks',
      geminiApiKey: '',
      aiProvider: 'openrouter' as const,
      openRouterApiKey: 'openrouter-key',
      aiModel: 'anthropic/claude-3.5-sonnet',
      gitProvider: 'gitlab' as const,
      instanceUrl: 'https://gitlab.example.com',
      projectId: '12345',
      token: 'gitlab-token',
      branch: 'main'
    };

    describe('saveSettings', () => {
      it('saves GitHub settings to localStorage', () => {
        saveSettings(mockGitHubSettings);
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'githubSettings',
          JSON.stringify(mockGitHubSettings)
        );
      });

      it('saves GitLab settings to localStorage', () => {
        saveSettings(mockGitLabSettings);
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'githubSettings',
          JSON.stringify(mockGitLabSettings)
        );
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage full');
        });

        expect(() => saveSettings(mockGitHubSettings)).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error saving settings to localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('loadSettings', () => {
      it('returns null when no settings exist', () => {
        const settings = loadSettings();
        expect(settings).toBeNull();
      });

      it('loads and returns stored GitHub settings with defaults', () => {
        store['githubSettings'] = JSON.stringify(mockGitHubSettings);
        
        const settings = loadSettings();
        expect(settings).toEqual(mockGitHubSettings);
      });

      it('adds default values for missing fields', () => {
        const incompleteSettings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo'
        };
        
        store['githubSettings'] = JSON.stringify(incompleteSettings);
        
        const settings = loadSettings();
        expect(settings).toEqual({
          ...incompleteSettings,
          folder: 'todos',
          aiProvider: 'gemini',
          aiModel: 'gemini-2.5-flash',
          gitProvider: 'github',
          branch: 'main'
        });
      });

      it('applies correct defaults for OpenRouter provider', () => {
        const openRouterSettings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo',
          aiProvider: 'openrouter'
        };
        
        store['githubSettings'] = JSON.stringify(openRouterSettings);
        
        const settings = loadSettings();
        expect(settings?.aiModel).toBe('anthropic/claude-3.5-sonnet');
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const settings = loadSettings();
        expect(settings).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading settings from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('handles corrupted JSON data gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        store['githubSettings'] = 'invalid json';
        
        const settings = loadSettings();
        expect(settings).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading settings from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });
  });

  describe('URL Configuration', () => {
    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:3000',
          pathname: '/',
          search: ''
        },
        writable: true
      });
    });

    describe('encodeSettingsToUrl', () => {
      it('encodes GitHub settings to URL', () => {
        const settings = {
          pat: 'github-token',
          owner: 'testuser',
          repo: 'test-repo',
          folder: 'todos',
          geminiApiKey: 'gemini-key',
          aiProvider: 'gemini' as const,
          openRouterApiKey: '',
          aiModel: 'gemini-2.5-flash',
          gitProvider: 'github' as const,
          instanceUrl: '',
          projectId: '',
          token: '',
          branch: 'main'
        };

        const url = encodeSettingsToUrl(settings);
        
        expect(url).toMatch(/^http:\/\/localhost:3000\/\?config=[A-Za-z0-9+/=]+$/);
      });

      it('encodes GitLab settings to URL', () => {
        const settings = {
          pat: '',
          owner: '',
          repo: '',
          folder: 'work-tasks',
          geminiApiKey: '',
          aiProvider: 'openrouter' as const,
          openRouterApiKey: 'openrouter-key',
          aiModel: 'anthropic/claude-3.5-sonnet',
          gitProvider: 'gitlab' as const,
          instanceUrl: 'https://gitlab.example.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        };

        const url = encodeSettingsToUrl(settings);
        
        expect(url).toMatch(/^http:\/\/localhost:3000\/\?config=[A-Za-z0-9+/=]+$/);
      });

      it('handles encoding errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Mock btoa to throw an error
        const originalBtoa = global.btoa;
        global.btoa = vi.fn(() => {
          throw new Error('Encoding error');
        });

        const url = encodeSettingsToUrl({} as any);
        
        expect(url).toBe('');
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error encoding settings to URL',
          expect.any(Error)
        );

        global.btoa = originalBtoa;
        loggerSpy.mockRestore();
      });
    });

    describe('decodeSettingsFromUrl', () => {
      it('decodes valid GitHub settings from base64', () => {
        const settings = {
          pat: 'github-token',
          owner: 'testuser',
          repo: 'test-repo',
          folder: 'todos',
          gitProvider: 'github'
        };
        
        const encoded = btoa(JSON.stringify(settings));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded).toEqual({
          ...settings,
          branch: 'main'
        });
      });

      it('decodes valid GitLab settings from base64', () => {
        const settings = {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '12345',
          token: 'gitlab-token',
          folder: 'work-tasks',
          gitProvider: 'gitlab'
        };
        
        const encoded = btoa(JSON.stringify(settings));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded).toEqual({
          ...settings,
          branch: 'main'
        });
      });

      it('validates required GitHub fields', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        const incompleteSettings = {
          pat: 'token',
          owner: 'user'
          // missing repo
        };
        
        const encoded = btoa(JSON.stringify(incompleteSettings));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Invalid GitHub settings configuration - missing required fields'
        );

        loggerSpy.mockRestore();
      });

      it('validates required GitLab fields', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        const incompleteSettings = {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '12345'
          // missing token
        };
        
        const encoded = btoa(JSON.stringify({
          ...incompleteSettings,
          gitProvider: 'gitlab'
        }));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Invalid GitLab settings configuration - missing required fields'
        );

        loggerSpy.mockRestore();
      });

      it('handles invalid base64 gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        const decoded = decodeSettingsFromUrl('invalid-base64!@#');
        
        expect(decoded).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error decoding settings from URL',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('handles invalid JSON gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        const invalidJson = btoa('invalid json {');
        const decoded = decodeSettingsFromUrl(invalidJson);
        
        expect(decoded).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error decoding settings from URL',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('adds default folder when missing', () => {
        const settings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo'
        };
        
        const encoded = btoa(JSON.stringify(settings));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded?.folder).toBe('todos');
      });

      it('adds default branch when missing', () => {
        const settings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo'
        };
        
        const encoded = btoa(JSON.stringify(settings));
        const decoded = decodeSettingsFromUrl(encoded);
        
        expect(decoded?.branch).toBe('main');
      });
    });

    describe('getUrlConfig', () => {
      it('returns null when no config parameter exists', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?other=param'
          },
          writable: true
        });

        const config = getUrlConfig();
        expect(config).toBeNull();
      });

      it('returns decoded settings when config parameter exists', () => {
        const settings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo',
          folder: 'todos'
        };
        
        const encoded = btoa(JSON.stringify(settings));
        Object.defineProperty(window, 'location', {
          value: {
            search: `?config=${encoded}`
          },
          writable: true
        });

        const config = getUrlConfig();
        expect(config).toEqual({
          ...settings,
          branch: 'main'
        });
      });

      it('returns null for invalid config parameter', () => {
        Object.defineProperty(window, 'location', {
          value: {
            search: '?config=invalid'
          },
          writable: true
        });

        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        const config = getUrlConfig();
        expect(config).toBeNull();
        loggerSpy.mockRestore();
      });
    });
  });

  describe('Selected Todo Persistence', () => {
    beforeEach(() => {
      // Ensure mock implementations are reset
      mockLocalStorage.getItem.mockImplementation((key: string) => store[key] || null);
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      mockLocalStorage.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });
    });
    
    describe('saveSelectedTodoId', () => {
      it('saves todo ID to localStorage', () => {
        saveSelectedTodoId('todo-123');
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'selectedTodoId',
          'todo-123'
        );
      });

      it('removes todo ID when null is passed', () => {
        saveSelectedTodoId(null);
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
          'selectedTodoId'
        );
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => saveSelectedTodoId('todo-123')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error saving selected todo ID to localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('loadSelectedTodoId', () => {
      it('returns stored todo ID', () => {
        store['selectedTodoId'] = 'todo-456';
        
        const todoId = loadSelectedTodoId();
        expect(todoId).toBe('todo-456');
      });

      it('returns null when no todo ID is stored', () => {
        const todoId = loadSelectedTodoId();
        expect(todoId).toBeNull();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const todoId = loadSelectedTodoId();
        expect(todoId).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading selected todo ID from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearSelectedTodoId', () => {
      it('removes todo ID from localStorage', () => {
        store['selectedTodoId'] = 'todo-789';
        
        clearSelectedTodoId();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('selectedTodoId');
        expect(store['selectedTodoId']).toBeUndefined();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearSelectedTodoId()).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing selected todo ID from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });
  });

  describe('Checkpoints Management Integration', () => {
    beforeEach(() => {
      // Ensure mock implementations are reset
      mockLocalStorage.getItem.mockImplementation((key: string) => store[key] || null);
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
      });
      mockLocalStorage.removeItem.mockImplementation((key: string) => {
        delete store[key];
      });
    });
    
    it('verifies complete checkpoint workflow', () => {
      const checkpoint: Checkpoint = {
        id: generateCheckpointId(),
        content: '# Test Checkpoint',
        timestamp: new Date().toISOString(),
        chatMessage: 'Test checkpoint workflow',
        description: 'Test checkpoint description'
      };

      // Test full workflow
      saveCheckpoint('workflow-test', checkpoint);
      const retrieved = getCheckpoints('workflow-test');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(checkpoint);
      
      // Clear and verify
      clearCheckpoints('workflow-test');
      const afterClear = getCheckpoints('workflow-test');
      expect(afterClear).toHaveLength(0);
    });
  });
});