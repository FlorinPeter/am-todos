import React, { useState } from 'react';
import MarkdownViewer from './MarkdownViewer';
import { formatDate } from '../utils/dateFormat';
import { clearOtherDrafts, clearOtherChatSessions } from '../utils/localStorage';
import { Todo } from '../types';

interface TodoEditorProps {
  selectedTodo: Todo | null;
  onTodoUpdate: (id: string, newContent: string, filePath?: string) => void;
  onTitleUpdate: (id: string, newTitle: string) => void;
  onPriorityUpdate: (id: string, newPriority: number) => void;
  onArchiveToggle: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  token?: string;
  owner?: string;
  repo?: string;
}


const TodoEditor: React.FC<TodoEditorProps> = ({ 
  selectedTodo, 
  onTodoUpdate, 
  onTitleUpdate,
  onPriorityUpdate, 
  onArchiveToggle,
  onDeleteTodo,
  token,
  owner,
  repo
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  // Clear drafts and chat sessions for other todos when selectedTodo changes
  React.useEffect(() => {
    if (selectedTodo) {
      try {
        clearOtherDrafts(selectedTodo.id);
        clearOtherChatSessions(selectedTodo.id);
      } catch (error) {
        // Silently handle localStorage errors - cleanup is not critical
      }
    }
  }, [selectedTodo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedTodo) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">No Task Selected</h3>
          <p>Select a task from the sidebar to view and edit it</p>
        </div>
      </div>
    );
  }

  const handleTitleEdit = () => {
    setTitleInput(selectedTodo.title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (titleInput.trim() && titleInput !== selectedTodo.title) {
      onTitleUpdate(selectedTodo.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3">
          {/* Title */}
          <div className="flex-1 mb-3 sm:mb-0 sm:mr-4">
            {isEditingTitle ? (
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyPress}
                className="text-lg sm:text-xl font-bold bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                autoFocus
              />
            ) : (
              <div>
                <h1 
                  className="text-lg sm:text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                  onClick={handleTitleEdit}
                  title="Click to edit title"
                >
                  {selectedTodo.title}
                </h1>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedTodo.path ? selectedTodo.path.split('/').pop() : 'Unknown'} • Created: {selectedTodo.createdAt ? 
                    formatDate(selectedTodo.createdAt) : 
                    'Unknown'
                  }
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
            {/* Priority Selector */}
            <select
              value={selectedTodo.priority || 3}
              onChange={(e) => onPriorityUpdate(selectedTodo.id, parseInt(e.target.value))}
              className="bg-gray-700 text-white px-2 py-1 text-sm rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>P1</option>
              <option value={2}>P2</option>
              <option value={3}>P3</option>
              <option value={4}>P4</option>
              <option value={5}>P5</option>
            </select>


            {/* Archive Toggle */}
            <button
              onClick={() => onArchiveToggle(selectedTodo.id)}
              className={`px-2 py-1 rounded text-xs sm:text-sm font-medium transition-colors ${
                selectedTodo.isArchived
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {selectedTodo.isArchived ? 'Unarchive' : 'Archive'}
            </button>

            {/* Delete Button */}
            <button
              onClick={() => onDeleteTodo(selectedTodo.id)}
              className="px-2 py-1 bg-red-600 text-white rounded text-xs sm:text-sm font-medium hover:bg-red-700 transition-colors"
              title="Delete task"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 sm:p-4 overflow-auto">
        <MarkdownViewer
          content={selectedTodo.content}
          frontmatter={selectedTodo.frontmatter}
          chatHistory={[]}
          onMarkdownChange={(newContent) => onTodoUpdate(selectedTodo.id, newContent, selectedTodo.path)}
          onChatHistoryChange={() => {}}
          filePath={selectedTodo.path}
          taskId={selectedTodo.id}
          todoId={selectedTodo.id}
        />
      </div>
    </div>
  );
};

export default TodoEditor;