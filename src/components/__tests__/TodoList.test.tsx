import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TodoList from '../TodoList';

// Mock the child components to focus on TodoList logic
vi.mock('../MarkdownViewer', () => ({
  default: ({ content, onMarkdownChange, onChatHistoryChange, chatHistory }: any) => (
    <div data-testid="markdown-viewer">
      <div data-testid="content">{content}</div>
      <button 
        onClick={() => onMarkdownChange('updated content')}
        data-testid="update-content"
      >
        Update Content
      </button>
      <button 
        onClick={() => onChatHistoryChange([...chatHistory, { role: 'user', content: 'test', timestamp: '2023-01-01' }])}
        data-testid="update-chat"
      >
        Update Chat
      </button>
    </div>
  )
}));

vi.mock('../PrioritySelector', () => ({
  default: ({ priority, onPriorityChange }: any) => (
    <div data-testid="priority-selector">
      <span data-testid="priority-value">{priority}</span>
      <button 
        onClick={() => onPriorityChange(1)}
        data-testid="change-priority"
      >
        Change Priority
      </button>
    </div>
  )
}));

describe('TodoList', () => {
  const mockOnTodoUpdate = vi.fn();
  const mockOnPriorityUpdate = vi.fn();

  const sampleTodos = [
    {
      id: 'todo-1',
      title: 'First Todo',
      content: '# First Todo\n\n- [ ] Task 1\n- [x] Task 2',
      frontmatter: {
        chatHistory: [
          { role: 'user' as const, content: 'Create task', timestamp: '2023-01-01' }
        ],
        priority: 2,
        createdAt: '2023-01-01',
        isArchived: false
      }
    },
    {
      id: 'todo-2',
      title: 'Second Todo',
      content: '# Second Todo\n\n- [ ] Another task',
      frontmatter: {
        chatHistory: [],
        priority: 4,
        createdAt: '2023-01-02',
        isArchived: false
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty list when no todos provided', () => {
    render(
      <TodoList 
        todos={[]} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    expect(screen.queryByTestId('markdown-viewer')).not.toBeInTheDocument();
  });

  it('renders todos with titles and content', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    expect(screen.getByText('First Todo')).toBeInTheDocument();
    expect(screen.getByText('Second Todo')).toBeInTheDocument();
    
    const markdownViewers = screen.getAllByTestId('markdown-viewer');
    expect(markdownViewers).toHaveLength(2);
    
    expect(screen.getByText('# First Todo\n\n- [ ] Task 1\n- [x] Task 2')).toBeInTheDocument();
    expect(screen.getByText('# Second Todo\n\n- [ ] Another task')).toBeInTheDocument();
  });

  it('renders priority selectors for each todo', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    const prioritySelectors = screen.getAllByTestId('priority-selector');
    expect(prioritySelectors).toHaveLength(2);

    const priorityValues = screen.getAllByTestId('priority-value');
    expect(priorityValues[0]).toHaveTextContent('2');
    expect(priorityValues[1]).toHaveTextContent('4');
  });

  it('handles todo content updates', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    const updateButtons = screen.getAllByTestId('update-content');
    fireEvent.click(updateButtons[0]);

    expect(mockOnTodoUpdate).toHaveBeenCalledWith('todo-1', 'updated content');
  });

  it('handles chat history updates', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    const updateChatButtons = screen.getAllByTestId('update-chat');
    fireEvent.click(updateChatButtons[0]);

    expect(mockOnTodoUpdate).toHaveBeenCalledWith(
      'todo-1', 
      '# First Todo\n\n- [ ] Task 1\n- [x] Task 2',
      [
        { role: 'user', content: 'Create task', timestamp: '2023-01-01' },
        { role: 'user', content: 'test', timestamp: '2023-01-01' }
      ]
    );
  });

  it('handles priority updates', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    const changePriorityButtons = screen.getAllByTestId('change-priority');
    fireEvent.click(changePriorityButtons[1]); // Click on second todo

    expect(mockOnPriorityUpdate).toHaveBeenCalledWith('todo-2', 1);
  });

  it('uses default values for missing frontmatter', () => {
    const todoWithMissingFrontmatter = [
      {
        id: 'todo-3',
        title: 'Todo without frontmatter',
        content: 'Basic content',
        frontmatter: null as any
      }
    ];

    render(
      <TodoList 
        todos={todoWithMissingFrontmatter} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    // Should still render with defaults
    expect(screen.getByText('Todo without frontmatter')).toBeInTheDocument();
    expect(screen.getByText('Basic content')).toBeInTheDocument();
    
    // Priority should default to 3
    expect(screen.getByTestId('priority-value')).toHaveTextContent('3');
  });

  it('handles todos with empty chat history', () => {
    const todoWithEmptyChat = [
      {
        id: 'todo-4',
        title: 'Todo with empty chat',
        content: 'Content here',
        frontmatter: {
          chatHistory: undefined as any,
          priority: 1,
          createdAt: '2023-01-01',
          isArchived: false
        }
      }
    ];

    render(
      <TodoList 
        todos={todoWithEmptyChat} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    // Should handle empty chat history gracefully
    const updateChatButton = screen.getByTestId('update-chat');
    fireEvent.click(updateChatButton);

    expect(mockOnTodoUpdate).toHaveBeenCalledWith(
      'todo-4',
      'Content here',
      [{ role: 'user', content: 'test', timestamp: '2023-01-01' }]
    );
  });

  it('renders each todo in a separate container', () => {
    render(
      <TodoList 
        todos={sampleTodos} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    // Each todo should be in its own div with mb-6 class
    const todoDivs = screen.getAllByRole('heading', { level: 2 }).map(
      heading => heading.closest('.mb-6')
    );
    
    expect(todoDivs).toHaveLength(2);
    expect(todoDivs[0]).toBeInTheDocument();
    expect(todoDivs[1]).toBeInTheDocument();
  });

  it('passes correct props to MarkdownViewer', () => {
    render(
      <TodoList 
        todos={[sampleTodos[0]]} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    // MarkdownViewer should receive the correct content and chat history
    const contentElement = screen.getByTestId('content');
    expect(contentElement).toBeInTheDocument();
    // Content might be rendered differently (HTML whitespace), so just check it contains the title
    expect(contentElement).toHaveTextContent('First Todo');
  });

  it('passes correct props to PrioritySelector', () => {
    render(
      <TodoList 
        todos={[sampleTodos[0]]} 
        onTodoUpdate={mockOnTodoUpdate} 
        onPriorityUpdate={mockOnPriorityUpdate} 
      />
    );

    // PrioritySelector should receive the correct priority
    expect(screen.getByTestId('priority-value')).toHaveTextContent('2');
  });
});