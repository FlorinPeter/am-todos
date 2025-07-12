import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AIChat from '../AIChat';
import * as localStorage from '../../utils/localStorage';

// Mock the localStorage utilities
vi.mock('../../utils/localStorage', () => ({
  saveChatSession: vi.fn(),
  getChatSession: vi.fn(),
  clearChatSession: vi.fn(),
  clearOtherChatSessions: vi.fn(),
  saveCheckpoint: vi.fn(),
  getCheckpoints: vi.fn(() => []),
  clearCheckpoints: vi.fn(),
  generateCheckpointId: vi.fn(() => 'test-checkpoint-id'),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scrollIntoView
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

describe('AIChat Chat Persistence Integration', () => {
  const mockProps = {
    currentContent: '# Test Task\n\n- [ ] Test item',
    onContentUpdate: vi.fn(),
    onChatMessage: vi.fn(),
    taskId: 'task-123',
    todoId: 'sha-123456',
    filePath: '/todos/2025-01-05-test-task.md',
    onCheckpointRestore: vi.fn(),
  };

  const mockChatHistory = [
    {
      role: 'user' as const,
      content: 'Add a new feature',
      timestamp: '2025-01-05T10:00:00.000Z',
    },
    {
      role: 'assistant' as const,
      content: 'I can help you add that feature',
      timestamp: '2025-01-05T10:01:00.000Z',
      checkpointId: 'checkpoint-1',
    },
  ];

  const mockCheckpoints = [
    {
      id: 'checkpoint-1',
      content: '# Original Task\n\n- [ ] Original item',
      timestamp: '2025-01-05T10:00:30.000Z',
      description: 'Before AI modification',
    },
  ];

  const mockSession = {
    todoId: 'sha-123456',
    path: '/todos/2025-01-05-test-task.md',
    chatHistory: mockChatHistory,
    checkpoints: mockCheckpoints,
    isExpanded: true,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session restoration on mount', () => {
    it('should restore chat session if it exists for the current todo', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(mockSession);
      
      render(<AIChat {...mockProps} />);

      // Should call getChatSession with correct parameters
      expect(localStorage.getChatSession).toHaveBeenCalledWith(
        mockProps.todoId,
        mockProps.filePath
      );

      // Should display restored chat history
      expect(screen.getByText('Add a new feature')).toBeInTheDocument();
      expect(screen.getByText('I can help you add that feature')).toBeInTheDocument();
      
      // Should be expanded due to restored state
      expect(screen.getByPlaceholderText('Ask me to modify this task...')).toBeInTheDocument();
    });

    it('should initialize empty state when no session exists', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      
      render(<AIChat {...mockProps} />);

      expect(localStorage.getChatSession).toHaveBeenCalledWith(
        mockProps.todoId,
        mockProps.filePath
      );

      // Should show collapsed state  
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Ask me to modify this task...')).not.toBeInTheDocument();
    });

    it('should handle missing todoId gracefully', () => {
      const propsWithoutTodoId = { ...mockProps, todoId: undefined };
      
      render(<AIChat {...propsWithoutTodoId} />);

      expect(localStorage.getChatSession).not.toHaveBeenCalled();
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });

    it('should handle missing filePath gracefully', () => {
      const propsWithoutFilePath = { ...mockProps, filePath: undefined };
      
      render(<AIChat {...propsWithoutFilePath} />);

      expect(localStorage.getChatSession).not.toHaveBeenCalled();
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });

    it('should handle corrupted session data gracefully', () => {
      vi.mocked(localStorage.getChatSession).mockImplementation(() => {
        throw new Error('Corrupted session data');
      });
      
      render(<AIChat {...mockProps} />);

      // Should still render but with empty state
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
      expect(screen.queryByText('Add a new feature')).not.toBeInTheDocument();
    });
  });

  describe('Session auto-saving', () => {
    it('should save session when chat history changes', async () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      mockProps.onChatMessage.mockResolvedValue('AI response');
      
      render(<AIChat {...mockProps} />);

      // Expand chat and send a message
      fireEvent.click(screen.getByText('AI Chat Assistant'));
      
      const input = screen.getByPlaceholderText('Ask me to modify this task...');
      fireEvent.change(input, { target: { value: 'Test message' } });
      // Click the send button (it's the button next to the input)
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(button => 
        button.querySelector('svg') && !button.textContent?.includes('AI Chat Assistant')
      );
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(localStorage.saveChatSession).toHaveBeenCalledWith(
          expect.objectContaining({
            todoId: mockProps.todoId,
            path: mockProps.filePath,
            chatHistory: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Test message',
              }),
            ]),
            isExpanded: true,
            timestamp: expect.any(Number),
          })
        );
      });
    });

    it('should save session when expanded state changes', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      
      render(<AIChat {...mockProps} />);

      // Expand chat
      fireEvent.click(screen.getByText('AI Chat Assistant'));

      expect(localStorage.saveChatSession).toHaveBeenCalledWith(
        expect.objectContaining({
          todoId: mockProps.todoId,
          path: mockProps.filePath,
          isExpanded: true,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not save session when todoId or filePath is missing', () => {
      const propsWithoutIds = { ...mockProps, todoId: undefined, filePath: undefined };
      
      render(<AIChat {...propsWithoutIds} />);

      // Expand chat
      fireEvent.click(screen.getByText('AI Chat Assistant'));

      expect(localStorage.saveChatSession).not.toHaveBeenCalled();
    });

    it('should handle save errors gracefully', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      vi.mocked(localStorage.saveChatSession).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      render(<AIChat {...mockProps} />);

      // Should not crash when save fails
      fireEvent.click(screen.getByText('AI Chat Assistant'));
      
      expect(screen.getByPlaceholderText('Ask me to modify this task...')).toBeInTheDocument();
    });
  });

  describe('Checkpoints persistence', () => {
    it('should restore checkpoints from session', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(mockSession);
      
      render(<AIChat {...mockProps} />);

      // Should display checkpoint restoration option
      expect(screen.getByTitle('Restore to this checkpoint')).toBeInTheDocument();
    });

    it('should save checkpoints with session', async () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      mockProps.onChatMessage.mockResolvedValue('AI response');
      
      render(<AIChat {...mockProps} />);

      // Expand chat and send a message (this creates a checkpoint)
      fireEvent.click(screen.getByText('AI Chat Assistant'));
      
      const input = screen.getByPlaceholderText('Ask me to modify this task...');
      fireEvent.change(input, { target: { value: 'Test message' } });
      // Click the send button (it's the button next to the input)
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(button => 
        button.querySelector('svg') && !button.textContent?.includes('AI Chat Assistant')
      );
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(localStorage.saveChatSession).toHaveBeenCalledWith(
          expect.objectContaining({
            checkpoints: expect.any(Array),
          })
        );
      });
    });
  });

  describe('Todo switching behavior', () => {
    it('should initialize fresh state when todo changes', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(mockSession);
      
      const { rerender } = render(<AIChat {...mockProps} />);

      // Should show restored chat
      expect(screen.getByText('Add a new feature')).toBeInTheDocument();

      // Change to different todo
      const newProps = {
        ...mockProps,
        todoId: 'different-sha',
        filePath: '/todos/different-task.md',
      };
      
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      rerender(<AIChat {...newProps} />);

      // Should call getChatSession with new parameters
      expect(localStorage.getChatSession).toHaveBeenLastCalledWith(
        'different-sha',
        '/todos/different-task.md'
      );

      // Previous chat should not be visible
      expect(screen.queryByText('Add a new feature')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty session restore gracefully', () => {
      const emptySession = {
        ...mockSession,
        chatHistory: [],
        checkpoints: [],
        isExpanded: false,
      };
      
      vi.mocked(localStorage.getChatSession).mockReturnValue(emptySession);
      
      render(<AIChat {...mockProps} />);

      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Ask me to modify this task...')).not.toBeInTheDocument();
    });

    it('should handle session with only expanded state', () => {
      const expandedOnlySession = {
        ...mockSession,
        chatHistory: [],
        checkpoints: [],
        isExpanded: true,
      };
      
      vi.mocked(localStorage.getChatSession).mockReturnValue(expandedOnlySession);
      
      render(<AIChat {...mockProps} />);

      expect(screen.getByPlaceholderText('Ask me to modify this task...')).toBeInTheDocument();
    });

    it('should not save session when state is empty', () => {
      vi.mocked(localStorage.getChatSession).mockReturnValue(null);
      
      render(<AIChat {...mockProps} />);

      // Initial render with empty state should not trigger save
      expect(localStorage.saveChatSession).not.toHaveBeenCalled();
    });
  });
});