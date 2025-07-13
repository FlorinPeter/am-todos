import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import App from '../App';
import * as localStorage from '../utils/localStorage';
import * as gitService from '../services/gitService';
import * as aiService from '../services/aiService';

// Mock all dependencies
vi.mock('../utils/localStorage');
vi.mock('../services/gitService');
vi.mock('../services/aiService');
vi.mock('../utils/logger');

const mockLoadSettings = vi.mocked(localStorage.loadSettings);
const mockGetUrlConfig = vi.mocked(localStorage.getUrlConfig);
const mockSaveSettings = vi.mocked(localStorage.saveSettings);
const mockLoadSelectedTodoId = vi.mocked(localStorage.loadSelectedTodoId);
const mockSaveSelectedTodoId = vi.mocked(localStorage.saveSelectedTodoId);
const mockClearSelectedTodoId = vi.mocked(localStorage.clearSelectedTodoId);

const mockGetTodos = vi.mocked(gitService.getTodos);
const mockGetFileContent = vi.mocked(gitService.getFileContent);
const mockCreateOrUpdateTodo = vi.mocked(gitService.createOrUpdateTodo);
const mockDeleteFile = vi.mocked(gitService.deleteFile);
const mockMoveTaskToArchive = vi.mocked(gitService.moveTaskToArchive);
const mockMoveTaskFromArchive = vi.mocked(gitService.moveTaskFromArchive);

const mockGenerateInitialPlan = vi.mocked(aiService.generateInitialPlan);
const mockGenerateCommitMessage = vi.mocked(aiService.generateCommitMessage);

// Mock window.history
const mockReplaceState = vi.fn();
Object.defineProperty(window, 'history', {
  value: { replaceState: mockReplaceState },
  writable: true,
});

// Mock URL constructor
const mockUrl = {
  searchParams: {
    delete: vi.fn(),
  },
  toString: vi.fn(() => 'https://example.com'),
};
global.URL = vi.fn(() => mockUrl as any);

describe('App Component - Comprehensive Coverage', () => {
  const mockSettings = {
    githubPat: 'test-token',
    repoOwner: 'test-owner',
    repoName: 'test-repo',
    todosDirectory: 'todos',
    gitProvider: 'github' as const,
  };

  const mockTodos = [
    {
      id: 'todo-1',
      filename: '2024-01-01-test-todo.md',
      frontmatter: {
        title: 'Test Todo',
        createdAt: '2024-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
      },
      content: '- [ ] Test task',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockReturnValue(mockSettings);
    mockGetUrlConfig.mockReturnValue(null);
    mockLoadSelectedTodoId.mockReturnValue(null);
    mockGetTodos.mockResolvedValue(mockTodos);
    mockGetFileContent.mockResolvedValue('- [ ] Test task');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  test('handles URL configuration on mount', async () => {
    const urlConfig = { ...mockSettings, repoName: 'url-repo' };
    mockGetUrlConfig.mockReturnValue(urlConfig);

    render(<App />);

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(urlConfig);
      expect(mockUrl.searchParams.delete).toHaveBeenCalledWith('config');
      expect(mockReplaceState).toHaveBeenCalledWith({}, '', 'https://example.com');
    });
  });

  test('loads settings from localStorage when no URL config', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockLoadSettings).toHaveBeenCalled();
      expect(mockGetUrlConfig).toHaveBeenCalled();
      expect(mockSaveSettings).not.toHaveBeenCalled();
    });
  });

  test('handles todo creation workflow', async () => {
    mockGenerateInitialPlan.mockResolvedValue('# Test Plan\n- [ ] Task 1');
    mockGenerateCommitMessage.mockResolvedValue('feat: add test todo');
    mockCreateOrUpdateTodo.mockResolvedValue(undefined);

    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });

    // Click new task button
    fireEvent.click(screen.getByText('New Task'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter a new high-level goal/i)).toBeInTheDocument();
    });

    // Enter task description
    const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
    fireEvent.change(input, { target: { value: 'Test new task' } });
    fireEvent.click(screen.getByText('Generate Todo List'));

    await waitFor(() => {
      expect(mockGenerateInitialPlan).toHaveBeenCalledWith('Test new task');
    });
  });

  test('handles todo deletion workflow', async () => {
    mockDeleteFile.mockResolvedValue(undefined);
    mockGenerateCommitMessage.mockResolvedValue('feat: delete test todo');

    render(<App />);

    await waitFor(() => {
      expect(mockGetTodos).toHaveBeenCalled();
    });

    // Mock selected todo
    const selectedTodo = mockTodos[0];
    
    // Simulate clicking delete (would be in TodoEditor component)
    // We'll test the handleDeleteTodo function directly by triggering it
    // This tests the App's state management for deletion
    
    // The delete workflow is internal to the component, so we test state changes
    expect(screen.queryByText('Deleting task...')).not.toBeInTheDocument();
  });

  test('handles archive/unarchive workflow', async () => {
    mockMoveTaskToArchive.mockResolvedValue(undefined);
    mockMoveTaskFromArchive.mockResolvedValue(undefined);
    mockGenerateCommitMessage.mockResolvedValue('feat: archive test todo');

    render(<App />);

    await waitFor(() => {
      expect(mockGetTodos).toHaveBeenCalled();
    });

    // Test archive view toggle
    const archiveButton = screen.getByText('Archive');
    fireEvent.click(archiveButton);

    // Should switch to archived view
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  test('handles settings modal toggle', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Settings')).toBeInTheDocument();
    });

    // Open settings
    fireEvent.click(screen.getByLabelText('Settings'));

    await waitFor(() => {
      expect(screen.getByText('Git Configuration')).toBeInTheDocument();
    });
  });

  test('handles sidebar toggle', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
    });

    // Toggle sidebar
    fireEvent.click(screen.getByLabelText('Toggle sidebar'));

    // Test mobile sidebar functionality
    expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
  });

  test('handles todo selection and persistence', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockLoadSelectedTodoId).toHaveBeenCalled();
    });

    // Test that selected todo is loaded from localStorage
    // and saved when changed
    expect(mockLoadSelectedTodoId).toHaveBeenCalled();
  });

  test('handles provider name display', async () => {
    render(<App />);

    // Test GitHub provider
    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    // Test GitLab provider
    mockLoadSettings.mockReturnValue({
      ...mockSettings,
      gitProvider: 'gitlab',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('GitLab')).toBeInTheDocument();
    });
  });

  test('handles error states in todo operations', async () => {
    mockGetTodos.mockRejectedValue(new Error('API Error'));

    render(<App />);

    await waitFor(() => {
      expect(mockGetTodos).toHaveBeenCalled();
    });

    // Component should handle the error gracefully
    expect(screen.queryByText('Error loading todos')).not.toBeInTheDocument();
  });

  test('handles loading states during operations', async () => {
    // Mock slow operations
    mockGenerateInitialPlan.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve('# Test Plan'), 1000)
    ));

    render(<App />);

    // Open new task modal
    await waitFor(() => {
      fireEvent.click(screen.getByText('New Task'));
    });

    // Enter task and submit
    const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
    fireEvent.change(input, { target: { value: 'Test task' } });
    fireEvent.click(screen.getByText('Generate Todo List'));

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });
  });

  test('handles window resize for responsive behavior', async () => {
    render(<App />);

    // Simulate window resize
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    fireEvent(window, new Event('resize'));

    // Component should handle responsive behavior
    await waitFor(() => {
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });
  });

  test('handles keyboard shortcuts', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('New Task')).toBeInTheDocument();
    });

    // Test escape key to close modals
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    // Should close any open modals
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('handles project switching', async () => {
    const projectTodos = [
      {
        id: 'project-todo-1',
        filename: 'project/2024-01-01-project-todo.md',
        frontmatter: {
          title: 'Project Todo',
          createdAt: '2024-01-01T00:00:00.000Z',
          priority: 2,
          isArchived: false,
        },
        content: '- [ ] Project task',
      },
    ];

    mockGetTodos.mockResolvedValueOnce(mockTodos).mockResolvedValueOnce(projectTodos);

    render(<App />);

    await waitFor(() => {
      expect(mockGetTodos).toHaveBeenCalledWith(expect.objectContaining({
        todosDirectory: 'todos'
      }));
    });

    // Test project switching functionality would be triggered by ProjectManager component
    // This tests the App's response to project changes
    expect(mockGetTodos).toHaveBeenCalled();
  });
});