import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NewTodoInput from '../NewTodoInput';

const mockProps = {
  onGoalSubmit: vi.fn(),
  onCancel: vi.fn()
};

describe('NewTodoInput - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature 1: AI-Powered Task Generation UI', () => {
    it('renders modal when isOpen is true', () => {
      render(<NewTodoInput {...mockProps} />);
      
      // Check for modal content
      expect(screen.getByText(/create new task/i)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<NewTodoInput {...mockProps} isOpen={false} />);
      
      expect(screen.queryByText(/create new task/i)).not.toBeInTheDocument();
    });

    it('shows goal input field', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      expect(goalInput).toBeInTheDocument();
    });

    it('shows generate button', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const generateButton = screen.getByText(/generate/i);
      expect(generateButton).toBeInTheDocument();
    });

    it('calls onSubmit when form submitted with goal', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const generateButton = screen.getByText(/generate/i);
      
      await userEvent.type(goalInput, 'Deploy web application');
      await userEvent.click(generateButton);
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Deploy web application');
    });

    it('prevents submission with empty goal', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const generateButton = screen.getByText(/generate/i);
      await userEvent.click(generateButton);
      
      // Should not call onSubmit with empty goal
      expect(mockProps.onSubmit).not.toHaveBeenCalled();
    });

    it('calls onClose when close button clicked', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const closeButton = screen.getByText(/cancel/i) || screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when escape key pressed', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      fireEvent.keyPress(input, { key: 'Escape' });
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Feature 3: Progress Tracking UI', () => {
    it('enables submit button when goal is entered', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      // Button should be disabled initially
      expect(submitButton).toBeDisabled();
      
      // Type in goal
      await userEvent.type(input, 'Test goal');
      
      // Button should be enabled
      expect(submitButton).toBeEnabled();
    });

    it('calls onGoalSubmit when form is submitted', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      await userEvent.type(input, 'Test goal');
      await userEvent.click(submitButton);
      
      expect(mockProps.onGoalSubmit).toHaveBeenCalledWith('Test goal');
    });

    it('shows cancel button when onCancel prop is provided', () => {
      render(<NewTodoInput {...mockProps} />);
      
      expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    });
  });

  describe('Modal Behavior', () => {
    it('handles input changes correctly', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      
      await userEvent.type(goalInput, 'Test goal');
      
      expect(goalInput).toHaveValue('Test goal');
    });

    it('resets input on close', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      await userEvent.type(goalInput, 'Test goal');
      
      const closeButton = screen.getByText(/cancel/i);
      await userEvent.click(closeButton);
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('shows proper modal styling', () => {
      render(<NewTodoInput {...mockProps} />);
      
      // Check for modal overlay
      const modal = document.querySelector('.fixed.inset-0');
      expect(modal).toBeInTheDocument();
    });

    it('handles form submission on Enter key', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      
      await userEvent.type(goalInput, 'Test goal');
      fireEvent.keyDown(goalInput, { key: 'Enter' });
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Test goal');
    });
  });
});