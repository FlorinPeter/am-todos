import React from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Todo {
  id: string;
  title: string;
  content: string;
  frontmatter: {
    title: string;
    createdAt: string;
    priority: number;
    isArchived: boolean;
    chatHistory: ChatMessage[];
  };
  path: string;
  sha: string;
}

interface TodoSidebarProps {
  todos: Todo[];
  selectedTodoId: string | null;
  onTodoSelect: (todoId: string) => void;
  onNewTodo: () => void;
}

const getPriorityLabel = (priority: number): string => {
  switch (priority) {
    case 1: return 'P1';
    case 2: return 'P2';
    case 3: return 'P3';
    case 4: return 'P4';
    case 5: return 'P5';
    default: return 'P3';
  }
};

const getPriorityColor = (priority: number): string => {
  switch (priority) {
    case 1: return 'bg-red-600';
    case 2: return 'bg-orange-600';
    case 3: return 'bg-yellow-600';
    case 4: return 'bg-blue-600';
    case 5: return 'bg-gray-600';
    default: return 'bg-yellow-600';
  }
};

const TodoSidebar: React.FC<TodoSidebarProps> = ({ 
  todos, 
  selectedTodoId, 
  onTodoSelect, 
  onNewTodo 
}) => {
  // Sort todos by priority (1 = highest, 5 = lowest)
  const sortedTodos = [...todos]
    .filter(todo => !todo.frontmatter?.isArchived)
    .sort((a, b) => {
      const priorityA = a.frontmatter?.priority || 3;
      const priorityB = b.frontmatter?.priority || 3;
      return priorityA - priorityB;
    });

  const getCompletionPercentage = (content: string): number => {
    const checkboxes = content.match(/- \[[x ]\]/g) || [];
    if (checkboxes.length === 0) return 0;
    const completed = content.match(/- \[x\]/g) || [];
    return Math.round((completed.length / checkboxes.length) * 100);
  };

  return (
    <div className="w-80 md:w-80 sm:w-72 bg-gray-800 border-r border-gray-700 flex flex-col h-screen md:h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Tasks</h2>
        <button
          onClick={onNewTodo}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto">
        {sortedTodos.length === 0 ? (
          <div className="p-4 text-gray-400 text-center">
            <p>No tasks yet.</p>
            <p className="text-sm mt-2">Click "New Task" to create your first task.</p>
          </div>
        ) : (
          <div className="p-2">
            {sortedTodos.map((todo) => {
              const isSelected = selectedTodoId === todo.id;
              const completion = getCompletionPercentage(todo.content);
              const priority = todo.frontmatter?.priority || 3;
              
              return (
                <div
                  key={todo.id}
                  onClick={() => onTodoSelect(todo.id)}
                  className={`p-3 mb-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {/* Priority and Title */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className={`px-2 py-1 text-xs font-semibold text-white rounded ${getPriorityColor(priority)} mr-2`}>
                        {getPriorityLabel(priority)}
                      </span>
                      <h3 className="font-medium text-sm truncate" title={todo.frontmatter?.title || todo.title}>
                        {todo.frontmatter?.title || todo.title}
                      </h3>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {completion > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{completion}%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${completion}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  <div className="text-xs text-gray-400">
                    {todo.frontmatter?.createdAt ? 
                      new Date(todo.frontmatter.createdAt).toLocaleDateString() :
                      'No date'
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-700 text-sm text-gray-400">
        <div className="flex justify-between">
          <span>Total Tasks:</span>
          <span>{sortedTodos.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Completed:</span>
          <span>
            {sortedTodos.filter(todo => getCompletionPercentage(todo.content) === 100).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TodoSidebar;