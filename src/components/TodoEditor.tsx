import React, { useState } from 'react';
import MarkdownViewer from './MarkdownViewer';
import { formatDate } from '../utils/dateFormat';
import { clearOtherDrafts, clearOtherChatSessions } from '../utils/localStorage';

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

interface TodoEditorProps {
  selectedTodo: Todo | null;
  onTodoUpdate: (id: string, newContent: string, newChatHistory?: ChatMessage[]) => void;
  onTitleUpdate: (id: string, newTitle: string) => void;
  onPriorityUpdate: (id: string, newPriority: number) => void;
  onArchiveToggle: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  token?: string;
  owner?: string;
  repo?: string;
}

const getPriorityLabel = (priority: number): string => {
  switch (priority) {
    case 1: return 'P1 - Critical';
    case 2: return 'P2 - High';
    case 3: return 'P3 - Medium';
    case 4: return 'P4 - Low';
    case 5: return 'P5 - Very Low';
    default: return 'P3 - Medium';
  }
};

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
        console.warn('Failed to clear other drafts/chat sessions:', error);
      }
    }
  }, [selectedTodo?.id]);

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
    setTitleInput(selectedTodo.frontmatter?.title || selectedTodo.title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (titleInput.trim() && titleInput !== selectedTodo.frontmatter?.title) {
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
              <h1 
                className="text-lg sm:text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                onClick={handleTitleEdit}
                title="Click to edit title"
              >
                {selectedTodo.frontmatter?.title || selectedTodo.title}
              </h1>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
            {/* Priority Selector */}
            <select
              value={selectedTodo.frontmatter?.priority || 3}
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
                selectedTodo.frontmatter?.isArchived
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {selectedTodo.frontmatter?.isArchived ? 'Unarchive' : 'Archive'}
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

        {/* Metadata */}
        <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-400 space-y-1 sm:space-y-0 sm:space-x-4">
          <span>Created: {selectedTodo.frontmatter?.createdAt ? 
            formatDate(selectedTodo.frontmatter.createdAt) : 
            'Unknown'
          }</span>
          <span>File: {selectedTodo.path ? selectedTodo.path.split('/').pop() : 'Unknown'}</span>
          <span className="hidden sm:inline">Priority: {getPriorityLabel(selectedTodo.frontmatter?.priority || 3)}</span>
          {selectedTodo.frontmatter?.chatHistory?.length > 0 && (
            <span>Chat: {selectedTodo.frontmatter.chatHistory.length} messages</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-2 sm:p-4 overflow-auto">
        <MarkdownViewer
          content={selectedTodo.content}
          chatHistory={selectedTodo.frontmatter?.chatHistory || []}
          onMarkdownChange={(newContent) => onTodoUpdate(selectedTodo.id, newContent)}
          onChatHistoryChange={(newChatHistory) => onTodoUpdate(selectedTodo.id, selectedTodo.content, newChatHistory)}
          filePath={selectedTodo.path}
          taskId={selectedTodo.id}
          todoId={selectedTodo.id}
        />
      </div>
    </div>
  );
};

export default TodoEditor;