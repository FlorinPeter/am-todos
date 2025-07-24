/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TodoSidebar from '../TodoSidebar';

// Setup matchers for testing-library
import { expect as vitestExpect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
vitestExpect.extend(matchers);

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
      // New structure: metadata at top level
      title: 'Test Todo',
      priority: 3,
      createdAt: '2023-01-01',
      isArchived: false,
      // Simplified frontmatter with only tags
      frontmatter: { tags: [] }
    },
    {
      id: '2', 
      filename: 'no-date-todo.md',
      content: '# No Date Todo\n\n- [ ] Task A',
      // New structure: metadata at top level
      title: 'No Date Todo',
      priority: 2,
      isArchived: false,
      // createdAt is missing
      // Simplified frontmatter with only tags
      frontmatter: { tags: [] }
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
    expect(screen.getAllByText('67%')[0]).toBeInTheDocument();
    
    // Should render progress bar div with correct width
    const progressBar = screen.getAllByText('67%')[0].parentElement?.nextElementSibling?.firstElementChild;
    expect(progressBar).toHaveStyle({ width: '67%' });
  });

  it('should handle completed task matching (line 72)', () => {
    // Test that completed tasks are correctly counted
    render(<TodoSidebar {...defaultProps} />);

    // Verify the calculation works: 2 completed out of 3 total = 67%
    expect(screen.getAllByText('67%')[0]).toBeInTheDocument();
  });

  it('should show "No date" when createdAt is missing (line 148)', () => {
    // Test the fallback text for missing created date
    render(<TodoSidebar {...defaultProps} selectedTodoId="2" />);

    expect(screen.getAllByText('Created No date')[0]).toBeInTheDocument();
  });

  it('should show formatted date when createdAt exists', () => {
    // Test the normal path for created date
    render(<TodoSidebar {...defaultProps} />);

    expect(screen.getAllByText('Created formatted-2023-01-01')[0]).toBeInTheDocument();
  });

  it('should not show progress bar when completion is 0', () => {
    // Test a todo with no completed tasks
    const todoWithNoCompletion = [{
      id: '3',
      filename: 'no-progress.md',
      content: '# No Progress\n\n- [ ] Task 1\n- [ ] Task 2',
      // New structure: metadata at top level
      title: 'No Progress',
      priority: 1,
      createdAt: '2023-01-01',
      isArchived: false,
      // Simplified frontmatter with only tags
      frontmatter: { tags: [] }
    }];

    render(<TodoSidebar {...defaultProps} todos={todoWithNoCompletion} selectedTodoId="3" />);

    // Component no longer shows progress section - updated expectation to match current behavior
    expect(screen.queryAllByText('Progress')).toHaveLength(0);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('should handle todos with no checkboxes', () => {
    // Test todo with no checkbox tasks at all
    const todoWithoutTasks = [{
      id: '4',
      filename: 'no-tasks.md',
      content: '# Just Text\n\nThis has no tasks.',
      // New structure: metadata at top level
      title: 'Just Text',
      priority: 1,
      createdAt: '2023-01-01',
      isArchived: false,
      // Simplified frontmatter with only tags
      frontmatter: { tags: [] }
    }];

    render(<TodoSidebar {...defaultProps} todos={todoWithoutTasks} selectedTodoId="4" />);

    // Component no longer shows progress section - updated expectation to match current behavior
    expect(screen.queryAllByText('Progress')).toHaveLength(0);
  });

  it('should generate fallback ID for search results in non-test environment (line 126)', () => {
    // Temporarily mock process.env to not be test environment
    const originalEnv = process.env.NODE_ENV;
    const originalWindow = global.window;
    
    // Make it appear as non-test environment
    process.env.NODE_ENV = 'production';
    global.window = {} as any;
    
    const searchResults = [{
      path: 'todos/test-file.md',
      name: 'test-file.md', 
      sha: 'abc123',
      priority: 2
    }];
    
    const propsWithSearch = {
      ...defaultProps,
      searchQuery: 'test query',
      searchResults,
      onSearchQueryChange: vi.fn(),
      onSearchScopeChange: vi.fn()
    };
    
    render(<TodoSidebar {...propsWithSearch} />);
    
    // Should render the search result (which uses the fallback ID generation)
    expect(screen.getByText('test-file')).toBeInTheDocument();
    
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
    global.window = originalWindow;
  });

  it('should show inactive folder button styling when scope is repo (line 234)', () => {
    const propsWithSearch = {
      ...defaultProps,
      searchQuery: 'test query',
      searchScope: 'repo' as const, // Set scope to 'repo' so 'folder' button is inactive
      onSearchQueryChange: vi.fn(),
      onSearchScopeChange: vi.fn()
    };
    
    render(<TodoSidebar {...propsWithSearch} />);
    
    // Find the "This Folder" button (should be inactive when scope is 'repo')
    const folderButton = screen.getByText('This Folder');
    expect(folderButton).toHaveClass('bg-gray-600', 'text-gray-300', 'hover:bg-gray-500');
  });

  it('should show inactive repo button styling when scope is folder (line 244)', () => {
    const propsWithFolderScope = {
      ...defaultProps,
      searchQuery: 'test query',
      searchScope: 'folder' as const, // Set scope to 'folder' so 'repo' button is inactive
      onSearchQueryChange: vi.fn(),
      onSearchScopeChange: vi.fn()
    };
    
    render(<TodoSidebar {...propsWithFolderScope} />);
    
    // Find the "Entire Repo" button (should be inactive when scope is 'folder')  
    const repoButton = screen.getByText('Entire Repo');
    expect(repoButton).toHaveClass('bg-gray-600', 'text-gray-300', 'hover:bg-gray-500');
  });
});