import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveChatSession,
  getChatSession,
  clearChatSession,
  clearOtherChatSessions,
  AIChatSession,
  ChatMessage,
  Checkpoint
} from '../localStorage';

// Mock logger
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Create a working localStorage mock
const mockStorage: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AI Chat Session Persistence', () => {
  const mockTodoId = 'sha-123456';
  const mockPath = '/todos/2025-01-05-test-task.md';
  
  const mockChatMessages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Add a new feature',
      timestamp: '2025-01-05T10:00:00.000Z',
    },
    {
      role: 'assistant',
      content: 'I can help you add that feature',
      timestamp: '2025-01-05T10:01:00.000Z',
      checkpointId: 'checkpoint-1',
    },
  ];

  const mockCheckpoints: Checkpoint[] = [
    {
      id: 'checkpoint-1',
      content: '# Original Task\n\n- [ ] Original item',
      timestamp: '2025-01-05T10:00:30.000Z',
      description: 'Before AI modification',
    },
  ];

  const mockSession: AIChatSession = {
    todoId: mockTodoId,
    path: mockPath,
    chatHistory: mockChatMessages,
    checkpoints: mockCheckpoints,
    isExpanded: true,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe('saveChatSession', () => {
    it('should save chat session to localStorage', () => {
      saveChatSession(mockSession);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'aiChatSession',
        expect.stringContaining(mockTodoId)
      );
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.todoId).toBe(mockTodoId);
      expect(savedData.path).toBe(mockPath);
      expect(savedData.chatHistory).toEqual(mockChatMessages);
      expect(savedData.checkpoints).toEqual(mockCheckpoints);
      expect(savedData.isExpanded).toBe(true);
      expect(savedData.timestamp).toBeTypeOf('number');
    });

    it('should clear existing session before saving new one', () => {
      // Save first session
      saveChatSession(mockSession);
      
      // Save different session
      const newSession = { ...mockSession, todoId: 'different-id' };
      saveChatSession(newSession);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aiChatSession');
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveChatSession(mockSession)).not.toThrow();
    });
  });

  describe('getChatSession', () => {
    it('should retrieve chat session for matching todo', () => {
      saveChatSession(mockSession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.todoId).toBe(mockTodoId);
      expect(retrieved!.path).toBe(mockPath);
      expect(retrieved!.chatHistory).toEqual(mockChatMessages);
      expect(retrieved!.checkpoints).toEqual(mockCheckpoints);
      expect(retrieved!.isExpanded).toBe(true);
    });

    it('should return null when no session exists', () => {
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeNull();
    });

    it('should return null when session todoId does not match', () => {
      saveChatSession(mockSession);
      
      const retrieved = getChatSession('different-id', mockPath);
      
      expect(retrieved).toBeNull();
    });

    it('should return null when session path does not match', () => {
      saveChatSession(mockSession);
      
      const retrieved = getChatSession(mockTodoId, '/different/path.md');
      
      expect(retrieved).toBeNull();
    });

    it('should return null and clear expired session', () => {
      // Save a session with an expired timestamp
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const expiredSession = {
        ...mockSession,
        timestamp: expiredTimestamp,
      };
      
      // Manually set the localStorage to avoid the timestamp override in saveChatSession
      mockStorage['aiChatSession'] = JSON.stringify(expiredSession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aiChatSession');
    });

    it('should handle corrupted session data gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage access error');
      });

      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeNull();
    });
  });

  describe('clearChatSession', () => {
    it('should remove chat session from localStorage', () => {
      saveChatSession(mockSession);
      clearChatSession();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aiChatSession');
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      expect(retrieved).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage access error');
      });

      expect(() => clearChatSession()).not.toThrow();
    });
  });

  describe('clearOtherChatSessions', () => {
    it('should clear session for different todo', () => {
      saveChatSession(mockSession);
      
      clearOtherChatSessions('different-todo-id');
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('aiChatSession');
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      expect(retrieved).toBeNull();
    });

    it('should not clear session for same todo', () => {
      saveChatSession(mockSession);
      
      clearOtherChatSessions(mockTodoId);
      
      // removeItem should not be called (beyond the initial save)
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(1); // Only from saveChatSession
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      expect(retrieved).toBeTruthy();
    });

    it('should handle no existing session gracefully', () => {
      clearOtherChatSessions('any-todo-id');
      
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('should handle corrupted session data gracefully', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json');
      
      expect(() => clearOtherChatSessions('any-todo-id')).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage access error');
      });

      expect(() => clearOtherChatSessions('any-todo-id')).not.toThrow();
    });
  });

  describe('Session expiry', () => {
    it('should accept sessions within expiry window', () => {
      const recentTimestamp = Date.now() - (23 * 60 * 60 * 1000); // 23 hours ago
      const recentSession = {
        ...mockSession,
        timestamp: recentTimestamp,
      };
      
      // Manually set the localStorage to avoid the timestamp override in saveChatSession
      mockStorage['aiChatSession'] = JSON.stringify(recentSession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.todoId).toBe(mockTodoId);
    });

    it('should reject sessions outside expiry window', () => {
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const expiredSession = {
        ...mockSession,
        timestamp: expiredTimestamp,
      };
      
      // Manually set the localStorage to avoid the timestamp override in saveChatSession
      mockStorage['aiChatSession'] = JSON.stringify(expiredSession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty chat history', () => {
      const emptySession = {
        ...mockSession,
        chatHistory: [],
        checkpoints: [],
      };
      
      saveChatSession(emptySession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.chatHistory).toEqual([]);
      expect(retrieved!.checkpoints).toEqual([]);
    });

    it('should handle session with only expanded state', () => {
      const minimalSession = {
        ...mockSession,
        chatHistory: [],
        checkpoints: [],
        isExpanded: true,
      };
      
      saveChatSession(minimalSession);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      expect(retrieved).toBeTruthy();
      expect(retrieved!.isExpanded).toBe(true);
    });

    it('should handle missing timestamp gracefully', () => {
      const sessionWithoutTimestamp = {
        todoId: mockTodoId,
        path: mockPath,
        chatHistory: mockChatMessages,
        checkpoints: mockCheckpoints,
        isExpanded: true,
      };
      
      // Manually set the storage to simulate old data without timestamp
      mockStorage['aiChatSession'] = JSON.stringify(sessionWithoutTimestamp);
      
      const retrieved = getChatSession(mockTodoId, mockPath);
      
      // Should return null due to missing timestamp causing expiry check to fail
      expect(retrieved).toBeNull();
    });
  });
});