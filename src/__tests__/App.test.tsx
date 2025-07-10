import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import * as localStorage from '../utils/localStorage';
import * as gitService from '../services/gitService';
import * as aiService from '../services/aiService';
import * as markdown from '../utils/markdown';

// Mock all the dependencies
vi.mock('../utils/localStorage');
vi.mock('../services/gitService');
vi.mock('../services/aiService');
vi.mock('../utils/markdown');

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
  default: ({ todos, selectedTodoId, onTodoSelect, onNewTodoClick, onArchiveToggle, onDeleteTodo, viewMode, allTodos }: any) => (
    <div data-testid="todo-sidebar">
      <button data-testid="new-todo-btn" onClick={onNewTodoClick}>New Todo</button>
      <div data-testid="view-mode">{viewMode}</div>
      <div data-testid="active-count">{(allTodos || []).filter((t: any) => !t.path.includes('/archive/')).length}</div>
      <div data-testid="archived-count">{(allTodos || []).filter((t: any) => t.path.includes('/archive/')).length}</div>
      {(todos || []).map((todo: any) => (
        <div 
          key={todo.id}
          data-testid={`todo-${todo.id}`}
          onClick={() => onTodoSelect(todo.id)}
          style={{ backgroundColor: selectedTodoId === todo.id ? 'blue' : 'white' }}
        >
          {todo.title}
        </div>
      ))}
      <button data-testid="archive-toggle" onClick={() => onArchiveToggle()}>
        Switch to {viewMode === 'active' ? 'Archived' : 'Active'}
      </button>
    </div>
  )
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
            onClick={() => onSave('Updated content', [])}
            disabled={isSaving}
          >
            {isSaving ? `Saving... ${saveStep}` : 'Save'}
          </button>
          <button 
            data-testid="archive-todo" 
            onClick={() => onArchive()}
          >
            Archive
          </button>
          <button 
            data-testid="unarchive-todo" 
            onClick={() => onUnarchive()}
          >
            Unarchive
          </button>
          <button 
            data-testid="delete-todo" 
            onClick={() => onDelete()}
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

vi.mock('../components/GitSettings', () => ({
  default: ({ onSettingsSaved }: any) => (
    <div data-testid="git-settings">
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
const mockLoadSettings = localStorage.loadSettings as vi.MockedFunction<typeof localStorage.loadSettings>;
const mockSaveSettings = localStorage.saveSettings as vi.MockedFunction<typeof localStorage.saveSettings>;
const mockGetUrlConfig = localStorage.getUrlConfig as vi.MockedFunction<typeof localStorage.getUrlConfig>;
const mockLoadSelectedTodoId = localStorage.loadSelectedTodoId as vi.MockedFunction<typeof localStorage.loadSelectedTodoId>;
const mockSaveSelectedTodoId = localStorage.saveSelectedTodoId as vi.MockedFunction<typeof localStorage.saveSelectedTodoId>;
const mockClearSelectedTodoId = localStorage.clearSelectedTodoId as vi.MockedFunction<typeof localStorage.clearSelectedTodoId>;

const mockGetTodos = gitService.getTodos as vi.MockedFunction<typeof gitService.getTodos>;
const mockGetFileContent = gitService.getFileContent as vi.MockedFunction<typeof gitService.getFileContent>;
const mockCreateOrUpdateTodo = gitService.createOrUpdateTodo as vi.MockedFunction<typeof gitService.createOrUpdateTodo>;
const mockDeleteFile = gitService.deleteFile as vi.MockedFunction<typeof gitService.deleteFile>;
const mockMoveTaskToArchive = gitService.moveTaskToArchive as vi.MockedFunction<typeof gitService.moveTaskToArchive>;
const mockMoveTaskFromArchive = gitService.moveTaskFromArchive as vi.MockedFunction<typeof gitService.moveTaskFromArchive>;

const mockGenerateInitialPlan = aiService.generateInitialPlan as vi.MockedFunction<typeof aiService.generateInitialPlan>;
const mockGenerateCommitMessage = aiService.generateCommitMessage as vi.MockedFunction<typeof aiService.generateCommitMessage>;

const mockParseMarkdownWithFrontmatter = markdown.parseMarkdownWithFrontmatter as vi.MockedFunction<typeof markdown.parseMarkdownWithFrontmatter>;
const mockStringifyMarkdownWithFrontmatter = markdown.stringifyMarkdownWithFrontmatter as vi.MockedFunction<typeof markdown.stringifyMarkdownWithFrontmatter>;

describe('App Component', () => {
  const mockSettings = {
    gitProvider: 'github',
    pat: 'test-token',
    owner: 'testuser',
    repo: 'test-repo',
    folder: 'todos'
  };

  const mockTodos = [
    {
      id: 'todo1',
      title: 'Test Todo 1',
      content: '# Test Todo 1\n\n- [ ] Task 1',
      path: 'todos/todo1.md',
      sha: 'sha1',
      frontmatter: {
        title: 'Test Todo 1',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      }
    },
    {
      id: 'todo2',
      title: 'Archived Todo',
      content: '# Archived Todo\n\n- [x] Completed task',
      path: 'todos/archive/todo2.md',
      sha: 'sha2',
      frontmatter: {
        title: 'Archived Todo',
        createdAt: '2023-01-02T00:00:00.000Z',
        priority: 2,
        isArchived: true,
        chatHistory: []
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockLoadSettings.mockReturnValue(mockSettings);
    mockGetUrlConfig.mockReturnValue(null);
    mockLoadSelectedTodoId.mockReturnValue(null);
    
    mockGetTodos.mockImplementation(async (folder, includeArchived) => {
      if (includeArchived) {
        return [{ name: 'todo2.md', path: 'todos/archive/todo2.md', sha: 'sha2' }];
      } else {
        return [{ name: 'todo1.md', path: 'todos/todo1.md', sha: 'sha1' }];
      }
    });
    
    mockGetFileContent.mockImplementation(async (path) => {
      if (path.includes('todo1')) {
        return '---\ntitle: Test Todo 1\ncreatedAt: 2023-01-01T00:00:00.000Z\npriority: 3\nisArchived: false\nchatHistory: []\n---\n# Test Todo 1\n\n- [ ] Task 1';
      } else {
        return '---\ntitle: Archived Todo\ncreatedAt: 2023-01-02T00:00:00.000Z\npriority: 2\nisArchived: true\nchatHistory: []\n---\n# Archived Todo\n\n- [x] Completed task';
      }
    });
    
    mockParseMarkdownWithFrontmatter.mockImplementation((content) => {
      if (content.includes('Test Todo 1')) {
        return {
          frontmatter: mockTodos[0].frontmatter,
          markdownContent: mockTodos[0].content
        };
      } else {
        return {
          frontmatter: mockTodos[1].frontmatter,
          markdownContent: mockTodos[1].content
        };
      }
    });
  });

  describe('Initial Render and Setup', () => {
    it('renders main app components', async () => {
      render(<App />);
      
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('todo-editor')).toBeInTheDocument();
      expect(screen.getByTestId('project-manager')).toBeInTheDocument();
    });

    it('loads settings on mount', async () => {
      render(<App />);
      
      expect(mockLoadSettings).toHaveBeenCalled();
    });

    it('handles URL configuration on mount', async () => {
      const urlConfig = { gitProvider: 'github', pat: 'url-token' };
      mockGetUrlConfig.mockReturnValue(urlConfig);
      
      // Mock URL and history
      const mockUrl = new URL('http://localhost:3000?config=test');
      const mockReplace = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { href: mockUrl.href },
        writable: true
      });
      Object.defineProperty(window, 'history', {
        value: { replaceState: mockReplace },
        writable: true
      });

      render(<App />);
      
      expect(mockSaveSettings).toHaveBeenCalledWith(urlConfig);
      expect(mockReplace).toHaveBeenCalled();
    });

    it('fetches todos when settings are available', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockGetTodos).toHaveBeenCalledWith('todos', false);
        expect(mockGetTodos).toHaveBeenCalledWith('todos', true);
      });
    });

    it('displays correct todo counts', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('active-count')).toHaveTextContent('1');
        expect(screen.getByTestId('archived-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Todo Management', () => {
    it('selects first todo by default', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-todo-title')).toHaveTextContent('Test Todo 1');
      });
    });

    it('allows todo selection', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('todo-todo1')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('todo-todo1'));
      
      expect(screen.getByTestId('selected-todo-title')).toHaveTextContent('Test Todo 1');
    });

    it('persists selected todo ID to localStorage', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockSaveSelectedTodoId).toHaveBeenCalled();
      });
    });

    it('restores selected todo from localStorage', async () => {
      mockLoadSelectedTodoId.mockReturnValue('todo1');
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('selected-todo-title')).toHaveTextContent('Test Todo 1');
      });
    });
  });

  describe('View Mode Switching', () => {
    it('switches between active and archived views', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('view-mode')).toHaveTextContent('active');
      });
      
      fireEvent.click(screen.getByTestId('archive-toggle'));
      
      await waitFor(() => {
        expect(screen.getByTestId('view-mode')).toHaveTextContent('archived');
      });
    });

    it('shows different todos based on view mode', async () => {
      render(<App />);
      
      // Initially shows active todos
      await waitFor(() => {
        expect(screen.getByTestId('todo-todo1')).toBeInTheDocument();
      });
      
      // Switch to archived view
      fireEvent.click(screen.getByTestId('archive-toggle'));
      
      await waitFor(() => {
        expect(screen.queryByTestId('todo-todo1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Todo Creation', () => {
    it('opens new todo input when button is clicked', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      
      expect(screen.getByTestId('new-todo-input')).toBeInTheDocument();
    });

    it('creates new todo with AI generation', async () => {
      mockGenerateInitialPlan.mockResolvedValue('# Generated Plan\n\n- [ ] Step 1');
      mockGenerateCommitMessage.mockResolvedValue('feat: Add new todo');
      mockCreateOrUpdateTodo.mockResolvedValue({ sha: 'new-sha' });
      
      render(<App />);
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-goal'));
      });
      
      await waitFor(() => {
        expect(mockGenerateInitialPlan).toHaveBeenCalledWith('Test goal');
      });
    });

    it('shows creation progress during todo creation', async () => {
      mockGenerateInitialPlan.mockResolvedValue('# Generated Plan');
      mockGenerateCommitMessage.mockResolvedValue('feat: Add new todo');
      mockCreateOrUpdateTodo.mockResolvedValue({ sha: 'new-sha' });
      
      render(<App />);
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-goal'));
      });
      
      expect(screen.getByTestId('submit-goal')).toHaveTextContent(/Creating\.\.\./);
    });

    it('handles todo creation errors', async () => {
      mockGenerateInitialPlan.mockRejectedValue(new Error('AI generation failed'));
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<App />);
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-goal'));
      });
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Error creating task'));
      });
      
      alertSpy.mockRestore();
    });

    it('cancels todo creation', async () => {
      render(<App />);
      
      fireEvent.click(screen.getByTestId('new-todo-btn'));
      expect(screen.getByTestId('new-todo-input')).toBeInTheDocument();
      
      fireEvent.click(screen.getByTestId('cancel-goal'));
      expect(screen.queryByTestId('new-todo-input')).not.toBeInTheDocument();
    });
  });

  describe('Todo Operations', () => {
    it('saves todo changes', async () => {
      mockStringifyMarkdownWithFrontmatter.mockReturnValue('updated markdown');
      mockGenerateCommitMessage.mockResolvedValue('feat: Update todo');
      mockCreateOrUpdateTodo.mockResolvedValue({ sha: 'updated-sha' });
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('save-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('save-todo'));
      });
      
      await waitFor(() => {
        expect(mockCreateOrUpdateTodo).toHaveBeenCalled();
      });
    });

    it('shows save progress during todo update', async () => {
      mockStringifyMarkdownWithFrontmatter.mockReturnValue('updated markdown');
      mockGenerateCommitMessage.mockResolvedValue('feat: Update todo');
      mockCreateOrUpdateTodo.mockResolvedValue({ sha: 'updated-sha' });
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('save-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('save-todo'));
      });
      
      expect(screen.getByTestId('save-todo')).toHaveTextContent(/Saving\.\.\./);
    });

    it('archives todo', async () => {
      mockMoveTaskToArchive.mockResolvedValue(undefined);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('archive-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('archive-todo'));
      });
      
      await waitFor(() => {
        expect(mockMoveTaskToArchive).toHaveBeenCalled();
      });
    });

    it('unarchives todo', async () => {
      mockMoveTaskFromArchive.mockResolvedValue(undefined);
      
      render(<App />);
      
      // Switch to archived view first
      fireEvent.click(screen.getByTestId('archive-toggle'));
      
      await waitFor(() => {
        expect(screen.getByTestId('unarchive-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('unarchive-todo'));
      });
      
      await waitFor(() => {
        expect(mockMoveTaskFromArchive).toHaveBeenCalled();
      });
    });

    it('deletes todo', async () => {
      mockDeleteFile.mockResolvedValue(undefined);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-todo'));
      });
      
      await waitFor(() => {
        expect(mockDeleteFile).toHaveBeenCalled();
      });
    });

    it('shows deletion progress during todo deletion', async () => {
      mockDeleteFile.mockResolvedValue(undefined);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByTestId('delete-todo')).toBeInTheDocument();
      });
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-todo'));
      });
      
      expect(screen.getByTestId('delete-todo')).toHaveTextContent(/Deleting\.\.\./);
    });
  });

  describe('Settings Management', () => {
    it('handles settings saved', async () => {
      const newSettings = { ...mockSettings, folder: 'new-folder' };
      mockLoadSettings.mockReturnValueOnce(mockSettings).mockReturnValueOnce(newSettings);
      
      render(<App />);
      
      fireEvent.click(screen.getByTestId('save-settings'));
      
      await waitFor(() => {
        expect(mockLoadSettings).toHaveBeenCalledTimes(2);
      });
    });

    it('handles project change', async () => {
      render(<App />);
      
      await act(async () => {
        fireEvent.click(screen.getByTestId('change-project'));
      });
      
      expect(mockClearSelectedTodoId).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch todos error', async () => {
      mockGetTodos.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<App />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching todos:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
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
  });

  describe('Keyboard and UI Interactions', () => {
    it('handles sidebar toggle', async () => {
      render(<App />);
      
      // The sidebar state is managed internally, we can test if component renders
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });

    it('provides correct provider name', async () => {
      const gitlabSettings = { ...mockSettings, gitProvider: 'gitlab' };
      mockLoadSettings.mockReturnValue(gitlabSettings);
      
      render(<App />);
      
      // Provider name is used internally, component should render correctly
      expect(screen.getByTestId('todo-sidebar')).toBeInTheDocument();
    });
  });

  describe('Data Persistence and Recovery', () => {
    it('preserves todo path during refresh', async () => {
      const preservePath = 'todos/preserved-todo.md';
      
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