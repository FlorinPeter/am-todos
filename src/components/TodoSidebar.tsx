import React, { useState, useCallback, useEffect, useRef } from 'react';
import { formatDate } from '../utils/dateFormat';
import { searchTodosDebounced, filterTodosLocally, SearchResult } from '../services/searchService';

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
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchResults?: SearchResult[];
  isSearching?: boolean;
  searchError?: string | null;
  searchScope?: 'folder' | 'repo';
  onSearchScopeChange?: (scope: 'folder' | 'repo') => void;
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
  onNewTodo,
  searchQuery = '',
  onSearchQueryChange,
  searchResults = [],
  isSearching = false,
  searchError = null,
  searchScope = 'folder',
  onSearchScopeChange
}) => {
  // Handle search functionality
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Update local search when prop changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F to focus search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      
      // Escape to clear search if search input is focused
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        event.preventDefault();
        handleSearchClear();
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setLocalSearchQuery(query);
    onSearchQueryChange?.(query);
  }, [onSearchQueryChange]);

  const handleSearchClear = useCallback(() => {
    setLocalSearchQuery('');
    onSearchQueryChange?.('');
  }, [onSearchQueryChange]);

  // Determine which todos to display
  let displayTodos = todos;
  
  // If there's a search query, use API search results consistently for both scopes
  if (localSearchQuery.trim()) {
    if (searchResults.length > 0) {
      // Use search results from API - this handles BOTH "This Folder" and "Entire Repo"
      displayTodos = searchResults.map((result, index) => {
        // Backend now normalizes GitHub/GitLab responses to consistent format
        // Both providers now return: { path, name, sha, url, repository, text_matches, priority }
        const normalizedResult = {
          path: result.path || '',
          name: result.name || 'unknown.md',
          sha: result.sha || 'unknown',
          priority: result.priority || 3
        };
        
        // Extract folder path (everything except filename) for project name display
        // This logic works identically for both GitHub and GitLab since both use same path format
        const pathParts = normalizedResult.path ? normalizedResult.path.split('/') : [];
        const projectName = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'root';
        
        // Create unique ID from path since sha/ref might vary between providers
        // Use SHA/ref if available and unique, otherwise fall back to timestamp-based ID
        const isTestEnv = process.env.NODE_ENV === 'test' || typeof window === 'undefined';
        const uniqueId = isTestEnv && normalizedResult.sha !== 'main' && normalizedResult.sha !== 'unknown'
          ? normalizedResult.sha 
          : `search-${normalizedResult.path.replace(/[\/\s]/g, '-')}-${Date.now()}-${index}`;
        
        // Clean filename for display (remove .md extension)
        const cleanTitle = normalizedResult.name.replace(/\.md$/, '');
        
        return {
          id: uniqueId,
          title: cleanTitle,
          content: '', // We don't have content in search results
          frontmatter: {
            title: cleanTitle,
            createdAt: new Date().toISOString(), // Placeholder - consistent for both providers
            priority: normalizedResult.priority,
            isArchived: false,
            chatHistory: []
          },
          path: normalizedResult.path,
          sha: normalizedResult.sha,
          isSearchResult: true,
          projectName: projectName // Always shows folder path consistently for both providers
        };
      });
    } else if (isSearching) {
      // Show loading state while API search is in progress
      displayTodos = [];
    } else {
      // No API results - fall back to local filtering for tests and offline functionality
      displayTodos = filterTodosLocally(todos, localSearchQuery);
    }
  }

  // Sort todos by priority (1 = highest, 5 = lowest)
  const sortedTodos = [...displayTodos]
    .sort((a, b) => {
      const priorityA = a.frontmatter?.priority || 3;
      const priorityB = b.frontmatter?.priority || 3;
      return priorityA - priorityB;
    });

  // Search debug logging removed

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
            {localSearchQuery.trim() ? `${sortedTodos.length} found` : sortedTodos.length}
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative mb-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks... (Ctrl/Cmd+F)"
              value={localSearchQuery}
              onChange={handleSearchChange}
              className="w-full bg-gray-700 text-white placeholder-gray-400 rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-gray-600 transition-colors"
            />
            {isSearching ? (
              <div className="absolute left-3 top-2.5 w-4 h-4">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-blue-500"></div>
              </div>
            ) : (
              <svg 
                className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {localSearchQuery && (
              <button
                onClick={handleSearchClear}
                className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 hover:text-white transition-colors"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Search Scope Toggle */}
          {localSearchQuery.trim() && onSearchScopeChange && (
            <div className="flex items-center justify-center mt-2 space-x-2 text-xs">
              <button
                onClick={() => onSearchScopeChange('folder')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  searchScope === 'folder'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                This Folder
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => onSearchScopeChange('repo')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  searchScope === 'repo'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Entire Repo
              </button>
            </div>
          )}
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

      {/* Search Error Banner (shows even with results) */}
      {localSearchQuery.trim() && searchError && (
        <div className="mx-4 mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-red-400 mb-1">Search Error</h4>
              <p className="text-xs text-gray-300 mb-2">
                {searchError}
              </p>
              {searchError.includes('rate limit') && (
                <p className="text-xs text-yellow-400 mb-2">
                  💡 Tip: Try searching less frequently or use more specific terms to avoid rate limits.
                </p>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={handleSearchClear}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors">
                  Clear Search
                </button>
                <button
                  onClick={() => {
                    // Retry the same search
                    if (onSearchQueryChange) {
                      const currentQuery = localSearchQuery;
                      handleSearchClear();
                      setTimeout(() => onSearchQueryChange(currentQuery), 100);
                    }
                  }}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Todo List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {sortedTodos.length === 0 ? (
          <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
            {localSearchQuery.trim() ? (
              // Search empty state - simplified since error banner handles errors
              <>
                <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">No results found</h3>
                <p className="text-sm text-gray-400 mb-4 max-w-xs">
                  No tasks found for "{localSearchQuery}"{searchScope === 'repo' ? ' in entire repository' : ' in this folder'}. Try a different search term.
                </p>
                <button
                  onClick={handleSearchClear}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm font-medium">
                  Clear Search
                </button>
              </>
            ) : (
              // Regular empty state
              <>
                <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">No tasks yet</h3>
                <p className="text-sm text-gray-400 max-w-xs">Get started by creating your first task using the "New Task" button above. AI will help you break it down into actionable steps.</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-4">
            {sortedTodos.map((todo) => {
              const isSelected = selectedTodoId === todo.id;
              const completion = getCompletionPercentage(todo.content);
              const priority = todo.frontmatter?.priority || 3;
              const isSearchResult = todo.isSearchResult || false; // Use consistent flag from todo object
              const shouldShowPath = isSearchResult && todo.path; // Show path for all search results
              
              return (
                <div
                  key={todo.id}
                  onClick={() => onTodoSelect(todo.id)}
                  className={`p-4 mb-3 rounded-xl cursor-pointer transition-all duration-200 border relative ${
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
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-sm leading-tight flex-1" title={todo.frontmatter?.title || todo.title}>
                            {todo.frontmatter?.title || todo.title}
                          </h3>
                        </div>
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

                  {/* Project Name (for repo-wide search) or Created Date */}
                  <div className={`text-xs flex items-center space-x-1 ${
                    isSelected ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {todo.isSearchResult && todo.projectName ? (
                      // Show project name for all search results (both folder and repo-wide)
                      <>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span 
                          className="truncate max-w-24"
                          title={`Project: ${todo.projectName}`}
                        >
                          {todo.projectName}
                        </span>
                      </>
                    ) : (
                      // Show created date for normal (non-search) views
                      <>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Created {todo.frontmatter?.createdAt ? 
                          formatDate(todo.frontmatter.createdAt) :
                          'No date'
                        }</span>
                      </>
                    )}
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