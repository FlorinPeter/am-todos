import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TodoEditor from '../TodoEditor';

const mockTodo = {
  id: 'test-todo-id',
  filename: 'test-todo.md',
  content: '# Test Todo\n\n- [ ] Test task',
  frontmatter: {
    title: 'Test Todo',
    createdAt: '2025-01-01T00:00:00.000Z',
    priority: 3,
    isArchived: false,
    chatHistory: []
  }
};

const mockProps = {
  selectedTodo: mockTodo,
  onTodoUpdate: vi.fn(),
  onTitleUpdate: vi.fn(),
  onPriorityUpdate: vi.fn(),
  onArchiveToggle: vi.fn(),
  onDeleteTodo: vi.fn(),
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo'
};

describe('TodoEditor - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature 5: Task Management System', () => {
    test('renders todo title and metadata', () => {
      render(<TodoEditor {...mockProps} />);
      
      // Use getAllByText since the title appears in both header and markdown content
      expect(screen.getAllByText('Test Todo')).toHaveLength(2);
    });

    test('shows priority selector with current priority', () => {
      render(<TodoEditor {...mockProps} />);
      
      const prioritySelect = screen.getByDisplayValue('P3');
      expect(prioritySelect).toBeInTheDocument();
    });

    test('calls onPriorityUpdate when priority changed', async () => {
      render(<TodoEditor {...mockProps} />);
      
      const prioritySelect = screen.getByDisplayValue('P3');
      await userEvent.selectOptions(prioritySelect, '1');
      
      expect(mockProps.onPriorityUpdate).toHaveBeenCalledWith('test-todo-id', 1);
    });

    test('shows archive toggle button', () => {
      render(<TodoEditor {...mockProps} />);
      
      const archiveButton = screen.getByText(/archive/i);
      expect(archiveButton).toBeInTheDocument();
    });

    test('calls onArchiveToggle when archive button clicked', async () => {
      render(<TodoEditor {...mockProps} />);
      
      const archiveButton = screen.getByText(/archive/i);
      await userEvent.click(archiveButton);
      
      expect(mockProps.onArchiveToggle).toHaveBeenCalledWith('test-todo-id');
    });

    test('shows delete button', () => {
      render(<TodoEditor {...mockProps} />);
      
      const deleteButton = screen.getByTitle('Delete task');
      expect(deleteButton).toBeInTheDocument();
    });

    test('calls onDeleteTodo when delete button clicked', async () => {
      render(<TodoEditor {...mockProps} />);
      
      const deleteButton = screen.getByTitle('Delete task');
      await userEvent.click(deleteButton);
      
      expect(mockProps.onDeleteTodo).toHaveBeenCalledWith('test-todo-id');
    });

    test('renders properly with all required props', () => {
      render(<TodoEditor {...mockProps} />);
      
      // Check that all buttons are rendered and functional
      const deleteButton = screen.getByTitle('Delete task');
      expect(deleteButton).toBeInTheDocument();
      expect(deleteButton).not.toBeDisabled();
    });

    test('displays creation date', () => {
      render(<TodoEditor {...mockProps} />);
      
      // Should show formatted date
      expect(screen.getByText(/2025/)).toBeInTheDocument();
    });

    test('shows correct archive button text for archived todos', () => {
      const archivedTodo = {
        ...mockTodo,
        frontmatter: {
          ...mockTodo.frontmatter,
          isArchived: true
        }
      };
      
      render(<TodoEditor {...mockProps} selectedTodo={archivedTodo} />);
      
      const unarchiveButton = screen.getByText(/unarchive/i);
      expect(unarchiveButton).toBeInTheDocument();
    });
  });

  describe('Priority System Coverage', () => {
    test('renders all priority options P1-P5', () => {
      render(<TodoEditor {...mockProps} />);
      
      const prioritySelect = screen.getByDisplayValue('P3');
      
      // Check all priority options exist
      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('P2')).toBeInTheDocument();
      expect(screen.getByText('P3')).toBeInTheDocument();
      expect(screen.getByText('P4')).toBeInTheDocument();
      expect(screen.getByText('P5')).toBeInTheDocument();
    });

    test('handles priority selection for all levels', async () => {
      render(<TodoEditor {...mockProps} />);
      
      const prioritySelect = screen.getByDisplayValue('P3');
      
      // Test each priority level
      await userEvent.selectOptions(prioritySelect, '1');
      expect(mockProps.onPriorityUpdate).toHaveBeenCalledWith('test-todo-id', 1);
      
      await userEvent.selectOptions(prioritySelect, '5');
      expect(mockProps.onPriorityUpdate).toHaveBeenCalledWith('test-todo-id', 5);
    });
  });
});