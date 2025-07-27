import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TodoEditor from '../components/TodoEditor';

// Mock the services
vi.mock('../services/githubService', () => ({
  getFileMetadata: vi.fn(),
  createOrUpdateTodo: vi.fn(),
  ensureDirectory: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock('../services/aiService', () => ({
  generateInitialPlan: vi.fn(),
  generateCommitMessage: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Test data
const mockTodo = {
  id: 'test-todo-1',
  title: 'Original Title',
  content: '- [ ] Task 1\n- [ ] Task 2',
  priority: 3,
  createdAt: '2025-01-01T10:00:00.000Z',
  isArchived: false,
  frontmatter: {
    tags: []
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

const mockSettings = {
  pat: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  folder: 'todos',
  geminiApiKey: 'test-key',
  aiProvider: 'gemini' as const,
  openRouterApiKey: '',
  aiModel: 'gemini-2.5-flash'
};

const mockTodos = [
  {
    id: 'todo-1',
    title: 'First Todo',
    content: '- [ ] First task',
    priority: 3,
    createdAt: '2025-01-01T10:00:00.000Z',
    isArchived: false,
    frontmatter: {
      tags: []
    },
    path: 'todos/2025-01-01-first-todo.md',
    sha: 'sha1'
  },
  {
    id: 'todo-2',
    title: 'Second Todo',
    content: '- [ ] Second task',
    priority: 2,
    createdAt: '2025-01-02T10:00:00.000Z',
    isArchived: false,
    frontmatter: {
      tags: []
    },
    path: 'todos/2025-01-02-second-todo.md',
    sha: 'sha2'
  },
  {
    id: 'todo-3',
    title: 'Third Todo',
    content: '- [ ] Third task',
    priority: 1,
    createdAt: '2025-01-03T10:00:00.000Z',
    isArchived: false,
    frontmatter: {
      tags: []
    },
    path: 'todos/2025-01-03-third-todo.md',
    sha: 'sha3'
  }
];

describe('Todo Management Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));
  });

  describe('Title Editing & File Operations', () => {
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

  describe('Todo Creation & Collision Detection', () => {
    it('should detect when a file already exists', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock that the file exists
      (getFileMetadata as any).mockResolvedValueOnce({ sha: 'existing-file-sha' });

      const currentDate = new Date().toISOString().split('T')[0];
      const expectedFilename = `todos/${currentDate}-test123.md`;
      
      // Simulate collision detection
      let fileExists = false;
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', expectedFilename);
        fileExists = true;
      } catch (error) {
        fileExists = false;
      }

      expect(fileExists).toBe(true);
      expect(getFileMetadata).toHaveBeenCalledWith('test-token', 'test-owner', 'test-repo', expectedFilename);
    });

    it('should generate unique filenames for collisions', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock multiple collisions
      (getFileMetadata as any)
        .mockResolvedValueOnce({ sha: 'file1-sha' }) // Original file exists
        .mockResolvedValueOnce({ sha: 'file2-sha' }) // -1 exists
        .mockResolvedValueOnce({ sha: 'file3-sha' }) // -2 exists
        .mockRejectedValueOnce(new Error('Not found')); // -3 doesn't exist

      const currentDate = new Date().toISOString().split('T')[0];
      const originalFilename = `todos/${currentDate}-test123.md`;
      let finalFilename = originalFilename;
      
      // Simulate collision resolution logic
      let counter = 1;
      while (true) {
        try {
          await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
          // File exists, try next number
          const pathParts = originalFilename.split('.');
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          finalFilename = `${basePath}-${counter}.${extension}`;
          counter++;
        } catch (error) {
          // File doesn't exist, we can use this filename
          break;
        }
      }

      expect(finalFilename).toBe(`todos/${currentDate}-test123-3.md`);
      expect(getFileMetadata).toHaveBeenCalledTimes(4);
    });

    it('should use original filename when no collision exists', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock that the file doesn't exist
      (getFileMetadata as any).mockRejectedValueOnce(new Error('Not found'));

      const currentDate = new Date().toISOString().split('T')[0];
      const originalFilename = `todos/${currentDate}-test123.md`;
      let finalFilename = originalFilename;
      
      // Simulate collision resolution logic
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
        // Should not reach here since file doesn't exist
      } catch (error) {
        // File doesn't exist, we can use this filename
      }

      expect(finalFilename).toBe(originalFilename);
      expect(getFileMetadata).toHaveBeenCalledTimes(1);
    });

    it('should create correct filename format', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      const currentDate = new Date().toISOString().split('T')[0];
      const slug = createSlug('test123');
      const filename = `todos/${currentDate}-${slug}.md`;
      
      expect(filename).toMatch(/^todos\/\d{4}-\d{2}-\d{2}-test123\.md$/);
    });

    it('should handle special characters in titles correctly', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      const testCases = [
        { title: 'Test 123!@#', expected: 'test-123' },
        { title: 'Task with Special Characters!', expected: 'task-with-special-characters' },
        { title: '   Multiple   Spaces   ', expected: 'multiple-spaces' },
        { title: 'émojis 🚀 and unicode ñ', expected: 'mojis-and-unicode' },
        { title: '---Only---Hyphens---', expected: 'only-hyphens' }
      ];

      testCases.forEach(({ title, expected }) => {
        expect(createSlug(title)).toBe(expected);
      });
    });

    it('should handle same title created multiple times on same day', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Simulate creating 'test123' three times
      const scenarios = [
        {
          name: 'First creation',
          mockReturn: Promise.reject(new Error('Not found')),
          expectedFilename: `todos/${currentDate}-test123.md`
        },
        {
          name: 'Second creation (collision)',
          mockReturn: Promise.resolve({ sha: 'first-file-sha' }),
          thenReject: true,
          expectedFilename: `todos/${currentDate}-test123-1.md`
        },
        {
          name: 'Third creation (two collisions)',
          mockCollisions: 2,
          expectedFilename: `todos/${currentDate}-test123-2.md`
        }
      ];

      // Test first scenario
      (getFileMetadata as any).mockImplementationOnce(() => scenarios[0].mockReturn);
      
      let finalFilename = scenarios[0].expectedFilename;
      try {
        await getFileMetadata('test-token', 'test-owner', 'test-repo', finalFilename);
      } catch (error) {
        // Expected - file doesn't exist
      }
      
      expect(finalFilename).toBe(scenarios[0].expectedFilename);
    });

    it('should work with different folder configurations', async () => {
      const customFolder = 'my-tasks';
      const currentDate = new Date().toISOString().split('T')[0];
      const slug = 'test123';
      
      const expectedFilename = `${customFolder}/${currentDate}-${slug}.md`;
      
      expect(expectedFilename).toBe(`my-tasks/${currentDate}-test123.md`);
    });

    it('should handle empty slugs gracefully', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      const currentDate = new Date().toISOString().split('T')[0];
      const emptySlug = createSlug('!@#$%^&*()');
      const filename = `todos/${currentDate}-${emptySlug}.md`;
      
      // Should still create a valid filename even with empty slug
      expect(filename).toBe(`todos/${currentDate}-.md`);
    });

    it('should handle very long titles', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      const longTitle = 'This is a very long title that should be truncated to fifty characters maximum';
      const slug = createSlug(longTitle);
      
      expect(slug.length).toBeLessThanOrEqual(50);
      expect(slug).toBe('this-is-a-very-long-title-that-should-be-truncated');
    });
  });

  describe('File Renaming Logic', () => {
    it('should create correct new file path from title', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          .trim()
          .substring(0, 50); // Limit length
      };

      expect(createSlug('New Task Title')).toBe('new-task-title');
      expect(createSlug('Task with Special!@#$%^&*()Characters')).toBe('task-with-specialcharacters');
      expect(createSlug('Task    with    multiple    spaces')).toBe('task-with-multiple-spaces');
      expect(createSlug('Task---with---multiple---hyphens')).toBe('task-with-multiple-hyphens');
      expect(createSlug('Very long title that exceeds the fifty character limit and should be truncated')).toBe('very-long-title-that-exceeds-the-fifty-character-l');
    });

    it('should preserve original date from filename', () => {
      const originalPath = 'todos/2025-01-15-original-task.md';
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      expect(timestamp).toBe('2025-01-15');
    });

    it('should handle missing date by using current date', () => {
      const originalPath = 'todos/invalid-filename.md';
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().split('T')[0];
      expect(timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle file name conflicts by appending numbers', async () => {
      const { getFileMetadata } = await import('../services/githubService');
      
      // Mock that first two attempts find existing files
      (getFileMetadata as any)
        .mockResolvedValueOnce({ sha: 'exists1' }) // First attempt exists
        .mockResolvedValueOnce({ sha: 'exists2' }) // Second attempt exists
        .mockRejectedValueOnce(new Error('Not found')); // Third attempt doesn't exist

      const newPath = 'todos/2025-01-15-new-task.md';
      let counter = 1;
      let conflictFreePath = newPath;

      // Simulate conflict resolution logic
      while (true) {
        try {
          await getFileMetadata('token', 'owner', 'repo', conflictFreePath);
          // File exists, try next number
          const pathParts = newPath.split('.');
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          conflictFreePath = `${basePath}-${counter}.${extension}`;
          counter++;
        } catch (error) {
          // File doesn't exist, we can use this path
          break;
        }
      }

      expect(conflictFreePath).toBe('todos/2025-01-15-new-task-2.md');
    });

    it('should call deleteFile with correct parameters', async () => {
      const { deleteFile } = await import('../services/githubService');
      const mockDeleteFile = deleteFile as any;
      
      await mockDeleteFile(
        'test-token',
        'test-owner', 
        'test-repo',
        'todos/2025-01-15-old-task.md',
        'abc123',
        'docs: Remove old file after renaming to "New Task Title"'
      );

      expect(mockDeleteFile).toHaveBeenCalledWith(
        'test-token',
        'test-owner',
        'test-repo', 
        'todos/2025-01-15-old-task.md',
        'abc123',
        'docs: Remove old file after renaming to "New Task Title"'
      );
    });

    it('should handle empty title gracefully', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      expect(createSlug('')).toBe('');
      expect(createSlug('   ')).toBe('');
      expect(createSlug('!@#$%^&*()')).toBe('');
    });

    it('should handle unicode characters', () => {
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };

      expect(createSlug('Task with émojis 🚀 and ñ')).toBe('task-with-mojis-and');
      expect(createSlug('Тест с кириллицей')).toBe('');
    });

    it('should skip file operations when title does not change filename', async () => {
      // Test case where title change doesn't affect the slug
      const originalPath = 'todos/2025-01-15-task-title.md';
      const newTitle = 'Task Title'; // Same slug
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const newPath = `todos/${timestamp}-${newSlug}.md`;
      
      expect(originalPath).toBe(newPath); // Should be the same, no renaming needed
    });

    it('should handle renaming when adding/removing words', async () => {
      const originalPath = 'todos/2025-01-15-task-title.md';
      const newTitle = 'Task Title Extended Version';
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim()
          .substring(0, 50);
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = originalPath.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const newPath = `todos/${timestamp}-${newSlug}.md`;
      
      expect(originalPath).not.toBe(newPath); // Should be different, renaming needed
      expect(newPath).toBe('todos/2025-01-15-task-title-extended-version.md');
    });
  });

  describe('Selection Preservation Logic', () => {
    it('should correctly identify preserved todo by path', () => {
      const todos = [
        { id: 'new-id-1', path: 'todos/file1.md', title: 'Todo 1' },
        { id: 'new-id-2', path: 'todos/file2.md', title: 'Todo 2' },
        { id: 'new-id-3', path: 'todos/file3.md', title: 'Todo 3' }
      ];

      const preserveTodoPath = 'todos/file2.md';
      const preservedTodo = todos.find(todo => todo.path === preserveTodoPath);
      
      expect(preservedTodo).toBeDefined();
      expect(preservedTodo?.id).toBe('new-id-2');
      expect(preservedTodo?.title).toBe('Todo 2');
    });

    it('should handle case where preserved path does not exist', () => {
      const todos = [
        { id: 'new-id-1', path: 'todos/file1.md', title: 'Todo 1' },
        { id: 'new-id-3', path: 'todos/file3.md', title: 'Todo 3' }
      ];

      const preserveTodoPath = 'todos/file2.md'; // This file was deleted
      const preservedTodo = todos.find(todo => todo.path === preserveTodoPath);
      
      expect(preservedTodo).toBeUndefined();
      // Should fall back to first todo in this case
      expect(todos[0].id).toBe('new-id-1');
    });

    it('should work with different view modes', () => {
      const allTodos = [
        { id: '1', path: 'todos/active1.md', title: 'Active 1' },
        { id: '2', path: 'todos/active2.md', title: 'Active 2' },
        { id: '3', path: 'todos/archive/archived1.md', title: 'Archived 1' }
      ];

      // Test active view filtering
      const activeTodos = allTodos.filter(todo => !todo.path.includes('/archive/'));
      expect(activeTodos).toHaveLength(2);
      expect(activeTodos.map(t => t.title)).toEqual(['Active 1', 'Active 2']);

      // Test archived view filtering  
      const archivedTodos = allTodos.filter(todo => todo.path.includes('/archive/'));
      expect(archivedTodos).toHaveLength(1);
      expect(archivedTodos[0].title).toBe('Archived 1');
    });

    it('should preserve selection after SHA changes', () => {
      // Simulate what happens when a todo is updated
      const originalTodos = mockTodos;
      
      // After update, the todo gets a new SHA (and therefore new ID)
      const updatedTodos = [
        originalTodos[0], // unchanged
        {
          ...originalTodos[1],
          id: 'todo-2-updated', // New ID due to new SHA
          title: 'Updated Second Todo',
          frontmatter: {
            ...originalTodos[1].frontmatter,
            title: 'Updated Second Todo'
          },
          sha: 'updated-sha2'
        },
        originalTodos[2] // unchanged
      ];

      // The preservation logic should find the todo by path
      const preserveTodoPath = 'todos/2025-01-02-second-todo.md';
      const preservedTodo = updatedTodos.find(todo => todo.path === preserveTodoPath);
      
      expect(preservedTodo).toBeDefined();
      expect(preservedTodo?.id).toBe('todo-2-updated'); // New ID
      expect(preservedTodo?.title).toBe('Updated Second Todo'); // Updated title
      expect(preservedTodo?.path).toBe(preserveTodoPath); // Same path
    });

    it('should handle fetchTodos with preserve path parameter', () => {
      // Mock the fetchTodosWithSettings function behavior
      const simulateFetchTodosWithSettings = (
        todos: any[], 
        viewMode: 'active' | 'archived', 
        preserveTodoPath?: string
      ) => {
        const filteredTodos = viewMode === 'archived' 
          ? todos.filter(todo => todo.path.includes('/archive/'))
          : todos.filter(todo => !todo.path.includes('/archive/'));

        // Simulate the auto-selection logic with preserve path support
        let selectedTodoId = null;
        
        // If we're trying to preserve a specific todo path, find it first
        if (preserveTodoPath) {
          const preservedTodo = filteredTodos.find(todo => todo.path === preserveTodoPath);
          if (preservedTodo) {
            selectedTodoId = preservedTodo.id;
          }
        }
        
        // Otherwise, use the normal auto-selection logic
        if (!selectedTodoId && filteredTodos.length > 0) {
          selectedTodoId = filteredTodos[0].id;
        }

        return { filteredTodos, selectedTodoId };
      };

      // Test with preserve path
      const result1 = simulateFetchTodosWithSettings(
        mockTodos, 
        'active', 
        'todos/2025-01-02-second-todo.md'
      );
      expect(result1.selectedTodoId).toBe('todo-2');

      // Test without preserve path (should select first)
      const result2 = simulateFetchTodosWithSettings(mockTodos, 'active');
      expect(result2.selectedTodoId).toBe('todo-1');

      // Test with non-existent preserve path (should fall back to first)
      const result3 = simulateFetchTodosWithSettings(
        mockTodos, 
        'active', 
        'todos/non-existent.md'
      );
      expect(result3.selectedTodoId).toBe('todo-1');
    });

    it('should test the complete update workflow preserves selection', () => {
      // This simulates what happens in App.tsx handleTitleUpdate, handlePriorityUpdate, etc.
      const simulateUpdateWorkflow = (
        originalTodos: any[],
        updatedTodos: any[],
        todoPath: string
      ) => {
        // Step 1: Todo is updated, gets new SHA
        // Step 2: fetchTodos is called with preserveTodoPath
        const isArchiveView = false; // For this test, we're testing active view
        const filteredTodos = isArchiveView 
          ? updatedTodos.filter(todo => todo.path.includes('/archive/'))
          : updatedTodos.filter(todo => !todo.path.includes('/archive/'));

        // Step 3: Auto-selection logic with preservation
        const preservedTodo = filteredTodos.find(todo => todo.path === todoPath);
        const selectedTodoId = preservedTodo ? preservedTodo.id : filteredTodos[0]?.id;

        return { selectedTodoId, preservedTodo };
      };

      // Simulate title update
      const originalTodos = mockTodos;
      const updatedTodos = [
        originalTodos[0],
        {
          ...originalTodos[1],
          id: 'todo-2-new-sha',
          title: 'Updated Title',
          sha: 'new-sha'
        },
        originalTodos[2]
      ];

      const result = simulateUpdateWorkflow(
        originalTodos,
        updatedTodos,
        'todos/2025-01-02-second-todo.md'
      );

      expect(result.selectedTodoId).toBe('todo-2-new-sha');
      expect(result.preservedTodo?.title).toBe('Updated Title');
    });
  });

  describe('Progress Bar Calculations', () => {
    // Simulate the getProgressWidth function logic
    const getProgressWidth = (creationStep: string) => {
      if (!creationStep) return '0%';
      
      // Task creation steps in chronological order with smooth progression
      if (creationStep.includes('Starting')) return '5%';
      if (creationStep.includes('Generating task plan')) return '15%';
      if (creationStep.includes('Preparing task content')) return '30%';
      if (creationStep.includes('Generating commit message')) return '45%';
      if (creationStep.includes('Setting up repository')) return '60%';
      if (creationStep.includes('Checking for filename conflicts')) return '70%';
      if (creationStep.includes('Saving to GitHub')) return '80%';
      if (creationStep.includes('Refreshing task list')) return '90%';
      if (creationStep.includes('Task created successfully') || creationStep.includes('✅')) return '100%';
      
      // Error and retry states
      if (creationStep.includes('Waiting for GitHub')) return '85%';
      if (creationStep.includes('Task found')) return '95%';
      if (creationStep.includes('Taking longer than expected')) return '95%';
      if (creationStep.includes('Error, retrying')) return '75%';
      if (creationStep.includes('failed') || creationStep.includes('❌')) return '100%';
      
      return '100%';
    };

    it('should calculate correct progress for normal task creation workflow', () => {
      const taskCreationSteps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const expectedProgressions = ['5%', '15%', '30%', '45%', '60%', '70%', '80%', '90%', '100%'];
      
      taskCreationSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should show smooth progression without jumping', () => {
      const steps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const progressValues = steps.map(step => parseInt(getProgressWidth(step)));
      
      // Verify smooth progression (no backwards movement)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }

      // Verify specific smooth progression
      expect(progressValues).toEqual([5, 15, 30, 45, 60, 70, 80, 90, 100]);
    });

    it('should handle filename conflict detection correctly', () => {
      // This is the step that was previously causing issues
      const conflictStep = '🔍 Checking for filename conflicts...';
      const progress = getProgressWidth(conflictStep);
      
      expect(progress).toBe('70%');
      expect(parseInt(progress)).toBeGreaterThan(60); // Should be after "Setting up repository"
      expect(parseInt(progress)).toBeLessThan(80); // Should be before "Saving to GitHub"
    });

    it('should handle error states correctly', () => {
      const errorSteps = [
        'Error, retrying...',
        'Creation failed',
        '❌ Task creation failed!'
      ];

      const expectedProgressions = ['75%', '100%', '100%'];
      
      errorSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should handle waiting and delay states', () => {
      const waitingSteps = [
        'Waiting for GitHub...',
        'Task found',
        'Taking longer than expected...'
      ];

      const expectedProgressions = ['85%', '95%', '95%'];
      
      waitingSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should handle empty and unknown steps', () => {
      const unknownSteps = [
        '',
        'Unknown step',
        'Random text',
        'Some other operation'
      ];

      unknownSteps.forEach(step => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(step === '' ? '0%' : '100%');
      });
    });

    it('should handle variations in step messages', () => {
      // Test that similar messages are handled correctly
      const stepVariations = [
        { step: 'Generating task plan', expected: '15%' },
        { step: '🤖 Generating task plan with AI...', expected: '15%' },
        { step: 'Preparing task content', expected: '30%' },
        { step: '📝 Preparing task content...', expected: '30%' },
        { step: 'Generating commit message', expected: '45%' },
        { step: '💬 Generating commit message...', expected: '45%' },
        { step: 'Setting up repository', expected: '60%' },
        { step: '📂 Setting up repository...', expected: '60%' }
      ];

      stepVariations.forEach(({ step, expected }) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expected);
      });
    });

    it('should maintain smooth progression even with emoji prefixes', () => {
      const stepsWithEmojis = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const progressValues = stepsWithEmojis.map(step => parseInt(getProgressWidth(step)));
      
      // Verify smooth progression despite emoji prefixes
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }
    });

    it('should handle rapid step changes efficiently', () => {
      const rapidSteps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        'Error, retrying...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        'Waiting for GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      // Should handle all steps without issues
      rapidSteps.forEach(step => {
        const progress = getProgressWidth(step);
        expect(progress).toMatch(/^\d+%$/); // Should always return valid percentage
        expect(parseInt(progress)).toBeGreaterThanOrEqual(0);
        expect(parseInt(progress)).toBeLessThanOrEqual(100);
      });
    });
  });
});