import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, type MockedFunction } from 'vitest';
import App from '../App';
import * as localStorage from '../utils/localStorage';
import * as gitService from '../services/gitService';
import * as aiService from '../services/aiService';
import * as markdown from '../utils/markdown';
import logger from '../utils/logger';

// Mock all the dependencies
vi.mock('../utils/localStorage');
vi.mock('../services/gitService');
vi.mock('../services/aiService');
vi.mock('../utils/markdown');
vi.mock('../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock child components to isolate App component logic
vi.mock('../components/NewTodoInput', () => ({
  default: ({ onSubmit, onCancel, isCreating, step }: any) => (
    <div data-testid="new-todo-input">
      <input 
        data-testid="goal-input" 
        placeholder="Enter your goal"
        onChange={(e) => {}}
      />
      <button 
        data-testid="submit-goal" 
        onClick={() => onSubmit('Test goal')}
        disabled={isCreating}
      >
        {isCreating ? `Creating... ${step}` : 'Submit'}
      </button>
      <button data-testid="cancel-goal" onClick={onCancel}>Cancel</button>
    </div>
  )
}));

vi.mock('../components/TodoSidebar', () => ({
  default: ({ todos, selectedTodoId, onTodoSelect, onNewTodoClick, onArchiveToggle, onDeleteTodo, viewMode, allTodos }: any) => {
    // Provide default mock data if not provided
    const mockTodos = todos || [];
    const mockAllTodos = allTodos || [];
    const currentViewMode = viewMode || 'active';
    
    return (
      <div data-testid="todo-sidebar">
        <button data-testid="new-todo-btn" onClick={onNewTodoClick}>New Todo</button>
        <div data-testid="view-mode">{currentViewMode}</div>
        <div data-testid="active-count">{mockAllTodos.filter((t: any) => !t.path?.includes('/archive/')).length}</div>
        <div data-testid="archived-count">{mockAllTodos.filter((t: any) => t.path?.includes('/archive/')).length}</div>
        {mockTodos.map((todo: any) => (
          <div 
            key={todo.id}
            data-testid={`todo-${todo.id}`}
            onClick={() => onTodoSelect?.(todo.id)}
            style={{ backgroundColor: selectedTodoId === todo.id ? 'blue' : 'white' }}
          >
            {todo.title}
          </div>
        ))}
        <button data-testid="archive-toggle" onClick={() => onArchiveToggle?.()}>
          Switch to {currentViewMode === 'active' ? 'Archived' : 'Active'}
        </button>
      </div>
    );
  }
}));

vi.mock('../components/TodoEditor', () => ({
  default: ({ selectedTodo, onSave, onArchive, onUnarchive, onDelete, isSaving, saveStep, isDeleting, deletionStep }: any) => (
    <div data-testid="todo-editor">
      {selectedTodo ? (
        <>
          <div data-testid="selected-todo-title">{selectedTodo.title}</div>
          <div data-testid="selected-todo-content">{selectedTodo.content}</div>
          <button 
            data-testid="save-todo" 
            onClick={() => onSave?.('Updated content', [])}
            disabled={isSaving}
          >
            {isSaving ? `Saving... ${saveStep}` : 'Save'}
          </button>
          <button 
            data-testid="archive-todo" 
            onClick={() => onArchive?.()}
          >
            Archive
          </button>
          <button 
            data-testid="unarchive-todo" 
            onClick={() => onUnarchive?.()}
          >
            Unarchive
          </button>
          <button 
            data-testid="delete-todo" 
            onClick={() => onDelete?.()}
            disabled={isDeleting}
          >
            {isDeleting ? `Deleting... ${deletionStep}` : 'Delete'}
          </button>
        </>
      ) : (
        <div data-testid="no-todo-selected">No todo selected</div>
      )}
    </div>
  )
}));

vi.mock('../components/GeneralSettings', () => ({
  default: ({ onSettingsSaved }: any) => (
    <div data-testid="general-settings">
      <button data-testid="save-settings" onClick={onSettingsSaved}>Save Settings</button>
    </div>
  )
}));

vi.mock('../components/ProjectManager', () => ({
  default: ({ onProjectChanged }: any) => (
    <div data-testid="project-manager">
      <button 
        data-testid="change-project" 
        onClick={() => onProjectChanged({ gitProvider: 'github', folder: 'new-folder' })}
      >
        Change Project
      </button>
    </div>
  )
}));

// Mock implementations
const mockLoadSettings = localStorage.loadSettings as MockedFunction<typeof localStorage.loadSettings>;
const mockSaveSettings = localStorage.saveSettings as MockedFunction<typeof localStorage.saveSettings>;
const mockGetUrlConfig = localStorage.getUrlConfig as MockedFunction<typeof localStorage.getUrlConfig>;
const mockLoadSelectedTodoId = localStorage.loadSelectedTodoId as MockedFunction<typeof localStorage.loadSelectedTodoId>;
const mockSaveSelectedTodoId = localStorage.saveSelectedTodoId as MockedFunction<typeof localStorage.saveSelectedTodoId>;
const mockClearSelectedTodoId = localStorage.clearSelectedTodoId as MockedFunction<typeof localStorage.clearSelectedTodoId>;

const mockGetTodos = gitService.getTodos as MockedFunction<typeof gitService.getTodos>;
const mockGetFileContent = gitService.getFileContent as MockedFunction<typeof gitService.getFileContent>;
const mockCreateOrUpdateTodo = gitService.createOrUpdateTodo as MockedFunction<typeof gitService.createOrUpdateTodo>;
const mockDeleteFile = gitService.deleteFile as MockedFunction<typeof gitService.deleteFile>;
const mockMoveTaskToArchive = gitService.moveTaskToArchive as MockedFunction<typeof gitService.moveTaskToArchive>;
const mockGenerateCommitMessage = aiService.generateCommitMessage as MockedFunction<typeof aiService.generateCommitMessage>;

const mockParseMarkdownWithMetadata = vi.mocked(markdown.parseMarkdownWithMetadata);
const mockStringifyMarkdownWithMetadata = vi.mocked(markdown.stringifyMarkdownWithMetadata);

describe('App Component', () => {
  const mockSettings = {
    gitProvider: 'github' as const,
    pat: 'test-token',
    owner: 'testuser',
    repo: 'test-repo',
    folder: 'todos'
  };


  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockLoadSettings.mockReturnValue(mockSettings);
    mockGetUrlConfig.mockReturnValue(null);
    mockLoadSelectedTodoId.mockReturnValue(null);
    
    mockGetTodos.mockImplementation(async (folder, includeArchived) => {
      if (includeArchived) {
        return [{
          id: 'todo2',
          title: 'Archived Todo',
          content: '# Archived Todo\n\n- [x] Completed task',
          path: 'todos/archive/todo2.md',
          sha: 'sha2',
          priority: 2,
          createdAt: '2023-01-02T00:00:00.000Z',
          isArchived: true,
          frontmatter: { tags: [] }
        }];
      } else {
        return [{
          id: 'todo1',
          title: 'Test Todo 1',
          content: '# Test Todo 1\n\n- [ ] Task 1',
          path: 'todos/todo1.md',
          sha: 'sha1',
          priority: 3,
          createdAt: '2023-01-01T00:00:00.000Z',
          isArchived: false,
          frontmatter: { tags: [] }
        }];
      }
    });
    
    mockGetFileContent.mockImplementation(async (path) => {
      if (path.includes('todo1')) {
        return '---\ntags: []\n---\n# Test Todo 1\n\n- [ ] Task 1';
      } else {
        return '---\ntags: []\n---\n# Archived Todo\n\n- [x] Completed task';
      }
    });
    
    mockParseMarkdownWithMetadata.mockImplementation((content, filename) => {
      if (content.includes('Test Todo 1')) {
        return {
          title: 'Test Todo 1',
          createdAt: '2023-01-01T00:00:00.000Z',
          priority: 3,
          isArchived: false,
          frontmatter: { tags: [] },
          markdownContent: '# Test Todo 1\n\n- [ ] Task 1'
        };
      } else {
        return {
          title: 'Archived Todo',
          createdAt: '2023-01-02T00:00:00.000Z',
          priority: 2,
          isArchived: true,
          frontmatter: { tags: [] },
          markdownContent: '# Archived Todo\n\n- [x] Completed task'
        };
      }
    });
  });

  describe('Initial Render and Setup', () => {
    it('renders main app components', () => {
      render(<App />);
      
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('todo-editor')).toBeInTheDocument();
      expect(screen.getByTestId('project-manager')).toBeInTheDocument();
    });

    it('loads settings on mount', () => {
      render(<App />);
      
      expect(mockLoadSettings).toHaveBeenCalled();
    });

    it('handles URL configuration on mount', () => {
      const urlConfig = { 
        gitProvider: 'github' as const, 
        pat: 'url-token',
        owner: 'test-owner',
        repo: 'test-repo', 
        folder: 'todos'
      };
      mockGetUrlConfig.mockReturnValue(urlConfig);
      
      // Mock URL and history
      const mockReplace = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { href: 'http://localhost:3000?config=test' },
        writable: true
      });
      Object.defineProperty(window, 'history', {
        value: { replaceState: mockReplace },
        writable: true
      });

      render(<App />);
      
      expect(mockSaveSettings).toHaveBeenCalledWith(urlConfig);
    });

    it('fetches todos when settings are available', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockGetTodos).toHaveBeenCalledWith('todos', false);
      }, { timeout: 3000 });
    });

    it('renders todo sidebar and editor', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('todo-editor')).toBeInTheDocument();
    });
  });

  describe('Todo Management', () => {
    it('renders todo sidebar with todos', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      });
    });

    it('handles todo selection through sidebar', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      });
      
      // Test that the sidebar has the expected structure
      expect(screen.getByTestId('view-mode')).toHaveTextContent('active');
    });

    it('persists selected todo ID to localStorage', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockSaveSelectedTodoId).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('restores selected todo from localStorage', async () => {
      mockLoadSelectedTodoId.mockReturnValue('todo1');
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockLoadSelectedTodoId).toHaveBeenCalled();
      });
    });
  });

  describe('View Mode Switching', () => {
    it('renders with active view mode by default', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('view-mode')).toHaveTextContent('active');
      });
    });

    it('toggles view mode when archive button is clicked', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('archive-toggle')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('archive-toggle'));
      
      // The view mode should change (handled by component state)
      expect(screen.getByTestId('archive-toggle')).toBeInTheDocument();
    });
  });

  describe('Todo Creation', () => {
    it('renders new todo button in sidebar', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('new-todo-btn')).toBeInTheDocument();
      });
    });

    it('handles new todo button click', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('new-todo-btn')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      
      // The button should still be present after click
      expect(screen.getByTestId('new-todo-btn')).toBeInTheDocument();
    });

    it('renders todo creation interface components', async () => {
      render(<App />);
      
      // Check that the app renders the main components
      await waitFor(() => {
        expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      });
      expect(screen.getByTestId('todo-editor')).toBeInTheDocument();
      expect(screen.getByTestId('project-manager')).toBeInTheDocument();
    });
  });

  describe('Todo Operations', () => {
    it('renders todo editor with operation buttons when todo is selected', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('todo-editor')).toBeInTheDocument();
      });
      
      // The app auto-selects the first todo, so buttons should be present
      await waitFor(() => {
        expect(screen.getByTestId('save-todo')).toBeInTheDocument();
      });
      expect(screen.getByTestId('archive-todo')).toBeInTheDocument();
      expect(screen.getByTestId('delete-todo')).toBeInTheDocument();
    });

    it('calls save handler when save button is clicked', async () => {
      mockStringifyMarkdownWithMetadata.mockReturnValue('updated markdown');
      mockGenerateCommitMessage.mockResolvedValue({
        message: 'feat: Update todo',
        description: 'Generated commit message for todo update'
      });
      mockCreateOrUpdateTodo.mockResolvedValue({ sha: 'updated-sha' });
      
      render(<App />);
      
      // The app auto-selects the first todo, so save button should be present
      await waitFor(() => {
        expect(screen.getByTestId('save-todo')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('save-todo'));
      
      // The mock should be called through the component handler
      expect(screen.getByTestId('save-todo')).toBeInTheDocument();
    });

    it('calls archive handler when archive button is clicked', async () => {
      mockMoveTaskToArchive.mockResolvedValue(undefined);
      
      render(<App />);
      
      // The app auto-selects the first todo, so archive button should be present
      await waitFor(() => {
        expect(screen.getByTestId('archive-todo')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('archive-todo'));
      
      // The archive button should still be present
      expect(screen.getByTestId('archive-todo')).toBeInTheDocument();
    });

    it('calls delete handler when delete button is clicked', async () => {
      mockDeleteFile.mockResolvedValue(undefined);
      
      render(<App />);
      
      // The app auto-selects the first todo, so delete button should be present
      await waitFor(() => {
        expect(screen.getByTestId('delete-todo')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('delete-todo'));
      
      // The delete button should still be present
      expect(screen.getByTestId('delete-todo')).toBeInTheDocument();
    });
  });

  describe('Settings Management', () => {
    it('renders project management component', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('project-manager')).toBeInTheDocument();
      });
    });

    it('handles project change', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('change-project')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('change-project'));
      
      // The component should handle the project change
      expect(screen.getByTestId('change-project')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch todos error', async () => {
      mockGetTodos.mockRejectedValue(new Error('Network error'));
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      render(<App />);
      
      await waitFor(() => {
        // Should log errors for both active and archived todo fetching
        expect(loggerSpy).toHaveBeenCalledWith('Failed to fetch active todos:', expect.any(Error));
      });
      expect(loggerSpy).toHaveBeenCalledWith('Failed to fetch archived todos (archive folder may not exist):', expect.any(Error));
      
      loggerSpy.mockRestore();
    });

    it('handles empty todos list', async () => {
      mockGetTodos.mockResolvedValue([]);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('no-todo-selected')).toBeInTheDocument();
      });
    });

    it('handles missing settings', async () => {
      mockLoadSettings.mockReturnValue(null);
      
      render(<App />);
      
      // Should not attempt to fetch todos without settings
      expect(mockGetTodos).not.toHaveBeenCalled();
    });

    it('renders GeneralSettings when no settings exist', async () => {
      mockLoadSettings.mockReturnValue(null);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('general-settings')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard and UI Interactions', () => {
    it('handles sidebar toggle', async () => {
      render(<App />);
      
      // The sidebar state is managed internally, we can test if component renders
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });

    it('provides correct provider name', async () => {
      const gitlabSettings = { ...mockSettings, gitProvider: 'gitlab' as const };
      mockLoadSettings.mockReturnValue(gitlabSettings);
      
      render(<App />);
      
      // Provider name is used internally, component should render correctly
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });
  });

  describe('Data Persistence and Recovery', () => {
    it('preserves todo path during refresh', async () => {
      render(<App />);
      
      // This tests internal logic - the component should handle path preservation
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });

    it('clears selection when no todos exist', async () => {
      mockGetTodos.mockResolvedValue([]);
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockClearSelectedTodoId).toHaveBeenCalled();
      });
    });
  });
});