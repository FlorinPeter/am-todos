import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TodoSidebar from '../TodoSidebar';

// Mock dependencies
vi.mock('../../utils/dateFormat', () => ({
  formatDate: vi.fn((date) => `formatted-${date}`)
}));

describe('TodoSidebar - Quick Coverage Boost', () => {
  const mockTodos = [
    {
      id: '1',
      filename: 'test-todo.md', 
      content: '# Test Todo\n\n- [ ] Task 1\n- [x] Task 2\n- [x] Task 3',
      frontmatter: {
        title: 'Test Todo',
        priority: 3,
        createdAt: '2023-01-01',
        isArchived: false
      }
    },
    {
      id: '2', 
      filename: 'no-date-todo.md',
      content: '# No Date Todo\n\n- [ ] Task A',
      frontmatter: {
        title: 'No Date Todo',
        priority: 2,
        isArchived: false
        // createdAt is missing
      }
    }
  ];

  const defaultProps = {
    todos: mockTodos,
    selectedTodoId: '1',
    onTodoSelect: vi.fn(),
    onToggleArchive: vi.fn(),
    isArchiveView: false,
    onToggleArchiveView: vi.fn(),
    onDeleteTodo: vi.fn(),
    isMobile: false,
    isOpen: true,
    onToggle: vi.fn()
  };

  it('should show progress bar when completion > 0 (lines 130-141)', () => {
    // Test todo with 2/3 tasks completed = 67% completion
    render(<TodoSidebar {...defaultProps} />);

    // Should show progress bar for todo with completion > 0
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    
    // Should render progress bar div with correct width
    const progressBar = screen.getByText('67%').parentElement?.nextElementSibling?.firstElementChild;
    expect(progressBar).toHaveStyle({ width: '67%' });
  });

  it('should handle completed task matching (line 72)', () => {
    // Test that completed tasks are correctly counted
    render(<TodoSidebar {...defaultProps} />);

    // Verify the calculation works: 2 completed out of 3 total = 67%
    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('should show "No date" when createdAt is missing (line 148)', () => {
    // Test the fallback text for missing created date
    render(<TodoSidebar {...defaultProps} selectedTodoId="2" />);

    expect(screen.getByText('Created No date')).toBeInTheDocument();
  });

  it('should show formatted date when createdAt exists', () => {
    // Test the normal path for created date
    render(<TodoSidebar {...defaultProps} />);

    expect(screen.getByText('Created formatted-2023-01-01')).toBeInTheDocument();
  });

  it('should not show progress bar when completion is 0', () => {
    // Test a todo with no completed tasks
    const todoWithNoCompletion = [{
      id: '3',
      filename: 'no-progress.md',
      content: '# No Progress\n\n- [ ] Task 1\n- [ ] Task 2',
      frontmatter: {
        title: 'No Progress',
        priority: 1,
        createdAt: '2023-01-01',
        isArchived: false
      }
    }];

    render(<TodoSidebar {...defaultProps} todos={todoWithNoCompletion} selectedTodoId="3" />);

    // Should not show progress section when completion is 0
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('should handle todos with no checkboxes', () => {
    // Test todo with no checkbox tasks at all
    const todoWithoutTasks = [{
      id: '4',
      filename: 'no-tasks.md',
      content: '# Just Text\n\nThis has no tasks.',
      frontmatter: {
        title: 'Just Text',
        priority: 1,
        createdAt: '2023-01-01',
        isArchived: false
      }
    }];

    render(<TodoSidebar {...defaultProps} todos={todoWithoutTasks} selectedTodoId="4" />);

    // Should not show progress when there are no checkboxes
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
  });
});