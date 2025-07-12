import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import TodoEditor from '../TodoEditor';
import * as localStorage from '../../utils/localStorage';

// Mock the localStorage module
vi.mock('../../utils/localStorage', () => ({
  clearOtherDrafts: vi.fn(),
}));

// Mock MarkdownViewer component
vi.mock('../MarkdownViewer', () => ({
  default: ({ todoId, filePath }: { todoId: string; filePath: string }) => (
    <div data-testid="markdown-viewer" data-todo-id={todoId} data-file-path={filePath}>
      Mocked MarkdownViewer
    </div>
  ),
}));

// Mock formatDate utility
vi.mock('../../utils/dateFormat', () => ({
  formatDate: vi.fn().mockReturnValue('Jan 5, 2025'),
}));

describe('TodoEditor Draft Cleanup', () => {
  const baseTodo = {
    id: 'todo-1',
    title: 'Test Task',
    content: '# Test Task\n\n- [ ] Test item',
    frontmatter: {
      title: 'Test Task',
      createdAt: '2025-01-05T10:00:00.000Z',
      priority: 3,
      isArchived: false,
      chatHistory: [],
    },
    path: '/todos/2025-01-05-test-task.md',
    sha: 'sha-123456',
  };

  const mockProps = {
    selectedTodo: baseTodo,
    onTodoUpdate: vi.fn(),
    onTitleUpdate: vi.fn(),
    onPriorityUpdate: vi.fn(),
    onArchiveToggle: vi.fn(),
    onDeleteTodo: vi.fn(),
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Draft cleanup on todo selection', () => {
    it('should call clearOtherDrafts when selectedTodo changes', () => {
      const { rerender } = render(<TodoEditor {...mockProps} />);

      // Should call clearOtherDrafts for initial todo
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');

      // Change to different todo
      const newTodo = {
        ...baseTodo,
        id: 'todo-2',
        title: 'Different Task',
        path: '/todos/2025-01-05-different-task.md',
      };

      rerender(<TodoEditor {...mockProps} selectedTodo={newTodo} />);

      // Should call clearOtherDrafts for new todo
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-2');
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledTimes(2);
    });

    it('should not call clearOtherDrafts when selectedTodo is null', () => {
      render(<TodoEditor {...mockProps} selectedTodo={null} />);

      expect(localStorage.clearOtherDrafts).not.toHaveBeenCalled();
    });

    it('should call clearOtherDrafts when todo ID changes but same object reference', () => {
      const { rerender } = render(<TodoEditor {...mockProps} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');

      // Update the same todo object with new ID (simulate todo update)
      const updatedTodo = { ...baseTodo, id: 'todo-1-updated' };
      rerender(<TodoEditor {...mockProps} selectedTodo={updatedTodo} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1-updated');
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledTimes(2);
    });

    it('should not call clearOtherDrafts multiple times for same todo ID', () => {
      const { rerender } = render(<TodoEditor {...mockProps} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');

      // Re-render with same todo (but different object reference)
      const sameTodo = { ...baseTodo }; // Same ID, new object
      rerender(<TodoEditor {...mockProps} selectedTodo={sameTodo} />);

      // Should still only be called once since ID hasn't changed
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledTimes(1);
    });
  });

  describe('MarkdownViewer integration', () => {
    it('should pass todoId to MarkdownViewer', () => {
      const { container } = render(<TodoEditor {...mockProps} />);

      const markdownViewer = container.querySelector('[data-testid="markdown-viewer"]');
      expect(markdownViewer).toBeInTheDocument();
      expect(markdownViewer).toHaveAttribute('data-todo-id', 'todo-1');
      expect(markdownViewer).toHaveAttribute('data-file-path', '/todos/2025-01-05-test-task.md');
    });

    it('should update MarkdownViewer props when todo changes', () => {
      const { container, rerender } = render(<TodoEditor {...mockProps} />);

      let markdownViewer = container.querySelector('[data-testid="markdown-viewer"]');
      expect(markdownViewer).toHaveAttribute('data-todo-id', 'todo-1');

      // Change todo
      const newTodo = {
        ...baseTodo,
        id: 'todo-2',
        path: '/todos/2025-01-05-new-task.md',
      };

      rerender(<TodoEditor {...mockProps} selectedTodo={newTodo} />);

      markdownViewer = container.querySelector('[data-testid="markdown-viewer"]');
      expect(markdownViewer).toHaveAttribute('data-todo-id', 'todo-2');
      expect(markdownViewer).toHaveAttribute('data-file-path', '/todos/2025-01-05-new-task.md');
    });
  });

  describe('Error handling', () => {
    it('should handle clearOtherDrafts errors gracefully', () => {
      // Mock clearOtherDrafts to throw an error
      vi.mocked(localStorage.clearOtherDrafts).mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not crash the component
      expect(() => render(<TodoEditor {...mockProps} />)).not.toThrow();
    });

    it('should handle undefined selectedTodo gracefully', () => {
      const propsWithUndefined = { ...mockProps, selectedTodo: undefined as any };
      
      expect(() => render(<TodoEditor {...propsWithUndefined} />)).not.toThrow();
      expect(localStorage.clearOtherDrafts).not.toHaveBeenCalled();
    });
  });

  describe('Component lifecycle', () => {
    it('should call clearOtherDrafts on mount with selectedTodo', () => {
      render(<TodoEditor {...mockProps} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledTimes(1);
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');
    });

    it('should call clearOtherDrafts when switching from null to selected todo', () => {
      const { rerender } = render(<TodoEditor {...mockProps} selectedTodo={null} />);

      expect(localStorage.clearOtherDrafts).not.toHaveBeenCalled();

      rerender(<TodoEditor {...mockProps} selectedTodo={baseTodo} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');
    });

    it('should not call clearOtherDrafts when switching from selected to null', () => {
      const { rerender } = render(<TodoEditor {...mockProps} />);

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');
      vi.clearAllMocks();

      rerender(<TodoEditor {...mockProps} selectedTodo={null} />);

      expect(localStorage.clearOtherDrafts).not.toHaveBeenCalled();
    });
  });

  describe('Multiple todo switching scenario', () => {
    it('should handle rapid todo switching correctly', () => {
      const todo1 = { ...baseTodo, id: 'todo-1' };
      const todo2 = { ...baseTodo, id: 'todo-2' };
      const todo3 = { ...baseTodo, id: 'todo-3' };

      const { rerender } = render(<TodoEditor {...mockProps} selectedTodo={todo1} />);
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');

      rerender(<TodoEditor {...mockProps} selectedTodo={todo2} />);
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-2');

      rerender(<TodoEditor {...mockProps} selectedTodo={todo3} />);
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-3');

      rerender(<TodoEditor {...mockProps} selectedTodo={todo1} />);
      expect(localStorage.clearOtherDrafts).toHaveBeenCalledWith('todo-1');

      expect(localStorage.clearOtherDrafts).toHaveBeenCalledTimes(4);
    });
  });
});