import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AIChat from '../AIChat';

const mockProps = {
  currentContent: '# Test Todo\n\n- [ ] Task 1\n- [ ] Task 2',
  onContentUpdate: vi.fn(),
  onChatMessage: vi.fn().mockResolvedValue('Updated content with new task')
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
        expect(mockProps.onContentUpdate).toHaveBeenCalledWith('Updated content with new task');
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
});