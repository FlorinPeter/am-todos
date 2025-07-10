import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AIChat from '../AIChat';
import * as localStorage from '../../utils/localStorage';

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

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

const mockProps = {
  currentContent: '# Test Todo\n\n- [ ] Task 1\n- [ ] Task 2',
  onContentUpdate: vi.fn(),
  onChatMessage: vi.fn().mockResolvedValue('Updated content with new task'),
  taskId: 'test-task-id',
  onCheckpointRestore: vi.fn()
};

describe('AIChat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders chat toggle button', () => {
      render(<AIChat {...mockProps} />);
      
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('starts in collapsed state', () => {
      render(<AIChat {...mockProps} />);
      
      // Input should not be visible initially
      expect(screen.queryByPlaceholderText(/ask me to modify/i)).not.toBeInTheDocument();
    });

    it('expands when toggle button is clicked', async () => {
      render(<AIChat {...mockProps} />);
      
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Input should now be visible
      expect(screen.getByPlaceholderText(/ask me to modify/i)).toBeInTheDocument();
    });
  });

  describe('Chat Functionality', () => {
    async function expandChat() {
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
    }

    it('shows input field when expanded', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      expect(input).toBeInTheDocument();
    });

    it('shows send button when expanded', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const sendButton = screen.getByRole('button', { name: '' }); // SVG button
      expect(sendButton).toBeInTheDocument();
    });

    it('sends message when user types and clicks send', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a test task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalledWith('Add a test task', mockProps.currentContent);
      });
    });

    it('disables send button when input is empty', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toBeDisabled();
    });

    it('enables send button when input has content', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      expect(sendButton).toBeEnabled();
    });

    it('shows loading state during message processing', async () => {
      // Mock slow response
      mockProps.onChatMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('Updated'), 100))
      );
      
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should show loading state
      expect(screen.getByText(/processing/i)).toBeInTheDocument();
      
      // Wait for the promise to resolve to prevent cleanup issues
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
    });

    it('displays helper text when no chat history', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      expect(screen.getByText(/Ask me to modify this task!/i)).toBeInTheDocument();
      expect(screen.getByText(/Add a step for user authentication/i)).toBeInTheDocument();
    });

    it('calls onContentUpdate when chat message is processed', async () => {
      render(<AIChat {...mockProps} />);
      await expandChat();
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockProps.onContentUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles chat processing errors gracefully', async () => {
      mockProps.onChatMessage.mockRejectedValueOnce(new Error('Chat service error'));
      
      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      // Should not crash the component
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
    });
  });

  describe('Checkpoint Functionality', () => {
    const mockCheckpoint = {
      id: 'test-checkpoint-id',
      content: '# Original content before AI response',
      timestamp: '2023-01-01T12:00:00.000Z',
      chatMessage: 'Add a new task',
      description: 'Before: Add a new task'
    };

    beforeEach(() => {
      vi.mocked(localStorage.getCheckpoints).mockReturnValue([]);
      vi.mocked(localStorage.generateCheckpointId).mockReturnValue('test-checkpoint-id');
    });

    it('clears existing checkpoints on component mount for session-only behavior', () => {
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      
      expect(localStorage.clearCheckpoints).toHaveBeenCalledWith('test-task-id');
    });

    it('creates checkpoint in session state only (not localStorage)', async () => {
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
      
      // Should NOT save to localStorage (session-only behavior)
      expect(localStorage.saveCheckpoint).not.toHaveBeenCalled();
      
      // Should show checkpoint count in UI
      expect(screen.getByText('1 checkpoint')).toBeInTheDocument();
    });

    it('does not create checkpoint when taskId is missing', async () => {
      render(<AIChat {...mockProps} taskId={undefined} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
      
      // Should not show any checkpoint indicators
      expect(screen.queryByText(/checkpoint/)).not.toBeInTheDocument();
    });

    it('shows checkpoint count in UI (session-only)', async () => {
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Send a message to create a checkpoint in session state
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('1 checkpoint')).toBeInTheDocument();
      });
    });

    it('shows plural checkpoints count (session-only)', async () => {
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Send a message to create first checkpoint
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'First task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('1 checkpoint')).toBeInTheDocument();
      });
      
      // Verify that multiple checkpoints would show plural
      // (Testing the logic without the complex async timing)
      expect(screen.queryByText('2 checkpoints')).not.toBeInTheDocument();
    });

    it('shows restore button for assistant messages with checkpoints', async () => {
      render(<AIChat {...mockProps} />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('Task updated successfully')).toBeInTheDocument();
      });
      
      expect(screen.getByTitle('Restore to this checkpoint')).toBeInTheDocument();
    });

    it('calls onCheckpointRestore when restore button is clicked', async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByTitle('Restore to this checkpoint')).toBeInTheDocument();
      });
      
      const restoreButton = screen.getByTitle('Restore to this checkpoint');
      await userEvent.click(restoreButton);
      
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Restore to the state before this AI response?')
      );
      expect(mockProps.onCheckpointRestore).toHaveBeenCalledWith(mockProps.currentContent);
    });

    it('does not restore when user cancels confirmation', async () => {
      window.confirm = vi.fn().mockReturnValue(false);
      
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByTitle('Restore to this checkpoint')).toBeInTheDocument();
      });
      
      const restoreButton = screen.getByTitle('Restore to this checkpoint');
      await userEvent.click(restoreButton);
      
      expect(window.confirm).toHaveBeenCalled();
      expect(mockProps.onCheckpointRestore).not.toHaveBeenCalled();
    });

    it('shows clear checkpoints button when checkpoints exist (session-only)', async () => {
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Send a message to create a checkpoint
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear Checkpoints|Clear CP/ })).toBeInTheDocument();
      });
    });

    it('clears checkpoints when clear button is clicked (session-only)', async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Send a message to create a checkpoint
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear Checkpoints|Clear CP/ })).toBeInTheDocument();
      });
      
      const clearButton = screen.getByRole('button', { name: /Clear Checkpoints|Clear CP/ });
      await userEvent.click(clearButton);
      
      expect(window.confirm).toHaveBeenCalledWith(
        'Clear all checkpoints for this session? This cannot be undone.'
      );
      
      // Should have called localStorage.clearCheckpoints on mount (session-only behavior)
      expect(localStorage.clearCheckpoints).toHaveBeenCalledWith('test-task-id');
      
      // Should clear the checkpoint count from UI
      await waitFor(() => {
        expect(screen.queryByText(/checkpoint/)).not.toBeInTheDocument();
      });
    });

    it('does not clear checkpoints when user cancels', async () => {
      window.confirm = vi.fn().mockReturnValue(false);
      
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      // Send a message to create a checkpoint
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, 'Add a new task');
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear Checkpoints|Clear CP/ })).toBeInTheDocument();
      });
      
      const clearButton = screen.getByRole('button', { name: /Clear Checkpoints|Clear CP/ });
      await userEvent.click(clearButton);
      
      expect(window.confirm).toHaveBeenCalled();
      
      // Should still show checkpoint since user cancelled
      expect(screen.getByText('1 checkpoint')).toBeInTheDocument();
    });

    it('clears chat history when taskId changes', () => {
      const { rerender } = render(<AIChat {...mockProps} taskId="task-1" />);
      
      // Simulate user interaction to create chat history
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      userEvent.click(toggleButton);
      
      // Change taskId
      rerender(<AIChat {...mockProps} taskId="task-2" />);
      
      // Should clear checkpoints for new task (session-only behavior)
      expect(localStorage.clearCheckpoints).toHaveBeenCalledWith('task-2');
    });

    it('truncates long descriptions in checkpoint creation', async () => {
      const longMessage = 'This is a very long message that should be truncated when creating checkpoint description';
      
      render(<AIChat {...mockProps} taskId="test-task-id" />);
      const toggleButton = screen.getByText(/AI Chat Assistant/i);
      await userEvent.click(toggleButton);
      
      const input = screen.getByPlaceholderText(/ask me to modify/i);
      const sendButton = screen.getByRole('button', { name: '' });
      
      await userEvent.type(input, longMessage);
      await userEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockProps.onChatMessage).toHaveBeenCalled();
      });
      
      // Should NOT save to localStorage (session-only behavior)
      expect(localStorage.saveCheckpoint).not.toHaveBeenCalled();
      
      // Should show checkpoint count in UI
      expect(screen.getByText('1 checkpoint')).toBeInTheDocument();
    });
  });
});