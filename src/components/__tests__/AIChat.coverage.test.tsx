import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AIChat from '../AIChat';
import * as localStorage from '../../utils/localStorage';

// Mock modules
vi.mock('../../utils/localStorage', () => ({
  saveCheckpoint: vi.fn(),
  getCheckpoints: vi.fn(() => []),
  clearCheckpoints: vi.fn(),
  generateCheckpointId: vi.fn(() => 'test-checkpoint-id'),
  saveSettings: vi.fn(),
  saveChatSession: vi.fn(),
  getChatSession: vi.fn(() => null),
  clearChatSession: vi.fn(),
  clearOtherChatSessions: vi.fn(),
  loadSettings: vi.fn(),
  encodeSettingsToUrl: vi.fn(),
  decodeSettingsFromUrl: vi.fn(),
  getUrlConfig: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn()
  }
}));

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

const defaultProps = {
  currentContent: '# Test Todo\n\n- [ ] Task 1\n- [ ] Task 2',
  onContentUpdate: vi.fn(),
  onChatMessage: vi.fn().mockResolvedValue({
    content: 'Updated content',
    description: 'Task updated successfully'
  }),
  taskId: 'test-task-id',
  todoId: 'todo-123',
  filePath: '/todos/test.md',
  onCheckpointRestore: vi.fn()
};

describe('AIChat Coverage Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error handling coverage (lines 161-162)', () => {
    it('should handle AI API key errors specifically', async () => {
      const apiKeyError = new Error('Invalid API key provided');
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockRejectedValue(apiKeyError)
      };

      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should handle API key error specifically (line 157)
      await waitFor(() => {
        expect(screen.getByText(/Invalid or missing AI API key/)).toBeInTheDocument();
      });
    });

    it('should handle network errors specifically', async () => {
      const networkError = new Error('Network error: Unable to connect');
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockRejectedValue(networkError)
      };

      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should handle network error specifically (line 159)
      await waitFor(() => {
        expect(screen.getByText(/Unable to connect to AI service/)).toBeInTheDocument();
      });
    });

    it('should handle AI API errors specifically', async () => {
      const aiApiError = new Error('AI API error: Rate limit exceeded');
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockRejectedValue(aiApiError)
      };

      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should handle AI API error specifically (lines 160-162)
      await waitFor(() => {
        expect(screen.getByText(/Error: AI API error: Rate limit exceeded/)).toBeInTheDocument();
      });
    });

    it('should handle generic errors without specific message patterns', async () => {
      const genericError = new Error('Something went wrong');
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockRejectedValue(genericError)
      };

      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should fall back to generic error message
      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error processing your request/)).toBeInTheDocument();
      });
    });

    it('should handle non-Error objects thrown as errors', async () => {
      const stringError = 'String error message';
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockRejectedValue(stringError)
      };

      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should handle non-Error objects (testing the else branch of instanceof Error)
      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error processing your request/)).toBeInTheDocument();
      });
    });
  });

  describe('Key press handling coverage (lines 186-188)', () => {
    it('should handle Enter key with shift modifier (no send)', async () => {
      render(<AIChat {...defaultProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      
      await userEvent.type(input, 'Test message');
      
      // Press Shift+Enter (should NOT trigger send - line 186)
      await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
      
      // Message should not be sent
      expect(defaultProps.onChatMessage).not.toHaveBeenCalled();
      expect(input).toHaveValue('Test message');
    });

    it('should handle Enter key without shift modifier (should send)', async () => {
      render(<AIChat {...defaultProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      
      await userEvent.type(input, 'Test message');
      
      // Press Enter without shift (should trigger send - line 187)
      await userEvent.keyboard('{Enter}');
      
      // Message should be sent
      await waitFor(() => {
        expect(defaultProps.onChatMessage).toHaveBeenCalledWith('Test message', defaultProps.currentContent, []);
      });
    });

    it('should handle non-Enter key presses (no action)', async () => {
      render(<AIChat {...defaultProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      
      await userEvent.type(input, 'Test');
      
      // Press other keys (should not trigger send - covering else case of line 185)
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Tab}');
      await userEvent.keyboard('{Space}');
      
      // Message should not be sent
      expect(defaultProps.onChatMessage).not.toHaveBeenCalled();
    });

    it('should handle non-Enter keys without triggering send', async () => {
      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockResolvedValue({
          content: 'Updated content',
          description: 'Task updated successfully'
        })
      };
      
      render(<AIChat {...mockProps} />);
      
      // Expand chat
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      
      await userEvent.type(input, 'Test message');
      
      // Test various non-Enter keys that should NOT trigger send (covers else case at line 188)
      await userEvent.keyboard('{Escape}');
      await userEvent.keyboard('{Tab}');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Backspace}');
      
      // None should trigger send
      expect(mockProps.onChatMessage).not.toHaveBeenCalled();
      
      // Now test Enter without shift to verify sending still works
      await userEvent.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalledWith('Test message', mockProps.currentContent, []);
      });
    });
  });

  describe('Component unmounting edge cases', () => {
    it('should handle unmounting during processing', async () => {
      let resolvePromise: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockReturnValue(slowPromise)
      };

      const { unmount } = render(<AIChat {...mockProps} />);
      
      // Expand chat and send message
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Unmount component while processing
      unmount();
      
      // Resolve the promise after unmounting
      resolvePromise!({
        content: 'Response after unmount',
        description: 'This should be handled gracefully'
      });
      
      // Should not cause errors or warnings
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
    });

    it('should handle error during processing when unmounted', async () => {
      let rejectPromise: (error: any) => void;
      const slowPromise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      const mockProps = {
        ...defaultProps,
        onChatMessage: vi.fn().mockReturnValue(slowPromise)
      };

      const { unmount } = render(<AIChat {...mockProps} />);
      
      // Expand chat and send message
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Unmount component while processing
      unmount();
      
      // Reject the promise after unmounting
      rejectPromise!(new Error('Error after unmount'));
      
      // Should not cause errors or warnings
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
    });

  });
});