import { vi, describe, it, expect, beforeEach } from 'vitest';
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
  saveViewMode,
  loadViewMode,
  clearViewMode,
  saveDraft,
  getDraft,
  clearDraft,
  clearOtherDrafts,
  saveChatSession,
  getChatSession,
  clearChatSession,
  clearOtherChatSessions,
  AIChatSession,
  Checkpoint,
  TodoDraft,
} from '../localStorage';
import logger from '../logger';

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

// Imports moved to top of file

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
      gitProvider: 'github' as const,
      folder: 'todos',
      aiProvider: 'gemini' as const,
      geminiApiKey: 'gemini-key',
      openRouterApiKey: '',
      aiModel: 'gemini-2.5-flash',
      github: {
        pat: 'github-token',
        owner: 'testuser',
        repo: 'test-repo',
        branch: 'main'
      },
      gitlab: {
        instanceUrl: 'https://gitlab.com',
        projectId: '',
        token: '',
        branch: 'main'
      }
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
      gitProvider: 'gitlab' as const,
      folder: 'work-tasks',
      aiProvider: 'openrouter' as const,
      geminiApiKey: '',
      openRouterApiKey: 'openrouter-key',
      aiModel: 'anthropic/claude-3.5-sonnet',
      github: {
        pat: '',
        owner: '',
        repo: '',
        branch: 'main'
      },
      gitlab: {
        instanceUrl: 'https://gitlab.example.com',
        projectId: '12345',
        token: 'gitlab-token',
        branch: 'main'
      }
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

      it('adds default values for missing fields and migrates legacy format', () => {
        const incompleteSettings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo'
        };
        
        store['githubSettings'] = JSON.stringify(incompleteSettings);
        
        const settings = loadSettings();
        expect(settings).toEqual({
          gitProvider: 'github',
          folder: 'todos',
          aiProvider: 'gemini',
          geminiApiKey: '',
          openRouterApiKey: '',
          aiModel: 'anthropic/claude-3.5-sonnet',
          github: {
            pat: 'token',
            owner: 'user',
            repo: 'repo',
            branch: 'main'
          }
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
        expect(settings?.github?.pat).toBe('token');
        expect(settings?.github?.owner).toBe('user');
        expect(settings?.github?.repo).toBe('repo');
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

      it('migrates legacy format with mixed fields correctly', () => {
        const mixedSettings = {
          pat: 'github-token',
          owner: 'user',
          repo: 'repo',
          gitProvider: 'github',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'gitlab-token'
        };
        
        store['githubSettings'] = JSON.stringify(mixedSettings);
        
        const settings = loadSettings();
        expect(settings?.gitProvider).toBe('github');
        expect(settings?.github?.pat).toBe('github-token');
        expect(settings?.github?.owner).toBe('user');
        expect(settings?.github?.repo).toBe('repo');
        expect(settings?.gitlab?.instanceUrl).toBe('https://gitlab.com');
        expect(settings?.gitlab?.projectId).toBe('123');
        expect(settings?.gitlab?.token).toBe('gitlab-token');
      });

      it('migrates legacy GitLab settings to dual-config format', () => {
        const mixedSettings = {
          pat: 'github-token',
          owner: 'user',
          repo: 'repo',
          gitProvider: 'gitlab',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'gitlab-token'
        };
        
        store['githubSettings'] = JSON.stringify(mixedSettings);
        
        const settings = loadSettings();
        expect(settings?.gitProvider).toBe('gitlab');
        expect(settings?.gitlab?.instanceUrl).toBe('https://gitlab.com');
        expect(settings?.gitlab?.projectId).toBe('123');
        expect(settings?.gitlab?.token).toBe('gitlab-token');
        expect(settings?.github?.pat).toBe('github-token');
        expect(settings?.github?.owner).toBe('user');
        expect(settings?.github?.repo).toBe('repo');
      });

      it('preserves folder field from URL config without defaulting', () => {
        const urlSettings = {
          pat: 'token',
          owner: 'user',
          repo: 'repo',
          folder: 'tests', // Should be preserved, not defaulted to 'todos'
          gitProvider: 'github'
        };
        
        store['githubSettings'] = JSON.stringify(urlSettings);
        
        const settings = loadSettings();
        expect(settings?.folder).toBe('tests');
        expect(settings?.github?.pat).toBe('token');
        expect(settings?.github?.owner).toBe('user');
        expect(settings?.github?.repo).toBe('repo');
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
          gitProvider: 'github' as const,
          folder: 'todos',
          aiProvider: 'gemini' as const,
          geminiApiKey: 'gemini-key',
          openRouterApiKey: '',
          aiModel: 'gemini-2.5-flash',
          github: {
            pat: 'github-token',
            owner: 'testuser',
            repo: 'test-repo',
            branch: 'main'
          },
          gitlab: {
            instanceUrl: 'https://gitlab.com',
            projectId: '',
            token: '',
            branch: 'main'
          }
        };

        const url = encodeSettingsToUrl(settings);
        
        expect(url).toMatch(/^http:\/\/localhost:3000\/\?config=[A-Za-z0-9+/=]+$/);
      });

      it('encodes GitLab settings to URL', () => {
        const settings = {
          gitProvider: 'gitlab' as const,
          folder: 'work-tasks',
          aiProvider: 'openrouter' as const,
          geminiApiKey: '',
          openRouterApiKey: 'openrouter-key',
          aiModel: 'anthropic/claude-3.5-sonnet',
          github: {
            pat: '',
            owner: '',
            repo: '',
            branch: 'main'
          },
          gitlab: {
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'gitlab-token',
            branch: 'main'
          }
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

      it('should return empty string when configuration is too large for URL encoding (lines 240-241)', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Create a configuration with very large API keys that will exceed the 10000 character JSON limit
        const largeSettings = {
          gitProvider: 'github' as const,
          folder: 'todos',
          github: {
            pat: 'A'.repeat(5000), // Very long PAT 
            owner: 'owner',
            repo: 'repo',
            branch: 'main'
          },
          geminiApiKey: 'B'.repeat(4000), // Very large Gemini API key
          openRouterApiKey: 'C'.repeat(3000), // Very large OpenRouter API key
          aiModel: 'D'.repeat(500) // Additional content
        };
        
        const url = encodeSettingsToUrl(largeSettings);
        
        expect(url).toBe(''); // Should return empty string when size limit exceeded
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error encoding settings to URL',
          expect.any(Error)
        );
        
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

  describe('View Mode Persistence', () => {
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

    describe('saveViewMode', () => {
      it('saves active view mode to localStorage', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        saveViewMode('active');
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('viewMode', 'active');
        expect(loggerSpy).toHaveBeenCalledWith('View mode saved: active');
        
        loggerSpy.mockRestore();
      });

      it('saves archived view mode to localStorage', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        saveViewMode('archived');
        
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('viewMode', 'archived');
        expect(loggerSpy).toHaveBeenCalledWith('View mode saved: archived');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => saveViewMode('active')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error saving view mode to localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('loadViewMode', () => {
      it('returns stored active view mode', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['viewMode'] = 'active';
        
        const viewMode = loadViewMode();
        
        expect(viewMode).toBe('active');
        expect(loggerSpy).toHaveBeenCalledWith('View mode loaded: active');
        
        loggerSpy.mockRestore();
      });

      it('returns stored archived view mode', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['viewMode'] = 'archived';
        
        const viewMode = loadViewMode();
        
        expect(viewMode).toBe('archived');
        expect(loggerSpy).toHaveBeenCalledWith('View mode loaded: archived');
        
        loggerSpy.mockRestore();
      });

      it('returns default active mode when no view mode is stored', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        const viewMode = loadViewMode();
        
        expect(viewMode).toBe('active');
        expect(loggerSpy).toHaveBeenCalledWith('No valid view mode found, defaulting to: active');
        
        loggerSpy.mockRestore();
      });

      it('returns default active mode for invalid stored value', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['viewMode'] = 'invalid-mode';
        
        const viewMode = loadViewMode();
        
        expect(viewMode).toBe('active');
        expect(loggerSpy).toHaveBeenCalledWith('No valid view mode found, defaulting to: active');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const viewMode = loadViewMode();
        
        expect(viewMode).toBe('active');
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading view mode from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearViewMode', () => {
      it('removes view mode from localStorage', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['viewMode'] = 'archived';
        
        clearViewMode();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('viewMode');
        expect(store['viewMode']).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledWith('View mode cleared from localStorage');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearViewMode()).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing view mode from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });
  });

  describe('Draft Management', () => {
    const mockDraft: TodoDraft = {
      todoId: 'todo-123',
      path: 'todos/test-task.md',
      stableDraftKey: 'todos/test-task.md',
      editContent: '---\ntitle: Test Task\n---\n# Test Task\n\n- [ ] Task 1',
      viewContent: '---\ntitle: Test Task\n---\n# Test Task\n\n- [x] Task 1',
      hasUnsavedChanges: true,
      timestamp: Date.now()
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

    describe('saveDraft', () => {
      it('saves draft to localStorage with timestamp', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        saveDraft(mockDraft);
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('todoDraft'); // Clears existing first
        const call = mockLocalStorage.setItem.mock.calls[0];
        expect(call[0]).toBe('todoDraft');
        const savedDraft = JSON.parse(call[1]);
        expect(savedDraft.todoId).toBe(mockDraft.todoId);
        expect(savedDraft.path).toBe(mockDraft.path);
        expect(typeof savedDraft.timestamp).toBe('number');
        expect(loggerSpy).toHaveBeenCalledWith('Draft saved for todo: todos/test-task.md');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => saveDraft(mockDraft)).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error saving draft to localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('getDraft', () => {
      it('returns matching draft for same todoId and path', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['todoDraft'] = JSON.stringify(mockDraft);
        
        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toEqual(mockDraft);
        expect(loggerSpy).toHaveBeenCalledWith('Draft restored for todo: todos/test-task.md');
        
        loggerSpy.mockRestore();
      });

      it('returns null when no draft exists', () => {
        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toBeNull();
      });

      it('returns null when todoId does not match', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['todoDraft'] = JSON.stringify(mockDraft);
        
        const draft = getDraft('different-todo-456', 'todos/test-task.md');
        
        expect(draft).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Draft found but doesn\'t match current todoId. Draft: "todo-123", Current: "different-todo-456"'
        );
        
        loggerSpy.mockRestore();
      });

      it('returns null when path does not match stable draft key', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['todoDraft'] = JSON.stringify(mockDraft);
        
        const draft = getDraft('todo-123', 'todos/different-task.md');
        
        expect(draft).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Draft found but doesn't match current todo path/)
        );
        
        loggerSpy.mockRestore();
      });

      it('returns null and clears expired draft', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const expiredDraft = {
          ...mockDraft,
          timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (expired)
        };
        store['todoDraft'] = JSON.stringify(expiredDraft);
        
        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('todoDraft');
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Draft expired \(\d+ hours old\)/)
        );
        
        loggerSpy.mockRestore();
      });

      it('handles draft with missing stableDraftKey gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const draftWithoutStableKey = { ...mockDraft };
        delete (draftWithoutStableKey as any).stableDraftKey;
        store['todoDraft'] = JSON.stringify(draftWithoutStableKey);
        
        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toEqual(draftWithoutStableKey);
        expect(loggerSpy).toHaveBeenCalledWith('Draft restored for todo: todos/test-task.md');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading draft from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('handles corrupted JSON gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        store['todoDraft'] = 'invalid-json';
        
        const draft = getDraft('todo-123', 'todos/test-task.md');
        
        expect(draft).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading draft from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearDraft', () => {
      it('removes draft from localStorage with logging', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['todoDraft'] = JSON.stringify(mockDraft);
        
        clearDraft();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('todoDraft');
        expect(store['todoDraft']).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledWith('Clearing draft for todo: todos/test-task.md');
        
        loggerSpy.mockRestore();
      });

      it('handles no existing draft gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        clearDraft();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('todoDraft');
        expect(loggerSpy).not.toHaveBeenCalled();
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearDraft()).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing draft from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearOtherDrafts', () => {
      it('clears draft when it belongs to a different todo', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        store['todoDraft'] = JSON.stringify(mockDraft);
        
        clearOtherDrafts('different-todo-456');
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('todoDraft');
        expect(store['todoDraft']).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledWith('Clearing draft for different todo: todos/test-task.md');
        
        loggerSpy.mockRestore();
      });

      it('does not clear draft when it belongs to the current todo', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const draftString = JSON.stringify(mockDraft);
        store['todoDraft'] = draftString;
        
        clearOtherDrafts('todo-123');
        
        expect(store['todoDraft']).toBe(draftString);
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('todoDraft');
        expect(loggerSpy).not.toHaveBeenCalled();
        
        loggerSpy.mockRestore();
      });

      it('does nothing when no draft exists', () => {
        clearOtherDrafts('any-todo-id');
        
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearOtherDrafts('todo-123')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing other drafts from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('handles corrupted JSON gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        store['todoDraft'] = 'invalid-json';
        
        expect(() => clearOtherDrafts('todo-123')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing other drafts from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });
  });

  describe('AI Chat Session Management', () => {
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

    describe('saveChatSession', () => {
      it('saves chat session to localStorage with timestamp', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [{ role: 'user', content: 'Test message', timestamp: '2023-01-01T00:00:00.000Z' }],
          checkpoints: [],
          isExpanded: true,
          timestamp: Date.now()
        };
        
        saveChatSession(mockSession);
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('aiChatSession'); // Clears existing first
        const call = mockLocalStorage.setItem.mock.calls[0];
        expect(call[0]).toBe('aiChatSession');
        const savedSession = JSON.parse(call[1]);
        expect(savedSession.todoId).toBe(mockSession.todoId);
        expect(savedSession.path).toBe(mockSession.path);
        expect(typeof savedSession.timestamp).toBe('number');
        expect(loggerSpy).toHaveBeenCalledWith('Chat session saved for todo: tasks/test.md');
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.setItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };

        expect(() => saveChatSession(mockSession)).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error saving chat session to localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('getChatSession', () => {
      it('returns matching chat session for same todoId and path', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [{ role: 'user', content: 'Test message', timestamp: '2023-01-01T00:00:00.000Z' }],
          checkpoints: [],
          isExpanded: true,
          timestamp: Date.now()
        };
        store['aiChatSession'] = JSON.stringify(mockSession);
        
        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toEqual(mockSession);
        expect(loggerSpy).toHaveBeenCalledWith('Chat session restored for todo: tasks/test.md');
        
        loggerSpy.mockRestore();
      });

      it('returns null when no session exists', () => {
        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toBeNull();
      });

      it('returns null when todoId does not match', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };
        store['aiChatSession'] = JSON.stringify(mockSession);
        
        const session = getChatSession('different-todo-456', 'tasks/test.md');
        
        expect(session).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Chat session found but doesn\'t match current todo. Session: tasks/test.md, Current: tasks/test.md'
        );
        
        loggerSpy.mockRestore();
      });

      it('returns null when path does not match', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };
        store['aiChatSession'] = JSON.stringify(mockSession);
        
        const session = getChatSession('todo-123', 'tasks/different.md');
        
        expect(session).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Chat session found but doesn\'t match current todo. Session: tasks/test.md, Current: tasks/different.md'
        );
        
        loggerSpy.mockRestore();
      });

      it('returns null and clears session missing timestamp', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const sessionWithoutTimestamp = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false
          // missing timestamp
        };
        store['aiChatSession'] = JSON.stringify(sessionWithoutTimestamp);
        
        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('aiChatSession');
        expect(loggerSpy).toHaveBeenCalledWith('Chat session missing timestamp - clearing');
        
        loggerSpy.mockRestore();
      });

      it('returns null and clears expired session', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        const expiredSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (expired)
        };
        store['aiChatSession'] = JSON.stringify(expiredSession);
        
        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toBeNull();
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('aiChatSession');
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/Chat session expired \(\d+ hours old\)/)
        );
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading chat session from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });

      it('handles corrupted JSON gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        store['aiChatSession'] = 'invalid-json';
        
        const session = getChatSession('todo-123', 'tasks/test.md');
        
        expect(session).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error loading chat session from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearChatSession', () => {
      it('removes chat session from localStorage', () => {
        // Set up a session first
        const mockSession: AIChatSession = {
          todoId: 'todo-123',
          path: 'tasks/test.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };
        store['aiChatSession'] = JSON.stringify(mockSession);
        
        clearChatSession();
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('aiChatSession');
        expect(store['aiChatSession']).toBeUndefined();
      });

      it('logs successful chat session clearing', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        clearChatSession();
        
        expect(loggerSpy).toHaveBeenCalledWith("Chat session cleared from localStorage");
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearChatSession()).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing chat session from localStorage',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });

    describe('clearOtherChatSessions', () => {
      it('clears session when it belongs to a different todo', () => {
        const loggerSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
        
        // Set up a session for a different todo
        const mockSession: AIChatSession = {
          todoId: 'different-todo-456',
          path: 'tasks/different.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };
        store['aiChatSession'] = JSON.stringify(mockSession);
        
        clearOtherChatSessions('current-todo-123');
        
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('aiChatSession');
        expect(store['aiChatSession']).toBeUndefined();
        expect(loggerSpy).toHaveBeenCalledWith('Cleared chat session for different todo: tasks/different.md');
        
        loggerSpy.mockRestore();
      });

      it('does not clear session when it belongs to the current todo', () => {
        // Set up a session for the current todo
        const mockSession: AIChatSession = {
          todoId: 'current-todo-123',
          path: 'tasks/current.md',
          chatHistory: [],
          checkpoints: [],
          isExpanded: false,
          timestamp: Date.now()
        };
        const sessionString = JSON.stringify(mockSession);
        store['aiChatSession'] = sessionString;
        
        clearOtherChatSessions('current-todo-123');
        
        // Session should still be there
        expect(store['aiChatSession']).toBe(sessionString);
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('aiChatSession');
      });

      it('does nothing when no session exists', () => {
        clearOtherChatSessions('any-todo-id');
        
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      });

      it('handles invalid session JSON gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Set invalid JSON
        store['aiChatSession'] = 'invalid-json';
        
        expect(() => clearOtherChatSessions('current-todo-123')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing other chat sessions',
          expect.any(Error)
        );
        
        loggerSpy.mockRestore();
      });

      it('handles localStorage errors gracefully', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        mockLocalStorage.getItem.mockImplementation(() => {
          throw new Error('localStorage error');
        });

        expect(() => clearOtherChatSessions('current-todo-123')).not.toThrow();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error clearing other chat sessions',
          expect.any(Error)
        );

        loggerSpy.mockRestore();
      });
    });
  });

  describe('URL Configuration Decoding - Additional Coverage', () => {
    describe('Size Limit Validation (lines 267-268)', () => {
      it('should reject configurations that exceed size limits', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Create a very large configuration that exceeds 15000 characters
        const largeConfig = {
          g: 'github',
          f: 'todos',
          a: 'gemini',
          gh: {
            p: 'A'.repeat(15000), // Very long PAT to exceed size limit
            o: 'owner',
            r: 'repo',
            b: 'main'
          }
        };
        
        const encoded = btoa(JSON.stringify(largeConfig));
        
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error decoding settings from URL',
          expect.any(Error)
        );
        
        loggerSpy.mockRestore();
      });

      it('should reject decoded configurations that exceed 15000 character limit (lines 267-268)', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Create a configuration that when decoded will exceed 15000 characters
        const largeConfig = {
          gk: 'A'.repeat(14000), // Very large Gemini API key
          ok: 'B'.repeat(2000)   // Additional content to exceed 15000 chars
        };
        
        // Verify the decoded JSON will be large enough
        const jsonString = JSON.stringify(largeConfig);
        expect(jsonString.length).toBeGreaterThan(15000);
        
        const encoded = btoa(jsonString);
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Error decoding settings from URL',
          expect.any(Error)
        );
        
        loggerSpy.mockRestore();
      });
    });

    describe('Dual Configuration Format (lines 298-352)', () => {
      it('should handle dual-config format with GitHub provider (lines 298-315)', () => {
        const dualConfig = {
          g: 0, // GitHub provider (line 299)
          f: 'work-todos', // Custom folder (line 300)
          a: 0, // Gemini AI provider (line 301)
          gk: 'gemini-key-test', // Gemini API key (line 302)
          ok: '', // Empty OpenRouter key (line 303)
          m: 'gemini-1.5-pro', // AI model (line 304)
          gh: { // GitHub config (lines 308-315)
            p: 'github-pat-test',
            o: 'test-owner',
            r: 'test-repo',
            b: 'develop'
          }
        };
        
        const encoded = btoa(JSON.stringify(dualConfig));
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result).toEqual({
          gitProvider: 'github',
          folder: 'work-todos',
          aiProvider: 'gemini',
          geminiApiKey: 'gemini-key-test',
          openRouterApiKey: '',
          aiModel: 'gemini-1.5-pro',
          github: {
            pat: 'github-pat-test',
            owner: 'test-owner',
            repo: 'test-repo',
            branch: 'develop'
          }
        });
      });

      it('should handle dual-config format with GitLab provider (lines 318-325)', () => {
        const dualConfig = {
          g: 1, // GitLab provider (line 299)
          f: undefined, // Use default folder (line 300)
          a: 1, // OpenRouter AI provider (line 301)
          ok: 'openrouter-key-test', // OpenRouter API key (line 303)
          m: 'anthropic/claude-3.5-sonnet', // AI model (line 304)
          gl: { // GitLab config (lines 318-325)
            u: 'https://gitlab.example.com',
            i: '12345',
            t: 'gitlab-token-test',
            b: 'master'
          }
        };
        
        const encoded = btoa(JSON.stringify(dualConfig));
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result).toEqual({
          gitProvider: 'gitlab',
          folder: 'todos',
          aiProvider: 'openrouter',
          geminiApiKey: '',
          openRouterApiKey: 'openrouter-key-test',
          aiModel: 'anthropic/claude-3.5-sonnet',
          gitlab: {
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'gitlab-token-test',
            branch: 'master'
          }
        });
      });

      it('should handle legacy field compatibility (lines 328-340)', () => {
        const dualConfigWithLegacy = {
          g: 0, // GitHub provider
          f: 'todos',
          a: 0, // Gemini AI
          gh: {
            p: 'existing-pat',
            o: 'existing-owner',
            r: 'existing-repo',
            b: 'main'
          },
          // Legacy direct fields (lines 328-333)
          p: 'legacy-pat-override',
          o: 'legacy-owner-override',
          r: 'legacy-repo-override'
        };
        
        const encoded = btoa(JSON.stringify(dualConfigWithLegacy));
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result?.github).toEqual({
          pat: 'legacy-pat-override', // Legacy field should override
          owner: 'legacy-owner-override', // Legacy field should override
          repo: 'legacy-repo-override', // Legacy field should override
          branch: 'main'
        });
      });

      it('should handle GitLab legacy fields compatibility (lines 335-340)', () => {
        const dualConfigWithGitLabLegacy = {
          g: 1, // GitLab provider
          f: 'todos',
          a: 0,
          gl: {
            u: 'https://existing.gitlab.com',
            i: 'existing-project',
            t: 'existing-token',
            b: 'main'
          },
          // Legacy GitLab fields (lines 335-340)
          u: 'https://legacy.gitlab.com',
          i: 'legacy-project-id',
          t: 'legacy-token-override'
        };
        
        const encoded = btoa(JSON.stringify(dualConfigWithGitLabLegacy));
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result?.gitlab).toEqual({
          instanceUrl: 'https://legacy.gitlab.com', // Legacy field should override
          projectId: 'legacy-project-id', // Legacy field should override
          token: 'legacy-token-override', // Legacy field should override
          branch: 'main'
        });
      });

      it('should validate and reject incomplete provider configurations (lines 342-352)', () => {
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Configuration with incomplete GitHub and GitLab settings
        const incompleteConfig = {
          g: 0, // GitHub provider
          f: 'todos',
          a: 0,
          gh: {
            p: 'pat-only', // Missing owner and repo
            o: '',
            r: '',
            b: 'main'
          },
          gl: {
            u: 'https://gitlab.com',
            i: '', // Missing projectId and token
            t: '',
            b: 'main'
          }
        };
        
        const encoded = btoa(JSON.stringify(incompleteConfig));
        const result = decodeSettingsFromUrl(encoded);
        
        expect(result).toBeNull();
        expect(loggerSpy).toHaveBeenCalledWith(
          'Invalid configuration - no complete provider settings found'
        );
        
        loggerSpy.mockRestore();
      });
    });
  });
});