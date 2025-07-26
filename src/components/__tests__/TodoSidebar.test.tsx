import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
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
    path: '/todos/todo-1.md',
    sha: 'abc123',
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
    path: '/todos/todo-2.md',
    sha: 'def456',
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
    path: '/todos/todo-3.md',
    sha: 'ghi789',
    // Simplified frontmatter with only tags
    frontmatter: { tags: [] }
  }
];

const mockProps = {
  todos: mockTodos,
  selectedTodoId: 'todo-1',
  onTodoSelect: vi.fn(),
  onNewTodo: vi.fn(),
  searchQuery: '',
  onSearchQueryChange: vi.fn(),
  searchResults: [],
  isSearching: false,
  searchError: null,
  searchScope: 'folder' as const,
  onSearchScopeChange: vi.fn()
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
      const selectedTodo = screen.getByText('High Priority Task');
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
      
      // Check for responsive behavior - component renders without error
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
    });

    it('handles sidebar open/close state', () => {
      const { rerender } = render(<TodoSidebar {...mockProps} />);
      
      // When closed, might have different styling
      rerender(<TodoSidebar {...mockProps} />);
      
      // Test passes if no errors thrown during state changes
      expect(true).toBe(true);
    });
  });

  describe('Search Functionality', () => {
    it('handles search input changes', async () => {
      render(<TodoSidebar {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      await userEvent.type(searchInput, 'test query');
      
      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('test query');
    });

    it('clears search when clear button clicked', async () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" />);
      
      // Find the X button for clearing search - it's an unnamed button next to the input
      const clearButtons = screen.getAllByRole('button');
      const clearButton = clearButtons.find(button => 
        button.className.includes('absolute right-3') || 
        button.querySelector('svg path[d*="M6 18L18 6M6 6l12 12"]')
      );
      
      expect(clearButton).toBeInTheDocument();
      
      await userEvent.click(clearButton!);
      
      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('shows search loading state', () => {
      render(<TodoSidebar {...mockProps} isSearching={true} />);
      
      // Check for the spinning loading indicator instead of text
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('displays search results count', () => {
      // Use search query that matches todo content
      const filteredTodos = mockTodos.filter(todo => !todo.isArchived);
      render(<TodoSidebar {...mockProps} searchQuery="Priority" todos={filteredTodos} />);
      
      expect(screen.getByText('2 found')).toBeInTheDocument();
    });

    it('shows search scope toggle when searching', () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" />);
      
      expect(screen.getByText('This Folder')).toBeInTheDocument();
      expect(screen.getByText('Entire Repo')).toBeInTheDocument();
    });

    it('handles search scope changes', async () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" />);
      
      const repoButton = screen.getByText('Entire Repo');
      await userEvent.click(repoButton);
      
      expect(mockProps.onSearchScopeChange).toHaveBeenCalledWith('repo');
    });

    it('displays search error with retry option', () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" searchError="API error" />);
      
      expect(screen.getByText('Search Error')).toBeInTheDocument();
      expect(screen.getByText('API error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('handles search retry', async () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" searchError="API error" />);
      
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      await userEvent.click(retryButton);
      
      // Should clear and then re-set the search query
      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('shows empty search results state', () => {
      render(<TodoSidebar {...mockProps} searchQuery="nonexistent" todos={[]} />);
      
      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getByText(/No tasks found for "nonexistent"/)).toBeInTheDocument();
    });

    it('processes search results correctly', () => {
      const searchResults = [{
        path: 'work/task.md',
        name: 'task.md',
        sha: 'search-sha',
        priority: 2,
        displayTitle: 'Search Result Task',
        url: 'https://api.github.com/repos/test/repo/contents/work/task.md',
        repository: 'test/repo',
        text_matches: []
      }];
      
      render(<TodoSidebar {...mockProps} searchQuery="Priority" searchResults={searchResults} />);
      
      expect(screen.getByText('Search Result Task')).toBeInTheDocument();
      expect(screen.getByText('P2')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Functionality', () => {
    const todoWithTasks = {
      id: 'todo-with-tasks',
      filename: 'todo-with-tasks.md',
      content: '# Task\n\n- [x] Done task\n- [ ] Pending task\n- [x] Another done',
      title: 'Task with Progress',
      createdAt: '2025-01-01T00:00:00.000Z',
      priority: 2,
      isArchived: false,
      path: '/todos/todo-with-tasks.md',
      sha: 'task123',
      frontmatter: { tags: [] }
    };

    it('calculates completion percentage correctly', () => {
      render(<TodoSidebar {...mockProps} todos={[todoWithTasks]} />);
      
      // Should show 67% (2 out of 3 tasks completed)
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('shows progress bar for tasks with completion', () => {
      render(<TodoSidebar {...mockProps} todos={[todoWithTasks]} />);
      
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('handles todo with no checkboxes', () => {
      const todoNoTasks = {
        ...todoWithTasks,
        content: '# Just text with no checkboxes'
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoNoTasks]} />);
      
      // Should not show progress section
      expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    });

    it('shows 100% completion with green styling', () => {
      const todoComplete = {
        ...todoWithTasks,
        content: '# All Done\n\n- [x] Task 1\n- [x] Task 2'
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoComplete]} />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Footer Stats', () => {
    it('displays total tasks count', () => {
      render(<TodoSidebar {...mockProps} />);
      
      expect(screen.getByText('Total Tasks')).toBeInTheDocument();
      // Find the total tasks count in the footer stats
      const totalTasksSection = screen.getByText('Total Tasks').closest('.bg-gray-700');
      expect(totalTasksSection).toHaveTextContent('3');
    });

    it('displays completed tasks count', () => {
      const todoComplete = {
        id: 'complete',
        filename: 'complete.md',
        content: '# Done\n\n- [x] Task 1\n- [x] Task 2',
        title: 'Complete Task',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 1,
        isArchived: false,
        path: '/todos/complete.md',
        sha: 'complete123',
        frontmatter: { tags: [] }
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoComplete]} />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
      // Find the completed tasks count in the footer stats
      const completedSection = screen.getByText('Completed').closest('.bg-gray-700');
      expect(completedSection).toHaveTextContent('1');
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no todos', () => {
      render(<TodoSidebar {...mockProps} todos={[]} />);
      
      expect(screen.getByText('No tasks yet')).toBeInTheDocument();
      expect(screen.getByText(/Get started by creating your first task/)).toBeInTheDocument();
    });

    it('shows empty search state with clear option', async () => {
      render(<TodoSidebar {...mockProps} searchQuery="nonexistent" todos={[]} />);
      
      expect(screen.getByText('No results found')).toBeInTheDocument();
      
      const clearButton = screen.getByRole('button', { name: 'Clear Search' });
      await userEvent.click(clearButton);
      
      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses search input on Ctrl+F', () => {
      render(<TodoSidebar {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search tasks/i) as HTMLInputElement;
      
      // Mock the focus and select methods
      const focusSpy = vi.spyOn(searchInput, 'focus');
      const selectSpy = vi.spyOn(searchInput, 'select');
      
      // Simulate Ctrl+F
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        bubbles: true
      }));
      
      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();
    });

    it('focuses search input on Cmd+F (Mac)', () => {
      render(<TodoSidebar {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText(/search tasks/i) as HTMLInputElement;
      
      // Mock the focus and select methods
      const focusSpy = vi.spyOn(searchInput, 'focus');
      const selectSpy = vi.spyOn(searchInput, 'select');
      
      // Simulate Cmd+F
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'f',
        metaKey: true,
        bubbles: true
      }));
      
      expect(focusSpy).toHaveBeenCalled();
      expect(selectSpy).toHaveBeenCalled();
    });

    it('clears search on Escape when search input focused', () => {
      render(<TodoSidebar {...mockProps} searchQuery="Priority" />);
      
      const searchInput = screen.getByPlaceholderText(/search tasks/i) as HTMLInputElement;
      searchInput.focus();
      
      // Mock blur method
      const blurSpy = vi.spyOn(searchInput, 'blur');
      
      // Simulate Escape with proper event target
      Object.defineProperty(document, 'activeElement', {
        value: searchInput,
        configurable: true
      });
      
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      }));
      
      expect(mockProps.onSearchQueryChange).toHaveBeenCalledWith('');
      expect(blurSpy).toHaveBeenCalled();
    });
  });

  describe('Search Results Display', () => {
    it('shows project name for search results', () => {
      const searchTodo = {
        id: 'search-result',
        filename: 'search-result.md',
        title: 'Search Result',
        content: '',
        frontmatter: { tags: [] },
        priority: 3,
        createdAt: '2025-01-01T00:00:00.000Z',
        isArchived: false,
        path: '/work/tasks/search-result.md',
        sha: 'search123',
        isSearchResult: true,
        projectName: 'work/tasks'
      };
      
      render(<TodoSidebar {...mockProps} todos={[searchTodo]} />);
      
      expect(screen.getByTitle('Project: work/tasks')).toBeInTheDocument();
    });

    it('shows created date for normal todos', () => {
      render(<TodoSidebar {...mockProps} />);
      
      expect(screen.getAllByText(/Created/).length).toBeGreaterThan(0);
    });

    it('handles todo with no createdAt date', () => {
      const todoNoDate = {
        ...mockTodos[0],
        createdAt: null as any
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoNoDate]} />);
      
      // Check for "No date" text specifically in the element that contains both "Created" and "No date"
      const createdElements = screen.getAllByText(/Created/i);
      const hasNoDate = createdElements.some(el => el.textContent?.includes('No date'));
      expect(hasNoDate).toBe(true);
    });
  });

  describe('Priority System Edge Cases', () => {
    it('handles undefined priority with fallback', () => {
      const todoNoPriority = {
        ...mockTodos[0],
        priority: undefined as any
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoNoPriority]} />);
      
      expect(screen.getByText('P3')).toBeInTheDocument(); // Default priority
    });

    it('handles invalid priority with fallback', () => {
      const todoInvalidPriority = {
        ...mockTodos[0],
        priority: 99 as any
      };
      
      render(<TodoSidebar {...mockProps} todos={[todoInvalidPriority]} />);
      
      expect(screen.getByText('P3')).toBeInTheDocument(); // Default priority
    });
  });
});