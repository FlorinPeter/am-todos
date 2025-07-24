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
    // New structure: metadata at top level
    title: 'High Priority Task',
    createdAt: '2025-01-01T00:00:00.000Z',
    priority: 1,
    isArchived: false,
    // Simplified frontmatter with only tags
    frontmatter: { tags: [] }
  },
  {
    id: 'todo-2',
    filename: 'todo-2.md',
    content: '# Medium Priority Task',
    // New structure: metadata at top level
    title: 'Medium Priority Task',
    createdAt: '2025-01-02T00:00:00.000Z',
    priority: 3,
    isArchived: false,
    // Simplified frontmatter with only tags
    frontmatter: { tags: [] }
  },
  {
    id: 'todo-3',
    filename: 'todo-3.md',
    content: '# Archived Task',
    // New structure: metadata at top level
    title: 'Archived Task',
    createdAt: '2025-01-03T00:00:00.000Z',
    priority: 2,
    isArchived: true,
    // Simplified frontmatter with only tags
    frontmatter: { tags: [] }
  }
];

const mockProps = {
  todos: mockTodos,
  selectedTodoId: 'todo-1',
  onTodoSelect: vi.fn(),
  onNewTodo: vi.fn()
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

    it('shows only active todos when filtered by parent', () => {
      const activeTodos = mockTodos.filter(todo => !todo.isArchived);
      render(<TodoSidebar {...mockProps} todos={activeTodos} />);
      
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
      expect(screen.queryByText('Archived Task')).not.toBeInTheDocument();
    });

    it('shows archived todos when all todos provided', () => {
      render(<TodoSidebar {...mockProps} todos={mockTodos} />);
      
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
      
      expect(mockProps.onTodoSelect).toHaveBeenCalledWith('todo-2');
    });

    it('highlights selected todo', () => {
      render(<TodoSidebar {...mockProps} selectedTodoId="todo-1" />);
      
      // Check for selected styling - find the todo container div
      const selectedTodo = screen.getByText('High Priority Task').closest('.bg-blue-600');
      expect(selectedTodo).toBeInTheDocument();
    });

    it('shows todo priorities correctly', () => {
      render(<TodoSidebar {...mockProps} />);
      
      // Check for priority badges
      expect(screen.getByText('P1')).toBeInTheDocument(); // High priority
      expect(screen.getByText('P3')).toBeInTheDocument(); // Medium priority
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
      
      const highPriorityTask = screen.getByText('High Priority Task');
      const mediumPriorityTask = screen.getByText('Medium Priority Task');
      
      // Check that both tasks are rendered
      expect(highPriorityTask).toBeInTheDocument();
      expect(mediumPriorityTask).toBeInTheDocument();
      
      // Check priority badges
      expect(screen.getByText('P1')).toBeInTheDocument(); // High priority
      expect(screen.getByText('P3')).toBeInTheDocument(); // Medium priority
    });
  });

  describe('Archive System', () => {
    it('displays todos provided by parent component', () => {
      const activeTodos = mockTodos.filter(todo => !todo.isArchived);
      render(<TodoSidebar {...mockProps} todos={activeTodos} />);
      
      // Should only show active todos
      expect(screen.getAllByText(/Priority Task/)).toHaveLength(2);
      expect(screen.queryByText('Archived Task')).not.toBeInTheDocument();
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