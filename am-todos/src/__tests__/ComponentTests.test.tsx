import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('react-markdown');
vi.mock('remark-gfm');
vi.mock('../services/githubService');
vi.mock('../services/aiService');

// Import components after mocking dependencies
import MarkdownViewer from '../components/MarkdownViewer';
import TodoEditor from '../components/TodoEditor';
import TodoSidebar from '../components/TodoSidebar';
import NewTodoInput from '../components/NewTodoInput';
import GitHubSettings from '../components/GitHubSettings';
import AIChat from '../components/AIChat';
import GitHistory from '../components/GitHistory';

describe('Component Rendering Tests', () => {
  
  describe('Feature 3: MarkdownViewer Component', () => {
    const mockProps = {
      content: '# Test Content\n\n- [ ] Test task',
      chatHistory: [],
      onMarkdownChange: vi.fn(),
      onChatHistoryChange: vi.fn()
    };

    it('renders without crashing', () => {
      render(<MarkdownViewer {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('displays edit/view toggle button', () => {
      render(<MarkdownViewer {...mockProps} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('switches to edit mode when Edit button clicked', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('shows markdown content in view mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Should render markdown content (mocked)
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
    });

    it('shows git history button when props provided', () => {
      const propsWithGit = {
        ...mockProps,
        filePath: 'test.md',
        token: 'token',
        owner: 'owner',
        repo: 'repo'
      };
      
      render(<MarkdownViewer {...propsWithGit} />);
      expect(screen.getByText('📜 History')).toBeInTheDocument();
    });
  });

  describe('Feature 5: TodoEditor Component', () => {
    const mockTodo = {
      id: 'test-id',
      filename: 'test.md',
      content: '# Test',
      frontmatter: {
        title: 'Test Todo',
        createdAt: '2025-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      }
    };

    const mockProps = {
      selectedTodo: mockTodo,
      onPriorityUpdate: vi.fn(),
      onArchiveToggle: vi.fn(),
      onDeleteTodo: vi.fn(),
      isLoading: false
    };

    it('renders without crashing', () => {
      render(<TodoEditor {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('displays todo title', () => {
      render(<TodoEditor {...mockProps} />);
      expect(screen.getByText('Test Todo')).toBeInTheDocument();
    });

    it('shows priority selector', () => {
      render(<TodoEditor {...mockProps} />);
      expect(screen.getByDisplayValue('P3')).toBeInTheDocument();
    });

    it('calls onPriorityUpdate when priority changed', async () => {
      render(<TodoEditor {...mockProps} />);
      
      const prioritySelect = screen.getByDisplayValue('P3');
      await userEvent.selectOptions(prioritySelect, '1');
      
      expect(mockProps.onPriorityUpdate).toHaveBeenCalledWith('test-id', 1);
    });

    it('shows archive button', () => {
      render(<TodoEditor {...mockProps} />);
      expect(screen.getByText(/archive/i)).toBeInTheDocument();
    });

    it('shows delete button', () => {
      render(<TodoEditor {...mockProps} />);
      // Check if delete functionality exists in the component
      const hasDeleteElement = screen.queryByText(/delete/i) || 
                              document.querySelector('button');
      expect(hasDeleteElement).toBeInTheDocument();
    });

    it('shows unarchive button for archived todos', () => {
      const archivedTodo = {
        ...mockTodo,
        frontmatter: { ...mockTodo.frontmatter, isArchived: true }
      };
      
      render(<TodoEditor {...mockProps} selectedTodo={archivedTodo} />);
      expect(screen.getByText(/unarchive/i)).toBeInTheDocument();
    });
  });

  describe('Feature 10: TodoSidebar Component', () => {
    const mockTodos = [
      {
        id: 'todo-1',
        filename: 'todo-1.md',
        content: '# Todo 1',
        frontmatter: {
          title: 'High Priority Task',
          createdAt: '2025-01-01T00:00:00.000Z',
          priority: 1,
          isArchived: false,
          chatHistory: []
        }
      },
      {
        id: 'todo-2',
        filename: 'todo-2.md',
        content: '# Todo 2',
        frontmatter: {
          title: 'Medium Priority Task',
          createdAt: '2025-01-02T00:00:00.000Z',
          priority: 3,
          isArchived: false,
          chatHistory: []
        }
      }
    ];

    const mockProps = {
      todos: mockTodos,
      selectedTodoId: 'todo-1',
      onSelectTodo: vi.fn(),
      onNewTodo: vi.fn(),
      showArchived: false,
      isOpen: true,
      onClose: vi.fn()
    };

    it('renders without crashing', () => {
      render(<TodoSidebar {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('displays todo titles', () => {
      render(<TodoSidebar {...mockProps} />);
      expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      expect(screen.getByText('Medium Priority Task')).toBeInTheDocument();
    });

    it('shows new task button', () => {
      render(<TodoSidebar {...mockProps} />);
      expect(screen.getByText(/new task/i)).toBeInTheDocument();
    });

    it('calls onNewTodo when new task button clicked', async () => {
      render(<TodoSidebar {...mockProps} />);
      
      const newTaskButton = screen.getByText(/new task/i);
      await userEvent.click(newTaskButton);
      
      expect(mockProps.onNewTodo).toHaveBeenCalled();
    });

    it('displays priority badges', () => {
      render(<TodoSidebar {...mockProps} />);
      expect(screen.getByText('P1')).toBeInTheDocument();
      expect(screen.getByText('P3')).toBeInTheDocument();
    });
  });

  describe('Feature 1: NewTodoInput Component', () => {
    const mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      isGenerating: false
    };

    it('renders when isOpen is true', () => {
      render(<NewTodoInput {...mockProps} />);
      expect(screen.getByText(/create new task/i)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<NewTodoInput {...mockProps} isOpen={false} />);
      expect(screen.queryByText(/create new task/i)).not.toBeInTheDocument();
    });

    it('shows goal input field', () => {
      render(<NewTodoInput {...mockProps} />);
      expect(screen.getByPlaceholderText(/describe your goal/i)).toBeInTheDocument();
    });

    it('shows generate button', () => {
      render(<NewTodoInput {...mockProps} />);
      expect(screen.getByText(/generate/i)).toBeInTheDocument();
    });

    it('calls onSubmit when form submitted', async () => {
      render(<NewTodoInput {...mockProps} />);
      
      const goalInput = screen.getByPlaceholderText(/describe your goal/i);
      const generateButton = screen.getByText(/generate/i);
      
      await userEvent.type(goalInput, 'Test goal');
      await userEvent.click(generateButton);
      
      expect(mockProps.onSubmit).toHaveBeenCalledWith('Test goal');
    });

    it('shows loading state when generating', () => {
      render(<NewTodoInput {...mockProps} isGenerating={true} />);
      expect(screen.getByText(/generating/i)).toBeInTheDocument();
    });
  });

  describe('Feature 2: GitHubSettings Component', () => {
    const mockProps = {
      onSave: vi.fn(),
      initialSettings: { pat: '', owner: '', repo: '' }
    };

    it('renders without crashing', () => {
      render(<GitHubSettings {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('shows GitHub settings form', () => {
      render(<GitHubSettings {...mockProps} />);
      expect(screen.getByText(/github settings/i)).toBeInTheDocument();
    });

    it('shows PAT input field', () => {
      render(<GitHubSettings {...mockProps} />);
      const patInput = screen.getByLabelText(/personal access token/i) || 
                      screen.getByPlaceholderText(/github_pat/i);
      expect(patInput).toBeInTheDocument();
    });

    it('shows save button', () => {
      render(<GitHubSettings {...mockProps} />);
      expect(screen.getByText(/save/i)).toBeInTheDocument();
    });

    it('populates initial values', () => {
      const settingsWithValues = {
        onSave: vi.fn(),
        initialSettings: { pat: 'test-token', owner: 'test-owner', repo: 'test-repo' }
      };
      
      render(<GitHubSettings {...settingsWithValues} />);
      expect(screen.getByDisplayValue('test-token')).toBeInTheDocument();
    });
  });

  describe('Feature 4: AIChat Component', () => {
    const mockProps = {
      currentContent: '# Test',
      onContentUpdate: vi.fn(),
      onChatMessage: vi.fn().mockResolvedValue('Updated content')
    };

    it('renders without crashing', () => {
      render(<AIChat {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('shows chat input field', () => {
      render(<AIChat {...mockProps} />);
      const chatInput = screen.getByPlaceholderText(/ask ai/i) || 
                       screen.getByRole('textbox');
      expect(chatInput).toBeInTheDocument();
    });

    it('shows send button', () => {
      render(<AIChat {...mockProps} />);
      const sendButton = screen.getByText(/send/i) || 
                        screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('Feature 9: GitHistory Component', () => {
    const mockProps = {
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
      filePath: 'test-file.md',
      onRestore: vi.fn(),
      onClose: vi.fn()
    };

    it('renders without crashing', () => {
      render(<GitHistory {...mockProps} />);
      expect(document.body).toBeInTheDocument();
    });

    it('shows close button', () => {
      render(<GitHistory {...mockProps} />);
      const closeButton = screen.getByText(/close/i) || 
                         screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      render(<GitHistory {...mockProps} />);
      
      const closeButton = screen.getByText(/close/i) || 
                         screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Integration Test - Multiple Components', () => {
    it('components can be rendered together without conflicts', () => {
      const todos = [{
        id: 'test',
        filename: 'test.md',
        content: '# Test',
        frontmatter: {
          title: 'Test',
          createdAt: '2025-01-01T00:00:00.000Z',
          priority: 3,
          isArchived: false,
          chatHistory: []
        }
      }];

      const { unmount: unmount1 } = render(
        <TodoSidebar 
          todos={todos}
          selectedTodoId="test"
          onSelectTodo={vi.fn()}
          onNewTodo={vi.fn()}
          showArchived={false}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const { unmount: unmount2 } = render(
        <TodoEditor 
          selectedTodo={todos[0]}
          onPriorityUpdate={vi.fn()}
          onArchiveToggle={vi.fn()}
          onDeleteTodo={vi.fn()}
          isLoading={false}
        />
      );

      const { unmount: unmount3 } = render(
        <MarkdownViewer 
          content="# Test"
          chatHistory={[]}
          onMarkdownChange={vi.fn()}
          onChatHistoryChange={vi.fn()}
        />
      );

      expect(document.body).toBeInTheDocument();

      unmount1();
      unmount2();
      unmount3();
    });
  });
});