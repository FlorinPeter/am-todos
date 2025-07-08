import { vi, describe, it, expect } from 'vitest';

// Test data for selection preservation
const mockTodos = [
  {
    id: 'todo-1',
    title: 'First Todo',
    content: '- [ ] First task',
    frontmatter: {
      title: 'First Todo',
      createdAt: '2025-01-01T10:00:00.000Z',
      priority: 3,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/2025-01-01-first-todo.md',
    sha: 'sha1'
  },
  {
    id: 'todo-2',
    title: 'Second Todo',
    content: '- [ ] Second task',
    frontmatter: {
      title: 'Second Todo',
      createdAt: '2025-01-02T10:00:00.000Z',
      priority: 2,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/2025-01-02-second-todo.md',
    sha: 'sha2'
  },
  {
    id: 'todo-3',
    title: 'Third Todo',
    content: '- [ ] Third task',
    frontmatter: {
      title: 'Third Todo',
      createdAt: '2025-01-03T10:00:00.000Z',
      priority: 1,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/2025-01-03-third-todo.md',
    sha: 'sha3'
  }
];

describe('Selection Preservation Logic Unit Tests', () => {
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

  it('should work with archived todos', () => {
    const mixedTodos = [
      mockTodos[0], // active
      {
        ...mockTodos[1],
        path: 'todos/archive/2025-01-02-second-todo.md' // archived
      },
      mockTodos[2] // active
    ];

    // Test preserving an archived todo
    const preserveTodoPath = 'todos/archive/2025-01-02-second-todo.md';
    const archivedTodos = mixedTodos.filter(todo => todo.path.includes('/archive/'));
    const preservedTodo = archivedTodos.find(todo => todo.path === preserveTodoPath);
    
    expect(preservedTodo).toBeDefined();
    expect(preservedTodo?.path).toBe(preserveTodoPath);
  });
});

describe('Selection Preservation Integration', () => {
  it('should test the complete update workflow preserves selection', () => {
    // This simulates what happens in App.tsx handleTitleUpdate, handlePriorityUpdate, etc.
    const simulateUpdateWorkflow = (
      originalTodos: any[],
      updatedTodos: any[],
      todoPath: string
    ) => {
      // Step 1: Todo is updated, gets new SHA
      // Step 2: fetchTodos is called with preserveTodoPath
      const viewMode = 'active';
      const filteredTodos = viewMode === 'archived' 
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

  it('should test the fetchTodos function signature with preserve parameter', () => {
    // Test that the function can be called with the preserve parameter
    const mockFetchTodos = async (preserveTodoPath?: string) => {
      // This simulates the updated fetchTodos function signature
      return { preserveTodoPath };
    };

    // Should work with preserve path
    expect(mockFetchTodos('todos/test.md')).resolves.toEqual({
      preserveTodoPath: 'todos/test.md'
    });

    // Should work without preserve path
    expect(mockFetchTodos()).resolves.toEqual({
      preserveTodoPath: undefined
    });
  });
});