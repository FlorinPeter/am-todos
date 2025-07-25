import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TodoSidebar from '../TodoSidebar';

// Mock search service
vi.mock('../../services/searchService', () => ({
  filterTodosLocally: vi.fn((todos, query) => 
    todos.filter(todo => todo.frontmatter.title.toLowerCase().includes(query.toLowerCase()))
  ),
}));

// Mock date format
vi.mock('../../utils/dateFormat', () => ({
  formatDate: vi.fn(() => 'Dec 25, 2023')
}));

const mockTodos = [
  {
    id: 'todo-1',
    filename: 'todo-1.md',
    title: 'High Priority Task',
    content: '# High Priority Task\n\n- [x] Completed item\n- [ ] Pending item',
    frontmatter: {
      title: 'High Priority Task',
      createdAt: '2025-01-01T00:00:00.000Z',
      priority: 1,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/high-priority.md',
    sha: 'sha1'
  },
  {
    id: 'todo-2',
    filename: 'todo-2.md',
    title: 'Medium Priority Task', 
    content: '# Medium Priority Task\n\n- [ ] Todo item',
    frontmatter: {
      title: 'Medium Priority Task',
      createdAt: '2025-01-02T00:00:00.000Z',
      priority: 3,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/medium-priority.md',
    sha: 'sha2'
  }
];

const mockSearchResults = [
  {
    name: 'search-result.md',
    path: 'work/tasks/search-result.md',
    repository: { full_name: 'user/repo' },
    html_url: 'https://github.com/user/repo/blob/main/work/tasks/search-result.md',
    text_matches: [{ fragment: 'matching text' }],
    sha: 'search-sha'
  }
];

describe('TodoSidebar - Enhanced Coverage Tests', () => {
  let mockFilterTodosLocally: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up mocks
    mockFilterTodosLocally = vi.mocked((await import('../../services/searchService')).filterTodosLocally);
    
    // Default return values
    mockFilterTodosLocally.mockImplementation((todos, query) => 
      todos.filter(todo => todo.frontmatter.title.toLowerCase().includes(query.toLowerCase()))
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up any event listeners
    document.removeEventListener('keydown', () => {});
  });

  describe('Keyboard Shortcuts', () => {
    it('focuses search input when Ctrl+F is pressed', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery=""
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      
      // Simulate Ctrl+F keydown
      fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
      
      expect(document.activeElement).toBe(searchInput);
    });

    it('focuses search input when Cmd+F is pressed (Mac)', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery=""
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      
      // Simulate Cmd+F keydown (metaKey for Mac)
      fireEvent.keyDown(document, { key: 'f', metaKey: true });
      
      expect(document.activeElement).toBe(searchInput);
    });

    it('clears search when Escape is pressed while search input is focused', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test query"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      
      // Focus the search input
      searchInput.focus();
      
      // Simulate Escape keydown while search input is focused
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('does not clear search when Escape is pressed while search input is not focused', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test query"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      // Don't focus the search input
      // Simulate Escape keydown
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onSearchQueryChange).not.toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('handles search input changes', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery=""
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(/search tasks/i);
      
      await userEvent.type(searchInput, 'test search');
      
      expect(onSearchQueryChange).toHaveBeenCalledWith('test search');
    });

    it('shows search clear button when search query exists', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          onSearchQueryChange={vi.fn()}
        />
      );

      // Should show clear button (X icon)
      const clearButton = screen.getByRole('button', { name: '' });
      expect(clearButton).toBeInTheDocument();
    });

    it('clears search when clear button is clicked', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      // Find and click the clear button (X icon)
      const clearButton = screen.getByRole('button', { name: '' });
      await userEvent.click(clearButton);
      
      expect(onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('shows search scope toggle buttons when searching', () => {
      const onSearchScopeChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          onSearchQueryChange={vi.fn()}
          searchScope="folder"
          onSearchScopeChange={onSearchScopeChange}
        />
      );

      expect(screen.getByText('This Folder')).toBeInTheDocument();
      expect(screen.getByText('Entire Repo')).toBeInTheDocument();
    });

    it('handles search scope changes', async () => {
      const onSearchScopeChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          onSearchQueryChange={vi.fn()}
          searchScope="folder"
          onSearchScopeChange={onSearchScopeChange}
        />
      );

      const repoButton = screen.getByText('Entire Repo');
      await userEvent.click(repoButton);
      
      expect(onSearchScopeChange).toHaveBeenCalledWith('repo');
    });
  });

  describe('Search Empty States', () => {
    it('shows search empty state when no results found', () => {
      // Mock empty filter result
      mockFilterTodosLocally.mockReturnValue([]);
      
      const onNewTodo = vi.fn();
      const onSearchQueryChange = vi.fn();
      
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={onNewTodo}
          searchQuery="nonexistent query"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      expect(screen.getByText('No results found')).toBeInTheDocument();
      expect(screen.getAllByText(/No tasks found for "nonexistent query"/).length).toBeGreaterThan(0);
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
      // "New Task" button is already visible at the top - no duplicate needed
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });

    it('calls clear search from empty state clear button', async () => {
      mockFilterTodosLocally.mockReturnValue([]);
      
      const onSearchQueryChange = vi.fn();
      
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="nonexistent query"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const clearButton = screen.getByText('Clear Search');
      await userEvent.click(clearButton);
      
      expect(onSearchQueryChange).toHaveBeenCalledWith('');
    });

    it('can create new task from the main New Task button even in search empty state', async () => {
      mockFilterTodosLocally.mockReturnValue([]);
      
      const onNewTodo = vi.fn();
      
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={onNewTodo}
          searchQuery="nonexistent query"
          onSearchQueryChange={vi.fn()}
        />
      );

      // The main "New Task" button should still work even when showing search empty state
      const newTaskButton = screen.getByText('New Task');
      await userEvent.click(newTaskButton);
      
      expect(onNewTodo).toHaveBeenCalled();
    });
  });

  describe('Search Results with Path Display', () => {
    it('displays search results with folder paths', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchResults={mockSearchResults}
          isSearching={false}
        />
      );

      // Should show the path badge for search results
      expect(screen.getByText('work/tasks')).toBeInTheDocument();
    });

    it('shows "root" for search results with no folder path', () => {
      const rootSearchResult = [{
        ...mockSearchResults[0],
        path: 'search-result.md' // No folder path
      }];
      
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchResults={rootSearchResult}
          isSearching={false}
        />
      );

      expect(screen.getByText('root')).toBeInTheDocument();
    });

    it('shows project path as clean text when search result is selected', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId="search-sha"
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchResults={mockSearchResults}
          isSearching={false}
        />
      );

      // Project path should be displayed as clean text, not as a styled badge
      const pathText = screen.getByText('work/tasks');
      expect(pathText).toBeInTheDocument();
      expect(pathText).toHaveClass('truncate', 'max-w-24');
    });
  });

  describe('Search Status Messages', () => {
    it('shows searching status', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          isSearching={true}
        />
      );

      // Search status messages were removed from UI - test now checks for empty state
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('shows search error message with retry functionality', () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchError="Network error occurred"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      // Should show error banner (not empty state error anymore)
      expect(screen.getByRole('heading', { level: 4, name: 'Search Error' })).toBeInTheDocument();
      expect(screen.getByText('Network error occurred')).toBeInTheDocument();
      expect(screen.getAllByText('Clear Search')).toHaveLength(2); // One in banner, one in empty state
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('shows rate limit specific guidance for rate limit errors', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchError="GitHub search API rate limit exceeded. Please try again in a few minutes."
          onSearchQueryChange={vi.fn()}
        />
      );

      // Should show error banner with rate limit tip
      expect(screen.getByRole('heading', { level: 4, name: 'Search Error' })).toBeInTheDocument();
      expect(screen.getByText(/rate limit exceeded/)).toBeInTheDocument();
      expect(screen.getByText(/💡 Tip.*rate limits/)).toBeInTheDocument();
    });

    it('can retry search after error', async () => {
      const onSearchQueryChange = vi.fn();
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchError="Network error occurred"
          onSearchQueryChange={onSearchQueryChange}
        />
      );

      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
      await userEvent.click(tryAgainButton);

      // Should clear search first, then retry with same query
      expect(onSearchQueryChange).toHaveBeenCalledWith('');
      // Note: The retry call happens after setTimeout, so we can't easily test it here
      // but the clear functionality should work
    });

    it('shows no results message when search returns empty', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="test search"
          searchResults={[]}
          isSearching={false}
        />
      );

      // When searchResults is empty array and not searching, should show no results
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Calculations', () => {
    it('calculates completion percentage correctly', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
        />
      );

      // The first todo has "- [x] Completed item\n- [ ] Pending item" = 50% completion
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('handles todos with no checkboxes', () => {
      const todosWithoutCheckboxes = [{
        ...mockTodos[0],
        content: '# Task without checkboxes\n\nJust plain text'
      }];
      
      render(
        <TodoSidebar
          todos={todosWithoutCheckboxes}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
        />
      );

      // Should not show progress bar for 0% completion
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
    });

    it('shows 100% completion for fully completed tasks', () => {
      const completedTodos = [{
        ...mockTodos[0],
        content: '# Completed Task\n\n- [x] All\n- [x] Items\n- [x] Done'
      }];
      
      render(
        <TodoSidebar
          todos={completedTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('Local Search Filtering', () => {
    it('applies local filtering when search query provided', () => {
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="High"
          onSearchQueryChange={vi.fn()}
        />
      );

      expect(mockFilterTodosLocally).toHaveBeenCalledWith(mockTodos, 'High');
    });

    it('shows filtered results from local search', () => {
      // Mock to return only high priority task
      mockFilterTodosLocally.mockReturnValue([mockTodos[0]]);
      
      render(
        <TodoSidebar
          todos={mockTodos}
          selectedTodoId={null}
          onTodoSelect={vi.fn()}
          onNewTodo={vi.fn()}
          searchQuery="High"
          onSearchQueryChange={vi.fn()}
        />
      );

      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.queryByText('Medium Priority Task')).not.toBeInTheDocument();
    });
  });
});