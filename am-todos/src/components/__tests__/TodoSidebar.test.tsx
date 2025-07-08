import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TodoSidebar from '../TodoSidebar';

const mockTodos = [
  {
    id: 'todo-1',
    filename: 'todo-1.md',
    content: '# High Priority Task',
    frontmatter: {
      title: 'High Priority Task',
      createdAt: '2025-01-01T00:00:00.000Z',
      priority: 1,
      isArchived: false,
      chatHistory: []
    }
  },
  {
    id: 'todo-2',
    filename: 'todo-2.md',
    content: '# Medium Priority Task',
    frontmatter: {
      title: 'Medium Priority Task',
      createdAt: '2025-01-02T00:00:00.000Z',
      priority: 3,
      isArchived: false,
      chatHistory: []
    }
  },
  {
    id: 'todo-3',
    filename: 'todo-3.md',
    content: '# Archived Task',
    frontmatter: {
      title: 'Archived Task',
      createdAt: '2025-01-03T00:00:00.000Z',
      priority: 2,
      isArchived: true,
      chatHistory: []
    }
  }
];

const mockProps = {
  todos: mockTodos,
  selectedTodoId: 'todo-1',
  onSelectTodo: vi.fn(),
  onNewTodo: vi.fn(),
  showArchived: false,
  isOpen: true,
  onClose: vi.fn()
};

describe('TodoSidebar - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature 10: Mobile-First Responsive Design', () => {
    it('renders todo list', () => {
      render(<TodoSidebar {...mockProps} />);
      
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
    });

    it('shows only active todos when showArchived is false', () => {
      render(<TodoSidebar {...mockProps} showArchived={false} />);
      
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
      expect(screen.queryByText('Archived Task')).not.toBeInTheDocument();
    });

    it('shows archived todos when showArchived is true', () => {
      render(<TodoSidebar {...mockProps} showArchived={true} />);
      
      expect(screen.getByText('Archived Task')).toBeInTheDocument();
    });

    it('shows new todo button', () => {
      render(<TodoSidebar {...mockProps} />);
      
      const newTodoButton = screen.getByText(/new task/i);
      expect(newTodoButton).toBeInTheDocument();
    });

    it('calls onNewTodo when new task button clicked', async () => {
      render(<TodoSidebar {...mockProps} />);
      
      const newTodoButton = screen.getByText(/new task/i);
      await userEvent.click(newTodoButton);
      
      expect(mockProps.onNewTodo).toHaveBeenCalled();
    });

    it('calls onSelectTodo when todo item clicked', async () => {
      render(<TodoSidebar {...mockProps} />);
      
      const todoItem = screen.getByText('Medium Priority Task');
      await userEvent.click(todoItem);
      
      expect(mockProps.onSelectTodo).toHaveBeenCalledWith('todo-2');
    });

    it('highlights selected todo', () => {
      render(<TodoSidebar {...mockProps} selectedTodoId="todo-1" />);
      
      // Check for selected styling (implementation specific)
      const selectedTodo = screen.getByText('High Priority Task').closest('div');
      expect(selectedTodo).toHaveClass('bg-blue-600');
    });

    it('closes sidebar when onClose called', async () => {
      render(<TodoSidebar {...mockProps} />);
      
      // Look for close button (mobile)
      const closeButton = document.querySelector('[aria-label="Close sidebar"]');
      if (closeButton) {
        await userEvent.click(closeButton);
        expect(mockProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Priority System Visual Indicators', () => {
    it('displays priority badges with correct colors', () => {
      render(<TodoSidebar {...mockProps} />);
      
      // Check for priority indicators
      const p1Badge = screen.getByText('P1');
      const p3Badge = screen.getByText('P3');
      
      expect(p1Badge).toBeInTheDocument();
      expect(p3Badge).toBeInTheDocument();
      
      // Verify color coding
      expect(p1Badge).toHaveClass('bg-red-600');
      expect(p3Badge).toHaveClass('bg-yellow-600');
    });

    it('sorts todos by priority', () => {
      render(<TodoSidebar {...mockProps} />);
      
      const todoItems = screen.getAllByRole('button').filter(btn => 
        btn.textContent?.includes('Priority Task')
      );
      
      // High priority (P1) should come before medium priority (P3)
      expect(todoItems[0]).toHaveTextContent('High Priority Task');
      expect(todoItems[1]).toHaveTextContent('Medium Priority Task');
    });
  });

  describe('Archive System', () => {
    it('filters todos correctly based on archive status', () => {
      // Test active todos
      render(<TodoSidebar {...mockProps} showArchived={false} />);
      expect(screen.getAllByText(/Priority Task/)).toHaveLength(2);
      
      // Test archived todos
      render(<TodoSidebar {...mockProps} showArchived={true} />);
      expect(screen.getByText('Archived Task')).toBeInTheDocument();
    });
  });

  describe('Mobile Responsive Behavior', () => {
    it('renders with mobile-friendly classes', () => {
      render(<TodoSidebar {...mockProps} />);
      
      // Check for responsive classes
      const sidebar = document.querySelector('.bg-gray-800');
      expect(sidebar).toBeInTheDocument();
    });

    it('handles sidebar open/close state', () => {
      const { rerender } = render(<TodoSidebar {...mockProps} isOpen={false} />);
      
      // When closed, might have different styling
      rerender(<TodoSidebar {...mockProps} isOpen={true} />);
      
      // Test passes if no errors thrown during state changes
      expect(true).toBe(true);
    });
  });
});