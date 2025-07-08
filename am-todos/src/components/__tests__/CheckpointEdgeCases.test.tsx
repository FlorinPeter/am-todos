import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AIChat from '../AIChat';
import * as localStorage from '../../utils/localStorage';

// Mock localStorage functions
vi.mock('../../utils/localStorage', () => ({
  saveCheckpoint: vi.fn(),
  getCheckpoints: vi.fn(() => []),
  clearCheckpoints: vi.fn(),
  generateCheckpointId: vi.fn(() => 'test-checkpoint-id'),
  saveSettings: vi.fn(),
  loadSettings: vi.fn(),
  encodeSettingsToUrl: vi.fn(),
  decodeSettingsFromUrl: vi.fn(),
  getUrlConfig: vi.fn()
}));

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

describe('Checkpoint System Edge Cases', () => {
  const mockProps = {
    currentContent: '# Test Todo\n\n- [ ] Task 1\n- [ ] Task 2',
    onContentUpdate: vi.fn(),
    onChatMessage: vi.fn().mockResolvedValue('Updated content'),
    taskId: 'test-task-id',
    onCheckpointRestore: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getCheckpoints).mockReturnValue([]);
    vi.mocked(localStorage.generateCheckpointId).mockReturnValue('test-checkpoint-id');
  });

  describe('localStorage Edge Cases', () => {
    it('handles localStorage quota exceeded gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(localStorage.saveCheckpoint).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });

      // Should not crash the application
      expect(screen.getByText('Task updated successfully')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('handles corrupted checkpoint data gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(localStorage.getCheckpoints).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      render(<AIChat {...mockProps} />);
      
      // Should render without crashing
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('handles missing taskId gracefully', async () => {
      render(<AIChat {...mockProps} taskId={undefined} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });

      // Should not attempt to save checkpoint
      expect(localStorage.saveCheckpoint).not.toHaveBeenCalled();
    });

    it('handles empty taskId gracefully', async () => {
      render(<AIChat {...mockProps} taskId="" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });

      // Should not attempt to save checkpoint with empty taskId
      expect(localStorage.saveCheckpoint).not.toHaveBeenCalled();
    });
  });

  describe('UI Edge Cases', () => {
    it('handles very long chat messages', async () => {
      const veryLongMessage = 'a'.repeat(1000);
      
      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, veryLongMessage);
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(localStorage.saveCheckpoint).toHaveBeenCalledWith('test-task-id', {
          id: 'test-checkpoint-id',
          content: mockProps.currentContent,
          timestamp: expect.any(String),
          chatMessage: veryLongMessage,
          description: `Before: ${veryLongMessage.substring(0, 40)}...`
        });
      });
    });

    it('handles special characters in chat messages', async () => {
      const specialMessage = '🎯 Add emoji support & special chars: <script>alert("test")</script>';
      
      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, specialMessage);
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(localStorage.saveCheckpoint).toHaveBeenCalledWith('test-task-id', {
          id: 'test-checkpoint-id',
          content: mockProps.currentContent,
          timestamp: expect.any(String),
          chatMessage: specialMessage,
          description: `Before: ${specialMessage.substring(0, 40)}...`
        });
      });
    });

    it('handles multiple rapid checkpoint creations', async () => {
      let callCount = 0;
      vi.mocked(localStorage.generateCheckpointId).mockImplementation(() => `checkpoint-${++callCount}`);

      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      // Send multiple messages rapidly
      for (let i = 0; i < 3; i++) {
        await userEvent.clear(input);
        await userEvent.type(input, `Message ${i + 1}`);
        await userEvent.click(sendButton);
        
        await waitFor(() => {
          expect(localStorage.saveCheckpoint).toHaveBeenCalledWith('test-task-id', {
            id: `checkpoint-${i + 1}`,
            content: mockProps.currentContent,
            timestamp: expect.any(String),
            chatMessage: `Message ${i + 1}`,
            description: `Before: Message ${i + 1}`
          });
        });
      }

      expect(localStorage.saveCheckpoint).toHaveBeenCalledTimes(3);
    });
  });

  describe('Checkpoint Restore Edge Cases', () => {
    it('handles restore of non-existent checkpoint', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(localStorage.getCheckpoints).mockReturnValue([]);

      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Restore')).toBeInTheDocument();
      });

      // Try to restore with non-existent checkpoint
      const restoreButton = screen.getByText('Restore');
      await userEvent.click(restoreButton);

      // Should not crash or call restore callback
      expect(mockProps.onCheckpointRestore).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles restore callback errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockCheckpoint = {
        id: 'test-checkpoint-id',
        content: 'Test content',
        timestamp: '2023-01-01T12:00:00.000Z',
        chatMessage: 'Test message',
        description: 'Before: Test message'
      };

      vi.mocked(localStorage.getCheckpoints).mockReturnValue([mockCheckpoint]);
      mockProps.onCheckpointRestore.mockImplementation(() => {
        throw new Error('Restore failed');
      });
      window.confirm = vi.fn().mockReturnValue(true);

      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Restore')).toBeInTheDocument();
      });

      const restoreButton = screen.getByText('Restore');
      await userEvent.click(restoreButton);

      // Should not crash the application
      expect(window.confirm).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles missing onCheckpointRestore callback', async () => {
      render(<AIChat {...mockProps} onCheckpointRestore={undefined} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Task updated successfully')).toBeInTheDocument();
      });

      // Should not show restore button when callback is missing
      expect(screen.queryByText('Restore')).not.toBeInTheDocument();
    });
  });

  describe('Component Lifecycle Edge Cases', () => {
    it('handles taskId changes during active chat session', async () => {
      const { rerender } = render(<AIChat {...mockProps} taskId="task-1" />);
      
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      await userEvent.type(input, 'Test message');

      // Change taskId while input has content
      rerender(<AIChat {...mockProps} taskId="task-2" />);

      // Should load checkpoints for new task
      expect(localStorage.getCheckpoints).toHaveBeenCalledWith('task-2');
    });

    it('handles component unmounting during checkpoint operation', async () => {
      const { unmount } = render(<AIChat {...mockProps} />);
      
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Unmount component while processing
      unmount();

      // Should not cause memory leaks or errors
      expect(localStorage.saveCheckpoint).toHaveBeenCalled();
    });

    it('handles content changes during checkpoint creation', async () => {
      const { rerender } = render(<AIChat {...mockProps} />);
      
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);

      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });

      await userEvent.type(input, 'Test message');
      
      // Change content while processing
      rerender(<AIChat {...mockProps} currentContent="# Changed content" />);
      
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(localStorage.saveCheckpoint).toHaveBeenCalledWith('test-task-id', {
          id: 'test-checkpoint-id',
          content: '# Changed content', // Should use the updated content
          timestamp: expect.any(String),
          chatMessage: 'Test message',
          description: 'Before: Test message'
        });
      });
    });
  });
});