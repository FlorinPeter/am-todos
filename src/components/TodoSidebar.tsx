import React from 'react';
import { formatDate } from '../utils/dateFormat';

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
  // Note: No need to filter by isArchived here since App.tsx already filters based on viewMode
  const sortedTodos = [...todos]
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
    <div className="w-full bg-gray-800 border-r border-gray-700 flex flex-col h-full md:shadow-none shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center">
            <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Tasks
          </h2>
          <div className="text-sm text-gray-400 bg-gray-700 px-2 py-1 rounded-full">
            {sortedTodos.length}
          </div>
        </div>
        <button
          onClick={onNewTodo}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-center font-medium shadow-md hover:shadow-lg"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedTodos.length === 0 ? (
          <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
            <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No tasks yet</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-xs">Get started by creating your first task. AI will help you break it down into actionable steps.</p>
            <button
              onClick={onNewTodo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm font-medium">
              Create First Task
            </button>
          </div>
        ) : (
          <div className="p-4">
            {sortedTodos.map((todo) => {
              const isSelected = selectedTodoId === todo.id;
              const completion = getCompletionPercentage(todo.content);
              const priority = todo.frontmatter?.priority || 3;
              
              return (
                <div
                  key={todo.id}
                  onClick={() => onTodoSelect(todo.id)}
                  className={`p-4 mb-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg transform scale-[1.02]' 
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600 border-gray-600 hover:border-gray-500 hover:shadow-md'
                  }`}
                >
                  {/* Priority and Title */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <span className={`px-2.5 py-1.5 text-xs font-bold text-white rounded-md flex-shrink-0 ${getPriorityColor(priority)}`}>
                        {getPriorityLabel(priority)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-tight" title={todo.frontmatter?.title || todo.title}>
                          {todo.frontmatter?.title || todo.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {completion > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                        <span className={isSelected ? 'text-blue-100' : 'text-gray-400'}>Progress</span>
                        <span className={`font-bold ${completion === 100 ? 'text-green-400' : isSelected ? 'text-blue-100' : 'text-gray-300'}`}>
                          {completion}%
                        </span>
                      </div>
                      <div className={`w-full rounded-full h-2.5 ${isSelected ? 'bg-blue-500' : 'bg-gray-600'}`}>
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-300 ${
                            completion === 100 ? 'bg-green-400' : 'bg-green-500'
                          }`}
                          style={{ width: `${completion}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Created Date */}
                  <div className={`text-xs flex items-center space-x-1 ${
                    isSelected ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Created {todo.frontmatter?.createdAt ? 
                      formatDate(todo.frontmatter.createdAt) :
                      'No date'
                    }</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-700 text-sm flex-shrink-0 bg-gray-800">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-white">{sortedTodos.length}</div>
            <div className="text-gray-400 text-xs font-medium">Total Tasks</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-green-400">
              {sortedTodos.filter(todo => getCompletionPercentage(todo.content) === 100).length}
            </div>
            <div className="text-gray-400 text-xs font-medium">Completed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoSidebar;