import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NewTodoInput from '../NewTodoInput';

const mockProps = {
  onGoalSubmit: vi.fn(),
  onCancel: vi.fn()
};

describe('NewTodoInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders goal input field', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/enter a new high-level goal/i);
      expect(goalInput).toBeInTheDocument();
    });

    it('renders generate button', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const generateButton = screen.getByText(/generate todo list/i);
      expect(generateButton).toBeInTheDocument();
    });

    it('renders cancel button when onCancel provided', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const cancelButton = screen.getByText(/cancel/i);
      expect(cancelButton).toBeInTheDocument();
    });

    it('submit button is disabled when input is empty', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const submitButton = screen.getByText(/generate todo list/i);
      expect(submitButton).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('enables submit button when goal is entered', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      await userEvent.type(input, 'Test goal');
      
      expect(submitButton).toBeEnabled();
    });

    it('calls onGoalSubmit when form is submitted', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      await userEvent.type(input, 'Deploy web application');
      await userEvent.click(submitButton);
      
      expect(mockProps.onGoalSubmit).toHaveBeenCalledWith('Deploy web application');
    });

    it('calls onCancel when cancel button is clicked', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const cancelButton = screen.getByText(/cancel/i);
      await userEvent.click(cancelButton);
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('calls onCancel when escape key is pressed', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      fireEvent.keyPress(input, { key: 'Escape' });
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('submits form when Enter key is pressed', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      
      await userEvent.type(input, 'Test goal');
      fireEvent.submit(input.closest('form'));
      
      expect(mockProps.onGoalSubmit).toHaveBeenCalledWith('Test goal');
    });
  });

  describe('Form Validation', () => {
    it('trims whitespace from goal input', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      await userEvent.type(input, '  Test goal  ');
      await userEvent.click(submitButton);
      
      expect(mockProps.onGoalSubmit).toHaveBeenCalledWith('Test goal');
    });

    it('does not submit empty or whitespace-only goals', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
      const submitButton = screen.getByText(/generate todo list/i);
      
      await userEvent.type(input, '   ');
      await userEvent.click(submitButton);
      
      expect(mockProps.onGoalSubmit).not.toHaveBeenCalled();
    });
  });
});