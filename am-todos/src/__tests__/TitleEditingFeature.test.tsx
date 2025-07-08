import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TodoEditor from '../components/TodoEditor';

// Mock the services
vi.mock('../services/githubService');
vi.mock('../services/aiService');

const mockTodo = {
  id: 'test-todo-1',
  title: 'Original Title',
  content: '- [ ] Task 1\n- [ ] Task 2',
  frontmatter: {
    title: 'Original Title',
    createdAt: '2025-01-01T10:00:00.000Z',
    priority: 3,
    isArchived: false,
    chatHistory: []
  },
  path: 'todos/2025-01-01-original-title.md',
  sha: 'abc123'
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

describe('Title Editing Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render todo title in view mode', () => {
    render(<TodoEditor {...mockProps} />);
    
    expect(screen.getByText('Original Title')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Original Title')).not.toBeInTheDocument();
  });

  it('should allow entering edit mode by clicking on title', () => {
    render(<TodoEditor {...mockProps} />);
    
    const titleElement = screen.getByText('Original Title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveAttribute('title', 'Click to edit title');
    
    fireEvent.click(titleElement);
    
    // Should show input field with current title
    expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument();
  });

  it('should allow editing title text', () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Edit the title
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    
    expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument();
  });

  it('should save title changes when input loses focus', async () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Edit the title
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'New Updated Title' } });
    
    // Save changes by blurring input
    fireEvent.blur(titleInput);
    
    // Should call onTitleUpdate with correct parameters
    expect(mockProps.onTitleUpdate).toHaveBeenCalledWith('test-todo-1', 'New Updated Title');
  });

  it('should save title changes when Enter key is pressed', async () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Edit the title
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'Enter Key Title' } });
    
    // Press Enter to save
    fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' });
    
    // Should call onTitleUpdate
    expect(mockProps.onTitleUpdate).toHaveBeenCalledWith('test-todo-1', 'Enter Key Title');
  });

  it('should cancel title editing when Escape key is pressed', async () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Edit the title
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'Cancelled Title' } });
    
    // Press Escape to cancel
    fireEvent.keyDown(titleInput, { key: 'Escape', code: 'Escape' });
    
    // Should not call onTitleUpdate
    expect(mockProps.onTitleUpdate).not.toHaveBeenCalled();
    
    // Should exit edit mode without saving
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Cancelled Title')).not.toBeInTheDocument();
    });
  });

  it('should not save if title is empty or only whitespace', () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Clear the title
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: '   ' } });
    
    // Try to save by blurring
    fireEvent.blur(titleInput);
    
    // Should not call onTitleUpdate for empty/whitespace title
    expect(mockProps.onTitleUpdate).not.toHaveBeenCalled();
  });

  it('should not save if title is unchanged', () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Don't change the title, just blur to save
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.blur(titleInput);
    
    // Should not call onTitleUpdate if title is unchanged
    expect(mockProps.onTitleUpdate).not.toHaveBeenCalled();
  });

  it('should handle missing onTitleUpdate prop gracefully', () => {
    const propsWithoutTitleUpdate = { ...mockProps };
    delete (propsWithoutTitleUpdate as any).onTitleUpdate;
    
    expect(() => {
      render(<TodoEditor {...propsWithoutTitleUpdate} />);
    }).not.toThrow();
  });

  it('should trim whitespace from title before saving', () => {
    render(<TodoEditor {...mockProps} />);
    
    // Enter edit mode by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    // Edit the title with extra whitespace
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: '  Trimmed Title  ' } });
    
    // Save changes by blurring
    fireEvent.blur(titleInput);
    
    // Should call onTitleUpdate with trimmed title
    expect(mockProps.onTitleUpdate).toHaveBeenCalledWith('test-todo-1', 'Trimmed Title');
  });

  it('should work with todos that have no frontmatter title', () => {
    const todoWithoutFrontmatterTitle = {
      ...mockTodo,
      frontmatter: {
        ...mockTodo.frontmatter,
        title: undefined as any
      }
    };
    
    const props = { ...mockProps, selectedTodo: todoWithoutFrontmatterTitle };
    
    render(<TodoEditor {...props} />);
    
    // Should fall back to todo.title
    expect(screen.getByText('Original Title')).toBeInTheDocument();
    
    // Should be able to edit by clicking title
    const titleElement = screen.getByText('Original Title');
    fireEvent.click(titleElement);
    
    expect(screen.getByDisplayValue('Original Title')).toBeInTheDocument();
  });
});