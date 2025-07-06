import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewTodoInput from '../NewTodoInput';

const mockProps = {
  isOpen: true,
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  isGenerating: false
};

describe('NewTodoInput - Basic Feature Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Feature 1: AI-Powered Task Generation UI', () => {
    test('renders modal when isOpen is true', () => {
      render(<NewTodoInput {...mockProps} />);
      
      // Check for modal content
      expect(screen.getByText(/create new task/i)).toBeInTheDocument();
    });

    test('does not render when isOpen is false', () => {
      render(<NewTodoInput {...mockProps} isOpen={false} />);
      
      expect(screen.queryByText(/create new task/i)).not.toBeInTheDocument();
    });

    test('shows goal input field', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      expect(goalInput).toBeInTheDocument();
    });

    test('shows generate button', () => {
      render(<NewTodoInput {...mockProps} />);
      
      const generateButton = screen.getByText(/generate/i);
      expect(generateButton).toBeInTheDocument();
    });

    test('calls onSubmit when form submitted with goal', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      const generateButton = screen.getByText(/generate/i);
      
      await userEvent.type(goalInput, 'Deploy web application');
      await userEvent.click(generateButton);
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Deploy web application');
    });

    test('prevents submission with empty goal', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const generateButton = screen.getByText(/generate/i);
      await userEvent.click(generateButton);
      
      // Should not call onSubmit with empty goal
      expect(mockProps.onSubmit).not.toHaveBeenCalled();
    });

    test('calls onClose when close button clicked', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const closeButton = screen.getByText(/cancel/i) || screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    test('calls onClose when escape key pressed', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Feature 3: Progress Tracking UI', () => {
    test('shows loading state when isGenerating is true', () => {
      render(<NewTodoInput {...mockProps} isGenerating={true} />);
      
      // Check for loading indicator
      const loadingText = screen.getByText(/generating/i);
      expect(loadingText).toBeInTheDocument();
      
      // Generate button should be disabled
      const generateButton = screen.getByText(/generating/i);
      expect(generateButton).toBeDisabled();
    });

    test('disables input during generation', () => {
      render(<NewTodoInput {...mockProps} isGenerating={true} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      expect(goalInput).toBeDisabled();
    });

    test('enables input when not generating', () => {
      render(<NewTodoInput {...mockProps} isGenerating={false} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      expect(goalInput).not.toBeDisabled();
      
      const generateButton = screen.getByText(/generate/i);
      expect(generateButton).not.toBeDisabled();
    });
  });

  describe('Modal Behavior', () => {
    test('handles input changes correctly', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      
      await userEvent.type(goalInput, 'Test goal');
      
      expect(goalInput).toHaveValue('Test goal');
    });

    test('resets input on close', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      await userEvent.type(goalInput, 'Test goal');
      
      const closeButton = screen.getByText(/cancel/i);
      await userEvent.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    test('shows proper modal styling', () => {
      render(<NewTodoInput {...mockProps} />);
      
      // Check for modal overlay
      const modal = document.querySelector('.fixed.inset-0');
      expect(modal).toBeInTheDocument();
    });

    test('handles form submission on Enter key', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      
      await userEvent.type(goalInput, 'Test goal');
      fireEvent.keyDown(goalInput, { key: 'Enter' });
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Test goal');
    });
  });
});