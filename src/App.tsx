import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewTodoInput from './components/NewTodoInput';
import TodoSidebar from './components/TodoSidebar';
import TodoEditor from './components/TodoEditor';
import GitSettings from './components/GitSettings';
import ProjectManager from './components/ProjectManager';
import { loadSettings, getUrlConfig, saveSettings, saveSelectedTodoId, loadSelectedTodoId, clearSelectedTodoId, clearDraft, saveViewMode, loadViewMode, ViewMode } from './utils/localStorage';
import { getTodos, getFileContent, getFileMetadata, createOrUpdateTodo, ensureDirectory, moveTaskToArchive, moveTaskFromArchive, deleteFile } from './services/gitService';
import { generateInitialPlan, generateCommitMessage } from './services/aiService';
import { searchTodosDebounced, SearchResult } from './services/searchService';
import { parseMarkdownWithFrontmatter, stringifyMarkdownWithFrontmatter } from './utils/markdown';
import { TodoFrontmatter, Todo, ChatMessage } from './types';
import logger from './utils/logger';

function App() {
  const [settings, setSettings] = useState(loadSettings());
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationStep, setInitializationStep] = useState('Loading configuration...');

  useEffect(() => {
    // Enhanced initialization sequence with detailed logging and error handling
    const initializeApp = async () => {
      try {
        logger.log('=== APP INITIALIZATION STARTED ===');
        
        setInitializationStep('Checking URL configuration...');
        logger.log('Step 1: Checking for URL configuration');
        
        // Check for URL configuration first
        let urlConfig = null;
        try {
          urlConfig = getUrlConfig();
        } catch (urlError) {
          logger.error('Error parsing URL configuration:', urlError);
          setInitializationStep('URL configuration error, loading saved settings...');
        }
        
        if (urlConfig) {
          try {
            setInitializationStep('Loading configuration from URL...');
            logger.log('Step 1a: URL configuration found, applying settings');
            
            // Auto-configure from URL and save to localStorage
            saveSettings(urlConfig);
            setSettings(urlConfig);
            
            // Remove the config parameter from URL without page reload
            const url = new URL(window.location.href);
            url.searchParams.delete('config');
            window.history.replaceState({}, '', url.toString());
            
            logger.log('Step 1b: URL configuration applied and URL cleaned');
          } catch (urlApplyError) {
            logger.error('Error applying URL configuration:', urlApplyError);
            setInitializationStep('URL application failed, loading saved settings...');
            // Fallback to localStorage settings
            setSettings(loadSettings());
          }
        } else {
          setInitializationStep('Loading saved configuration...');
          logger.log('Step 1a: No URL configuration, loading from localStorage');
          try {
            setSettings(loadSettings());
          } catch (settingsError) {
            logger.error('Error loading settings from localStorage:', settingsError);
            setInitializationStep('Settings load failed, using defaults...');
            setSettings(null); // Will show setup screen
          }
        }
        
        setInitializationStep('Initializing view mode...');
        logger.log('Step 2: View mode initialization completed via useState');
        
        setInitializationStep('Ready for todo loading...');
        logger.log('Step 3: Initialization sequence completed, ready for todo fetching');
        
        // Brief delay to show initialization status
        setTimeout(() => {
          setIsInitializing(false);
          setInitializationStep('');
          logger.log('=== APP INITIALIZATION COMPLETED ===');
        }, 500);
      } catch (initError) {
        logger.error('Critical error during app initialization:', initError);
        setInitializationStep('Initialization failed, please refresh the page');
        
        // Still complete initialization to prevent infinite loading
        setTimeout(() => {
          setIsInitializing(false);
          setSettings(null); // Show setup screen as fallback
          logger.log('=== APP INITIALIZATION COMPLETED (WITH ERRORS) ===');
        }, 2000);
      }
    };
    
    initializeApp();
  }, []);

  

  const [todos, setTodos] = useState<any[]>([]);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(loadSelectedTodoId());
  const [showNewTodoInput, setShowNewTodoInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [creationStep, setCreationStep] = useState('');
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [deletionStep, setDeletionStep] = useState('');
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [saveStep, setSaveStep] = useState('');
  
  // Track save operations per todo for better UX during StrictMode double-execution
  const [savingTodos, setSavingTodos] = useState<Map<string, { step: string; timestamp: number }>>(new Map());
  // Initialize view mode with error handling for corrupted localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const savedViewMode = loadViewMode();
      logger.log('View mode initialization:', savedViewMode);
      return savedViewMode;
    } catch (error) {
      logger.error('View mode initialization failed, defaulting to active:', error);
      return 'active';
    }
  });
  const [allTodos, setAllTodos] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<'folder' | 'repo'>('folder');
  const currentSearchIdRef = useRef<string>('');
  
  // Save operation guard to prevent duplicate saves
  const activeSaveOperationsRef = useRef<Set<string>>(new Set());
  // Debounce timer for save operations to handle React StrictMode
  const saveDebounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Guard to prevent view mode useEffect from triggering during save operations
  const [isPerformingSave, setIsPerformingSave] = useState(false);

  const getProviderName = () => {
    const provider = settings?.gitProvider || 'github';
    return provider === 'github' ? 'GitHub' : 'GitLab';
  };

  // Helper functions for per-todo save state tracking
  const updateTodoSaveState = (todoId: string, step: string) => {
    setSavingTodos(prev => {
      const newMap = new Map(prev);
      newMap.set(todoId, { step, timestamp: Date.now() });
      return newMap;
    });
  };

  const clearTodoSaveState = (todoId: string) => {
    setSavingTodos(prev => {
      const newMap = new Map(prev);
      newMap.delete(todoId);
      return newMap;
    });
  };

  const isTodoSaving = (todoId: string): boolean => {
    return savingTodos.has(todoId);
  };

  const getTodoSaveStep = (todoId: string): string => {
    return savingTodos.get(todoId)?.step || '';
  };

  const handleSettingsSaved = () => {
    const newSettings = loadSettings();
    setSettings(newSettings);
    setShowSettings(false); // Close the settings modal
    fetchTodos(); // Fetch todos after settings are saved
  };

  // Search handlers
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      currentSearchIdRef.current = '';
      return;
    }

    // Generate unique search ID to prevent race conditions
    const searchId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentSearchIdRef.current = searchId;
    
    // Clear previous results immediately for better UX
    setSearchResults([]);
    setIsSearching(true);

    // Use debounced search
    searchTodosDebounced(query, searchScope, (results, error) => {
      // Only process results if this search is still current
      if (searchId === currentSearchIdRef.current) {
        setIsSearching(false);
        if (error) {
          setSearchError(error);
          // Don't clear search results on error - keep previous results visible
          // setSearchResults([]); // REMOVED - this was causing UX confusion
        } else if (results) {
          setSearchError(null);
          setSearchResults(results.items);
          logger.log('Search completed:', results.total_count, 'results');
        }
      } else {
        logger.log('Ignoring outdated search results for:', query);
      }
    });
  }, [searchScope]);

  const handleSearchScopeChange = useCallback((scope: 'folder' | 'repo') => {
    // Only trigger new search if scope actually changed
    if (scope !== searchScope) {
      setSearchScope(scope);
      
      // Re-run search with new scope if there's an active query
      if (searchQuery.trim()) {
        // Generate unique search ID to prevent race conditions
        const searchId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        currentSearchIdRef.current = searchId;
        
        // Keep old results visible while loading new ones (better UX)
        setIsSearching(true);
        setSearchError(null);
        
        searchTodosDebounced(searchQuery, scope, (results, error) => {
          // Only process results if this search is still current
          if (searchId === currentSearchIdRef.current) {
            setIsSearching(false);
            if (error) {
              setSearchError(error);
              // Don't clear search results on error - keep previous results visible
              // setSearchResults([]); // REMOVED - this was causing UX confusion
            } else if (results) {
              setSearchError(null);
              setSearchResults(results.items);
              logger.log('Scope change search completed:', results.total_count, 'results');
            }
          } else {
            logger.log('Ignoring outdated scope change results for scope:', scope);
          }
        }, 100); // Shorter delay for scope change
      }
    } else {
      // Scope didn't change, just update the state for UI consistency
      setSearchScope(scope);
    }
  }, [searchQuery, searchScope]);

  const fetchTodosWithSettings = useCallback(async (useSettings?: any, useViewMode?: 'active' | 'archived', preserveTodoPath?: string, allowSmartRestore = false) => {
    const currentSettings = useSettings || settings;
    const currentViewMode = useViewMode || viewMode;
    
    if (!currentSettings) {
      logger.log('No settings, skipping fetch');
      return;
    }
    
    try {
      logger.log(`Fetching from: ${currentSettings.gitProvider || 'github'} - ${currentSettings.owner}/${currentSettings.repo} or ${currentSettings.instanceUrl}/${currentSettings.projectId}`);
      logger.log('Current timestamp:', new Date().toISOString());
      
      // Fetch both active and archived todos
      // Handle each request separately to prevent archive folder 404s from failing the entire operation
      const [activeFiles, archivedFiles] = await Promise.all([
        getTodos(currentSettings.folder || 'todos', false).catch((error) => {
          logger.error('Failed to fetch active todos:', error);
          return [];
        }),
        getTodos(currentSettings.folder || 'todos', true).catch((error) => {
          logger.error('Failed to fetch archived todos (archive folder may not exist):', error);
          return [];
        })
      ]);
      
      logger.log('Active files retrieved:', activeFiles.length, 'files');
      logger.log('Archived files retrieved:', archivedFiles.length, 'files');
      
      const allFiles = [...activeFiles, ...archivedFiles];
      logger.log('Total files:', allFiles.length);
      
      if (allFiles.length === 0) {
        logger.log('No todo files found, setting empty arrays');
        setAllTodos([]);
        setTodos([]);
        setSelectedTodoId(null);
        clearSelectedTodoId(); // Clear persisted selection when no todos exist
        return;
      }
      
      const fetchedTodos = await Promise.all(
        allFiles.map(async (file: any) => {
          logger.log('Processing file:', file.name, 'path:', file.path);
          const content = await getFileContent(file.path);
          logger.log('File content length:', content.length);
          const { frontmatter, markdownContent } = parseMarkdownWithFrontmatter(content);
          logger.log('Parsed frontmatter:', frontmatter);
          const todo = {
            id: file.sha, // Using SHA as a unique ID for now
            title: frontmatter?.title || file.name,
            content: markdownContent,
            frontmatter: frontmatter,
            path: file.path,
            sha: file.sha,
          };
          logger.log('Created todo object:', { id: todo.id, title: todo.title, path: todo.path });
          return todo;
        })
      );
      logger.log('All todos processed:', fetchedTodos.length);
      logger.log('Final todos array:', fetchedTodos.map((t: any) => ({ id: t.id, title: t.title, path: t.path })));
      
      // Store all todos and filter based on current view mode
      setAllTodos(fetchedTodos);
      
      logger.log('=== TODO FILTERING LOGIC ===');
      logger.log('Current view mode for filtering:', currentViewMode);
      logger.log('Total fetched todos:', fetchedTodos.length);
      logger.log('Sample todo paths:', fetchedTodos.slice(0, 3).map(t => t.path));
      
      const filteredTodos = currentViewMode === 'archived' 
        ? fetchedTodos.filter((todo: any) => {
            const isArchived = todo.path.includes('/archive/');
            if (isArchived) logger.log('Archived todo found:', todo.path);
            return isArchived;
          })
        : fetchedTodos.filter((todo: any) => {
            const isActive = !todo.path.includes('/archive/');
            if (isActive) logger.log('Active todo found:', todo.path);
            return isActive;
          });
      
      logger.log(`=== FILTERING RESULTS ===`);
      logger.log(`View mode: ${currentViewMode}`);
      logger.log(`Filtered todos count: ${filteredTodos.length}`);
      logger.log('Filtered todo paths:', filteredTodos.map(t => t.path));
      
      setTodos(filteredTodos);
      
      // Auto-select logic with preserve path support and localStorage persistence
      logger.log('=== TODO SELECTION LOGIC ===');
      logger.log('Starting todo selection logic for view mode:', currentViewMode);
      setSelectedTodoId(currentSelectedId => {
        logger.log('Current selected todo ID:', currentSelectedId);
        // If we're trying to preserve a specific todo path, find it first
        if (preserveTodoPath) {
          const preservedTodo = filteredTodos.find((todo: any) => todo.path === preserveTodoPath);
          if (preservedTodo) {
            logger.log('Re-selected preserved todo:', preservedTodo.title);
            return preservedTodo.id;
          }
        }
        
        // Check if current selection still exists in the filtered todos
        const currentTodoExists = filteredTodos.some((todo: any) => todo.id === currentSelectedId);
        if (currentTodoExists) {
          const currentTodo = filteredTodos.find((todo: any) => todo.id === currentSelectedId);
          logger.log('Current todo exists in filtered list - keeping selection:', currentTodo?.title);
          return currentSelectedId;
        } else {
          logger.log('Current todo does not exist in filtered list - need new selection');
        }
        
        // If current selection doesn't exist, try to restore from localStorage with cross-view search
        // Only perform smart restoration when explicitly allowed (during app initialization)
        const persistedTodoId = loadSelectedTodoId();
        if (persistedTodoId && fetchedTodos.length > 0 && allowSmartRestore) {
          try {
            // Search in ALL todos, not just filtered ones, to handle cross-view restoration
            const persistedTodo = fetchedTodos.find((todo: any) => todo.id === persistedTodoId);
            if (persistedTodo) {
              // Validate todo has required properties to prevent errors
              if (!persistedTodo.path || typeof persistedTodo.path !== 'string') {
                logger.error('Smart restoration: Invalid todo path detected', { todoId: persistedTodoId, path: persistedTodo.path });
                clearSelectedTodoId(); // Clear invalid selection
                return null;
              }
              
              // Check if todo is in a different view mode than current
              const isPersistedTodoArchived = persistedTodo.path.includes('/archive/');
              const currentViewIsArchived = currentViewMode === 'archived';
              
              if (isPersistedTodoArchived !== currentViewIsArchived) {
                // Todo is in different view mode - need to switch automatically
                const correctViewMode = isPersistedTodoArchived ? 'archived' : 'active';
                logger.log(`Smart restoration: Switching view mode from ${currentViewMode} to ${correctViewMode} to restore todo:`, persistedTodo.title);
                
                try {
                  // Update view mode state and re-filter todos to match the correct view
                  setViewMode(correctViewMode);
                  const correctFilteredTodos = correctViewMode === 'archived' 
                    ? fetchedTodos.filter((todo: any) => todo.path && todo.path.includes('/archive/'))
                    : fetchedTodos.filter((todo: any) => todo.path && !todo.path.includes('/archive/'));
                  
                  // Validate filtered todos before setting
                  if (correctFilteredTodos.length === 0) {
                    logger.warn(`Smart restoration: No todos found in ${correctViewMode} view after filtering`);
                  }
                  
                  // Update todos to the correct view
                  setTodos(correctFilteredTodos);
                  
                  logger.log('Smart restoration completed: View mode switched and todos updated. Restored todo:', persistedTodo.title);
                  return persistedTodoId;
                } catch (viewSwitchError) {
                  logger.error('Smart restoration: Error during view mode switch', viewSwitchError);
                  // Fallback: stay in current view but don't restore selection
                  return null;
                }
              } else {
                // Todo is in correct view mode, just restore it normally
                logger.log('Restored todo from localStorage (same view):', persistedTodo.title);
                return persistedTodoId;
              }
            } else {
              // Persisted todo not found in fetched todos - it may have been deleted
              logger.log('Smart restoration: Persisted todo not found in current todos, clearing selection', { persistedTodoId });
              clearSelectedTodoId(); // Clean up stale selection
            }
          } catch (restorationError) {
            logger.error('Smart restoration: Error during todo restoration', {
              error: restorationError,
              persistedTodoId,
              fetchedTodosCount: fetchedTodos.length
            });
            // Clear potentially corrupted selection
            clearSelectedTodoId();
          }
        } else if (persistedTodoId && fetchedTodos.length === 0) {
          // Edge case: have persisted ID but no todos loaded
          logger.log('Smart restoration: Persisted todo exists but no todos loaded, keeping selection for next fetch');
        } else if (persistedTodoId && fetchedTodos.length > 0 && !allowSmartRestore) {
          // Smart restoration disabled - only restore if todo is in current view mode
          logger.log('Smart restoration disabled: Checking for todo in current view only');
          const persistedTodo = filteredTodos.find((todo: any) => todo.id === persistedTodoId);
          if (persistedTodo) {
            logger.log('Restored todo from localStorage (current view only):', persistedTodo.title);
            return persistedTodoId;
          } else {
            logger.log('Persisted todo not in current view mode, will not restore to avoid view switching');
          }
        }
        
        // Finally, fall back to first todo if no selection or persisted todo exists
        if (filteredTodos.length > 0) {
          const firstTodo = filteredTodos[0];
          logger.log('Auto-selected first todo:', firstTodo.title);
          logger.log('Final selection result: first todo from filtered list');
          return firstTodo.id;
        }
        
        logger.log('No todos available for selection - returning null');
        return null;
      });
      
      logger.log('=== FETCH TODOS WITH SETTINGS COMPLETED ===');
      logger.log('Final state summary:', {
        allTodosCount: fetchedTodos.length,
        filteredTodosCount: filteredTodos.length,
        viewMode: currentViewMode,
        allowSmartRestore: allowSmartRestore
      });
      
    } catch (error) {
      logger.error('Error fetching todos:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      
      // Enhanced error handling with specific error types
      if (error instanceof Error) {
        if (error.message.includes('Network Error') || error.message.includes('fetch')) {
          logger.error('Network connectivity issue detected during todo fetch');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          logger.error('Authentication issue detected - PAT may be invalid or expired');
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          logger.error('Repository or folder not found - may need to check settings');
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          logger.error('Permission issue detected - PAT may lack required permissions');
        }
      }
      
      // Set empty state but preserve selected todo ID in case of network issues
      setTodos([]);
      setAllTodos([]);
      // Don't clear selectedTodoId here - network issues shouldn't lose user's context
    }
  }, [settings]); // REMOVED viewMode dependency to prevent automatic re-execution

  const fetchTodos = useCallback(async (preserveTodoPath?: string, allowSmartRestore = false, explicitViewMode?: 'active' | 'archived') => {
    await fetchTodosWithSettings(undefined, explicitViewMode, preserveTodoPath, allowSmartRestore);
  }, [fetchTodosWithSettings, viewMode]);

  useEffect(() => {
    // Enhanced todo fetching with initialization awareness - INITIAL LOAD ONLY
    if (settings && !isInitializing) {
      logger.log('=== INITIAL TODO FETCH STARTED ===');
      logger.log('App initialization completed, beginning initial todo fetch with settings:', {
        provider: settings.gitProvider,
        folder: settings.folder,
        viewMode: viewMode
      });
      logger.log('Using smart restoration for initial load to handle cross-view todo restoration');
      fetchTodos(undefined, true); // Enable smart restoration during initial load
    } else if (settings && isInitializing) {
      logger.log('Settings available but initialization still in progress, waiting...');
    } else if (!isInitializing) {
      logger.log('Initialization completed but no settings available, showing setup screen');
    }
  }, [fetchTodos, settings, isInitializing]); // NOTE: viewMode NOT included - initial load only

  // Dedicated useEffect for view mode changes (user-initiated tab switches)
  useEffect(() => {
    // CRITICAL: Don't trigger during save operations to prevent race conditions
    if (isPerformingSave) {
      return;
    }
    
    // Only trigger for user-initiated view mode changes (not during initialization)
    if (settings && !isInitializing) {
      // Fetch todos with the new view mode, but disable smart restoration 
      // since this is a user-initiated change, not a restoration scenario
      fetchTodosWithSettings(settings, viewMode, undefined, false);
    }
  }, [viewMode, settings, isInitializing, isPerformingSave, fetchTodosWithSettings]);

  // Persist selected todo ID to localStorage with error handling
  useEffect(() => {
    try {
      saveSelectedTodoId(selectedTodoId);
      if (selectedTodoId) {
        logger.log('Selected todo ID persisted successfully:', selectedTodoId);
      }
    } catch (error) {
      logger.error('Failed to persist selected todo ID to localStorage:', error);
      // Continue execution - persistence failure shouldn't break the app
    }
  }, [selectedTodoId]);

  // Persist view mode to localStorage with error handling
  useEffect(() => {
    try {
      saveViewMode(viewMode);
      logger.log('View mode persisted successfully:', viewMode);
    } catch (error) {
      logger.error('Failed to persist view mode to localStorage:', error);
      // Continue execution - persistence failure shouldn't break the app
    }
  }, [viewMode]);

  const handleProjectChanged = (newSettings?: any) => {
    const settingsToUse = newSettings || loadSettings();
    setSettings(settingsToUse);
    setSelectedTodoId(null); // Clear selection when switching projects
    clearSelectedTodoId(); // Clear persisted selection since it's a different project
    
    // Fetch todos immediately with the new settings (no smart restoration - this is a user action)
    fetchTodosWithSettings(settingsToUse, undefined, undefined, false);
  };

  const handleGoalSubmit = async (goal: string) => {
    logger.log('Goal submitted:', goal);
    if (!settings) {
      logger.error('No settings available for goal submission');
      return;
    }
    
    try {
      setShowNewTodoInput(false);
      setIsCreatingTask(true);
      setCreationStep('Starting...');
      logger.log('Starting todo creation process...');
      
      // 1. Generate Initial Plan
      setCreationStep('🤖 Generating task plan with AI...');
      logger.log('Generating initial plan...');
      const markdownContent = await generateInitialPlan(goal);
      logger.log('Initial plan generated:', markdownContent?.substring(0, 100) + '...');

      // 2. Prepare File with Frontmatter
      setCreationStep('📝 Preparing task content...');
      const newTodoFrontmatter: TodoFrontmatter = {
        title: goal,
        createdAt: new Date().toISOString(),
        priority: 3,
        isArchived: false,
        chatHistory: [],
      };
      const fullContent = stringifyMarkdownWithFrontmatter(newTodoFrontmatter, markdownContent);
      logger.log('Full content prepared, length:', fullContent.length);

      // 3. Generate Commit Message
      setCreationStep('💬 Generating commit message...');
      logger.log('Generating commit message...');
      const commitResponse = await generateCommitMessage(`feat: Add new todo for "${goal}"`);
      const commitMessage = commitResponse.message;
      logger.log('Commit message generated:', commitMessage);
      if (commitResponse.description) {
        logger.log('Commit generation description:', commitResponse.description);
      }

      // 4. Ensure directory exists and create file with user-friendly name
      setCreationStep(`📂 Setting up ${getProviderName()} repository...`);
      logger.log('Ensuring directory exists...');
      await ensureDirectory(settings.folder || 'todos');
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          .trim()
          .substring(0, 50); // Limit length
      };
      
      const slug = createSlug(goal);
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const folder = settings.folder || 'todos';
      
      // Check for filename conflicts and generate unique filename
      setCreationStep('🔍 Checking for filename conflicts...');
      let filename = `${folder}/${timestamp}-${slug}.md`;
      let finalFilename = filename;
      
      // Check if file already exists and generate unique name if needed
      let counter = 1;
      while (true) {
        try {
          await getFileMetadata(finalFilename);
          // File exists, try next number
          const pathParts = filename.split('.');
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          finalFilename = `${basePath}-${counter}.${extension}`;
          counter++;
          logger.log(`File conflict detected, trying: ${finalFilename}`);
        } catch (error) {
          // File doesn't exist, we can use this filename
          logger.log(`Using filename: ${finalFilename}`);
          break;
        }
      }
      
      setCreationStep(`💾 Saving to ${getProviderName()}...`);
      logger.log('Creating file on Git provider:', finalFilename);
      const createResult = await createOrUpdateTodo(finalFilename, fullContent, commitMessage);
      logger.log('File created successfully on Git provider');

      // 5. Wait for Git provider to process, then refresh
      setCreationStep('🔄 Refreshing task list...');
      logger.log('Refreshing todos list...');
      
      // Wait for Git provider processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchTodos(finalFilename);
      
      // Auto-select the newly created task
      if (createResult?.content?.sha) {
        logger.log('Auto-selecting newly created task with SHA:', createResult.content.sha);
        setSelectedTodoId(createResult.content.sha);
      }
      
      setCreationStep('✅ Task created successfully!');
      setTimeout(() => {
        setIsCreatingTask(false);
        setCreationStep('');
      }, 1000);
    } catch (error) {
      logger.error("Error creating new todo:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create task: ${errorMessage}`);
      setIsCreatingTask(false);
      setCreationStep('');
    }
  };

  // Internal function that performs the actual save operation
  const performTodoUpdate = async (id: string, newContent: string, newChatHistory?: any[], filePath?: string) => {
    if (!settings) return;
    
    // First try to find the todo to get stable identifiers
    let todoToUpdate = todos.find(todo => todo.id === id);
    
    // Fallback: if todo not found by volatile ID, try finding by file path
    if (!todoToUpdate && filePath) {
      todoToUpdate = todos.find(todo => todo.path === filePath);
      if (todoToUpdate) {
        logger.log('App: Todo found by fallback path lookup', { 
          originalId: id, 
          foundId: todoToUpdate.id, 
          path: filePath 
        });
      }
    }
    
    if (!todoToUpdate) {
      logger.error("Todo not found for update:", { 
        id, 
        filePath, 
        availableIds: todos.map(t => t.id),
        availablePaths: todos.map(t => t.path)
      });
      return;
    }
    
    // Use stable file path for save operation guards
    const stablePath = todoToUpdate.path;
    
    // CRITICAL: Prevent double execution using stable path identifier
    if (activeSaveOperationsRef.current.has(stablePath)) {
      logger.log('App: Save operation already in progress - BLOCKED', { 
        id, 
        path: stablePath,
        activeOperations: [...activeSaveOperationsRef.current],
        reason: 'Duplicate execution prevention (using stable path)'
      });
      return;
    }
    
    try {
      // Mark this path as having an active save operation
      activeSaveOperationsRef.current.add(stablePath);
      
      // CRITICAL: Set save operation guard to prevent useEffect interference
      setIsPerformingSave(true);
      
      // Update per-todo save tracking (still use ID for UI state)
      updateTodoSaveState(id, '🔍 Preparing to save...');
      setIsSavingTask(true);
      setSaveStep('🔍 Preparing to save...');

      updateTodoSaveState(id, '📝 Preparing content...');
      setSaveStep('📝 Preparing content...');
      
      // FIXED: Handle content that may already include frontmatter
      // Parse the newContent to check if it already contains frontmatter
      const { frontmatter: parsedFrontmatter, markdownContent } = parseMarkdownWithFrontmatter(newContent);
      
      let fullContent: string;
      if (parsedFrontmatter) {
        // Content already has frontmatter - use it with potential chat history update
        const updatedFrontmatter = {
          ...parsedFrontmatter,
          ...(newChatHistory && { chatHistory: newChatHistory })
        };
        fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, markdownContent);
      } else {
        // Content doesn't have frontmatter - add it from existing todo
        const updatedFrontmatter = {
          ...todoToUpdate.frontmatter,
          ...(newChatHistory && { chatHistory: newChatHistory })
        };
        fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, newContent);
      }
      logger.log('App: Full content prepared, generating commit message...');

      updateTodoSaveState(id, '🤖 Generating commit message...');
      setSaveStep('🤖 Generating commit message...');
      const commitResponse = await generateCommitMessage(`fix: Update todo "${todoToUpdate.title}"`);
      const commitMessage = commitResponse.message;
      logger.log('App: Commit message generated:', commitMessage);
      if (commitResponse.description) {
        logger.log('App: Commit generation description:', commitResponse.description);
      }

      updateTodoSaveState(id, '🔄 Getting latest file version...');
      setSaveStep('🔄 Getting latest file version...');
      logger.log('App: Fetching latest SHA for file...');
      // Get the latest SHA to avoid conflicts
      let latestSha = todoToUpdate.sha;
      try {
        const latestMetadata = await getFileMetadata(todoToUpdate.path);
        latestSha = latestMetadata.sha;
        logger.log('App: Latest SHA retrieved:', latestSha);
      } catch (shaError) {
        logger.log('App: Could not fetch latest SHA, using existing:', latestSha);
      }

      updateTodoSaveState(id, `💾 Saving to ${getProviderName()}...`);
      setSaveStep(`💾 Saving to ${getProviderName()}...`);
      logger.log('App: Calling createOrUpdateTodo with SHA:', latestSha);
      
      // Retry logic for SHA conflicts
      let retryCount = 0;
      const maxRetries = 3;
      let saveSuccessful = false;
      
      while (!saveSuccessful && retryCount < maxRetries) {
        try {
          await createOrUpdateTodo(todoToUpdate.path, fullContent, commitMessage, latestSha);
          saveSuccessful = true;
          logger.log('App: Todo updated successfully');
          
          // Clear draft after successful save to prevent inappropriate restoration
          try {
            clearDraft();
            logger.log('App: Draft cleared after successful save for path:', stablePath);
          } catch (draftError) {
            // Draft clearing failure shouldn't break the save operation
            logger.error('App: Failed to clear draft after save:', draftError);
          }
        } catch (saveError) {
          if (saveError instanceof Error && saveError.message.includes('does not match')) {
            retryCount++;
            logger.log(`App: SHA conflict detected, retry ${retryCount}/${maxRetries}`);
            updateTodoSaveState(id, `🔄 SHA conflict, retrying (${retryCount}/${maxRetries})...`);
            setSaveStep(`🔄 SHA conflict, retrying (${retryCount}/${maxRetries})...`);
            
            if (retryCount < maxRetries) {
              // Fetch the latest SHA again
              try {
                const retryMetadata = await getFileMetadata(todoToUpdate.path);
                latestSha = retryMetadata.sha;
                logger.log('App: Fetched new SHA for retry:', latestSha);
              } catch (retryError) {
                logger.log('App: Could not fetch SHA for retry, giving up');
                throw saveError;
              }
            }
          } else {
            // Non-SHA error, don't retry
            throw saveError;
          }
        }
      }
      
      if (!saveSuccessful) {
        throw new Error('Failed to save after multiple SHA conflict retries');
      }
      
      updateTodoSaveState(id, '🔄 Refreshing task list...');
      setSaveStep('🔄 Refreshing task list...');
      
      // CRITICAL FIX: Explicitly pass current view mode to prevent race conditions
      await fetchTodos(todoToUpdate.path, false, viewMode); // Re-fetch, preserve selection, and preserve view mode
      
      updateTodoSaveState(id, '✅ Save completed!');
      setSaveStep('✅ Save completed!');
      
      // Clear save operation guard
      setIsPerformingSave(false);
      
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
      }, 1000);
      
    } catch (error) {
      logger.error("Error updating todo:", {
        todoId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        activeOperations: [...activeSaveOperationsRef.current],
        timestamp: new Date().toISOString()
      });
      updateTodoSaveState(id, '❌ Save failed!');
      setSaveStep('❌ Save failed!');
      
      // Clear save operation guard even on error
      setIsPerformingSave(false);
      
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
        alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }, 1000);
    } finally {
      // Always remove the path from active operations when done (use stable path)
      if (todoToUpdate) {
        activeSaveOperationsRef.current.delete(todoToUpdate.path);
      }
      // Clear the per-todo save state after a delay to show final status (still use ID for UI)
      setTimeout(() => {
        clearTodoSaveState(id);
      }, 1500);
    }
  };

  // Debounced wrapper to handle React StrictMode double execution
  const handleTodoUpdate = useCallback((id: string, newContent: string, newChatHistory?: any[], filePath?: string) => {
    const timestamp = Date.now();
    
    // First find the todo to get stable path (same pattern as performTodoUpdate)
    let todo = todos.find(t => t.id === id);
    if (!todo && filePath) {
      todo = todos.find(t => t.path === filePath);
    }
    
    if (!todo) {
      logger.error('App: handleTodoUpdate - Todo not found for debouncing', { 
        id, 
        filePath, 
        availableIds: todos.map(t => t.id).slice(0, 3), // First 3 for brevity
        availablePaths: todos.map(t => t.path).slice(0, 3)
      });
      return;
    }
    
    const stablePath = todo.path;
    
    // Clear any existing debounce timer for this stable path
    const existingTimer = saveDebounceTimersRef.current.get(stablePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
      logger.log('App: Cleared existing debounce timer for path:', stablePath, '- preventing duplicate execution');
    }
    
    // Set new debounce timer using stable path (100ms should be enough to prevent React StrictMode double calls)
    const newTimer = setTimeout(() => {
      performTodoUpdate(id, newContent, newChatHistory, stablePath);
      saveDebounceTimersRef.current.delete(stablePath); // Clean up timer reference using stable path
    }, 100);
    
    saveDebounceTimersRef.current.set(stablePath, newTimer);
  }, [todos]);

  const handlePriorityUpdate = async (id: string, newPriority: number) => {
    if (!settings) return;
    try {
      setIsSavingTask(true);
      setSaveStep('🏷️ Updating priority...');
      
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) {
        setIsSavingTask(false);
        setSaveStep('');
        return;
      }

      setSaveStep('🔄 Getting latest file version...');
      // Get the latest SHA to avoid conflicts (same pattern as handleTodoUpdate)
      let latestSha = todoToUpdate.sha;
      try {
        const latestMetadata = await getFileMetadata(todoToUpdate.path);
        latestSha = latestMetadata.sha;
        logger.log('Priority update: Latest SHA retrieved:', latestSha);
      } catch (shaError) {
        logger.log('Priority update: Could not fetch latest SHA, using existing:', latestSha);
      }

      setSaveStep('📝 Preparing content...');
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        priority: newPriority
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, todoToUpdate.content);
      
      // Simple clear commit message without AI generation
      const priorityLabels = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5' };
      const commitMessage = `feat: Update priority to ${priorityLabels[newPriority as keyof typeof priorityLabels]} for "${todoToUpdate.title}"`;

      setSaveStep(`💾 Saving to ${getProviderName()}...`);
      await createOrUpdateTodo(todoToUpdate.path, fullContent, commitMessage, latestSha);
      
      setSaveStep('🔄 Refreshing...');
      await fetchTodos(todoToUpdate.path); // Re-fetch and preserve selection
      
      setSaveStep('✅ Priority updated!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
      }, 1000);
      
    } catch (error) {
      logger.error("Error updating priority:", error);
      setSaveStep('❌ Priority update failed!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
        alert(`Failed to update priority: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }, 1000);
    }
  };

  const handleTitleUpdate = async (id: string, newTitle: string) => {
    if (!settings) return;
    try {
      setIsSavingTask(true);
      setSaveStep('📝 Analyzing changes... (1/6)');
      
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) {
        setIsSavingTask(false);
        setSaveStep('');
        return;
      }

      // Check if title actually changed
      if (todoToUpdate.frontmatter?.title === newTitle) {
        setIsSavingTask(false);
        setSaveStep('');
        return;
      }

      setSaveStep('🔄 Getting latest version... (2/6)');
      // Get the latest SHA to avoid conflicts (same pattern as handleTodoUpdate)
      let latestSha = todoToUpdate.sha;
      try {
        const latestMetadata = await getFileMetadata(todoToUpdate.path);
        latestSha = latestMetadata.sha;
        logger.log('Title update: Latest SHA retrieved:', latestSha);
      } catch (shaError) {
        logger.log('Title update: Could not fetch latest SHA, using existing:', latestSha);
      }

      setSaveStep('📝 Preparing content... (3/6)');
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        title: newTitle
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, todoToUpdate.content);
      
      // Generate new filename based on new title
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          .trim()
          .substring(0, 50); // Limit length
      };
      
      const newSlug = createSlug(newTitle);
      const timestamp = todoToUpdate.path.match(/\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().split('T')[0];
      const folder = settings.folder || 'todos';
      const newPath = `${folder}/${timestamp}-${newSlug}.md`;
      
      const oldPath = todoToUpdate.path;
      const needsRename = oldPath !== newPath;
      
      setSaveStep('🔍 Resolving filename... (4/6)');
      let finalPath = newPath;
      
      // Handle file name conflicts if renaming is needed
      if (needsRename) {
        let counter = 1;
        let conflictFreePath = newPath;
        
        while (true) {
          try {
            await getFileMetadata(conflictFreePath);
            // File exists, try next number
            const pathParts = newPath.split('.');
            const extension = pathParts.pop();
            const basePath = pathParts.join('.');
            conflictFreePath = `${basePath}-${counter}.${extension}`;
            counter++;
          } catch (error) {
            // File doesn't exist, we can use this path
            finalPath = conflictFreePath;
            break;
          }
        }
      }
      
      if (needsRename) {
        setSaveStep('📁 Updating files... (5/6)');
        
        // Create new file with new name
        const commitMessage = `docs: Rename task to "${newTitle}"`;
        await createOrUpdateTodo(finalPath, fullContent, commitMessage);
        
        // Delete old file (combine these steps visually)
        await deleteFile(oldPath, `docs: Remove old file after renaming to "${newTitle}"`);
        
        setSaveStep('🔄 Refreshing list... (6/6)');
        await fetchTodos(finalPath); // Re-fetch and select the new file
      } else {
        // Just update the existing file
        const commitMessage = `docs: Update title to "${newTitle}"`;
        setSaveStep('💾 Saving changes... (5/6)');
        await createOrUpdateTodo(todoToUpdate.path, fullContent, commitMessage, latestSha);
        
        setSaveStep('🔄 Refreshing list... (6/6)');
        await fetchTodos(todoToUpdate.path); // Re-fetch and preserve selection
      }
      
      setSaveStep('✅ Title updated successfully!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
      }, 1000);
      
    } catch (error) {
      logger.error("Error updating title:", error);
      setSaveStep('❌ Title update failed!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
        alert(`Failed to update title: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }, 1000);
    }
  };

  const handleArchiveToggle = async (id: string) => {
    if (!settings) return;
    try {
      setIsSavingTask(true);
      setSaveStep('📦 Processing archive...');
      
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) {
        setIsSavingTask(false);
        setSaveStep('');
        return;
      }

      const isCurrentlyArchived = todoToUpdate.path.includes('/archive/');
      const action = isCurrentlyArchived ? 'Unarchive' : 'Archive';
      
      setSaveStep(`📦 ${action}ing task...`);
      
      // Update frontmatter
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        isArchived: !isCurrentlyArchived
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, todoToUpdate.content);
      const commitMessage = `feat: ${action} "${todoToUpdate.title}"`;

      if (isCurrentlyArchived) {
        // Move from archive to active todos
        await moveTaskFromArchive(todoToUpdate.path, fullContent, commitMessage, settings.folder || 'todos');
      } else {
        // Move from active todos to archive
        await moveTaskToArchive(todoToUpdate.path, fullContent, commitMessage, settings.folder || 'todos');
      }

      setSaveStep('🔄 Refreshing...');
      await fetchTodos();
      
      // Clear selection if we archived the currently selected task and we're in active view
      if (!isCurrentlyArchived && viewMode === 'active' && selectedTodoId === id) {
        setSelectedTodoId(null);
      }
      
      setSaveStep(`✅ ${action}d successfully!`);
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
      }, 1000);
      
    } catch (error) {
      logger.error("Error toggling archive:", error);
      const currentTodo = todos.find(todo => todo.id === id);
      const isArchived = currentTodo?.path.includes('/archive/') || false;
      setSaveStep('❌ Archive operation failed!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
        alert(`Failed to ${isArchived ? 'unarchive' : 'archive'} task: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }, 1000);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    logger.log('Delete button clicked for ID:', id);
    if (!settings) {
      logger.error('No settings available');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      logger.log('Delete cancelled by user');
      return;
    }
    
    try {
      const todoToDelete = todos.find(todo => todo.id === id);
      if (!todoToDelete) {
        logger.error('Todo not found for ID:', id);
        return;
      }

      setIsDeletingTask(true);
      setDeletionStep('🔄 Preparing to delete...');
      logger.log('Deleting todo:', todoToDelete.path);

      setDeletionStep('🗑️ Deleting task...');
      
      // Use the deleteFile service which handles both GitHub and GitLab
      await deleteFile(todoToDelete.path, `Delete ${todoToDelete.title}`);

      logger.log('Todo deleted successfully');

      // If deleted todo was selected, clear selection
      if (selectedTodoId === id) {
        setSelectedTodoId(null);
      }

      setDeletionStep('🔄 Refreshing task list...');
      
      // Wait for processing, then refresh
      setTimeout(async () => {
        try {
          setDeletionStep('✅ Deletion completed, refreshing...');
          await fetchTodos();
          
          setDeletionStep('✅ Task list updated!');
          setTimeout(() => {
            setIsDeletingTask(false);
            setDeletionStep('');
          }, 1000);
        } catch (error) {
          logger.log('Fetch error after deletion - likely empty directory:', error);
          // If fetch fails, it's probably because directory is empty
          setTodos([]);
          setSelectedTodoId(null);
          
          setDeletionStep('✅ Directory cleared!');
          setTimeout(() => {
            setIsDeletingTask(false);
            setDeletionStep('');
          }, 1000);
        }
      }, 2000); // Wait 2 seconds for processing
    } catch (error) {
      logger.error("Error deleting todo:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to delete task: ${errorMessage}`);
      setIsDeletingTask(false);
      setDeletionStep('');
    }
  };


  const getProgressWidth = () => {
    if (!creationStep) return '0%';
    
    // Task creation steps in chronological order with smooth progression
    if (creationStep.includes('Starting')) return '5%';
    if (creationStep.includes('Generating task plan')) return '15%';
    if (creationStep.includes('Preparing task content')) return '30%';
    if (creationStep.includes('Generating commit message')) return '45%';
    if (creationStep.includes('Setting up') && creationStep.includes('repository')) return '60%';
    if (creationStep.includes('Checking for filename conflicts')) return '70%';
    if (creationStep.includes('Saving to GitHub') || creationStep.includes('Saving to GitLab')) return '80%';
    if (creationStep.includes('Refreshing task list')) return '90%';
    if (creationStep.includes('Task created successfully') || creationStep.includes('✅')) return '100%';
    
    // Error and retry states
    if (creationStep.includes('Waiting for GitHub') || creationStep.includes('Waiting for GitLab')) return '85%';
    if (creationStep.includes('Task found')) return '95%';
    if (creationStep.includes('Taking longer than expected')) return '95%';
    if (creationStep.includes('Error, retrying')) return '75%';
    if (creationStep.includes('failed') || creationStep.includes('❌')) return '100%';
    
    return '100%';
  };

  const getDeletionProgressWidth = () => {
    if (!deletionStep) return '0%';
    // Actual deletion steps in chronological order
    if (deletionStep.includes('Getting latest file info')) return '20%';
    if (deletionStep.includes('Deleting task')) return '50%';
    if (deletionStep.includes('Refreshing task list')) return '70%';
    if (deletionStep.includes('Deletion completed')) return '90%';
    if (deletionStep.includes('Task list updated')) return '100%';
    if (deletionStep.includes('Directory cleared')) return '100%';
    return '100%';
  };

  const getSaveProgressWidth = () => {
    if (!saveStep) return '0%';
    
    // New unified title update steps (with proper percentage progression)
    if (saveStep.includes('Analyzing changes') || saveStep.includes('(1/6)')) return '17%';
    if (saveStep.includes('Getting latest version') || saveStep.includes('(2/6)')) return '33%';
    if (saveStep.includes('Preparing content') && saveStep.includes('(3/6)')) return '50%';
    if (saveStep.includes('Resolving filename') || saveStep.includes('(4/6)')) return '67%';
    if (saveStep.includes('Updating files') || saveStep.includes('Saving changes') || saveStep.includes('(5/6)')) return '83%';
    if (saveStep.includes('Refreshing list') || saveStep.includes('(6/6)')) return '90%';
    if (saveStep.includes('Title updated successfully') || saveStep.includes('✅')) return '100%';
    if (saveStep.includes('Title update failed') || saveStep.includes('❌')) return '100%';
    
    // Priority update steps - in chronological order
    if (saveStep.includes('Updating priority')) return '20%';
    if (saveStep.includes('Getting latest file version')) return '40%';
    if (saveStep.includes('Preparing content') && !saveStep.includes('(3/6)')) return '60%';
    if (saveStep.includes('Saving to GitHub') || saveStep.includes('Saving to GitLab')) return '80%';
    if (saveStep.includes('Refreshing') && !saveStep.includes('(6/6)')) return '90%';
    if (saveStep.includes('Priority updated')) return '100%';
    if (saveStep.includes('Priority update failed')) return '100%';
    
    // Regular save steps
    if (saveStep.includes('Preparing to save')) return '20%';
    if (saveStep.includes('Generating commit message')) return '40%';
    if (saveStep.includes('Refreshing task list')) return '90%';
    if (saveStep.includes('Save completed')) return '100%';
    if (saveStep.includes('Save failed')) return '100%';
    
    return '0%';
  };

  const selectedTodo = todos.find(todo => todo.id === selectedTodoId) || null;

  // Show initialization screen while app is starting up
  if (isInitializing) {
    return (
      <div className="bg-gray-900 min-h-screen text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          </div>
          <div className="flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h1 className="text-2xl font-bold text-white">Agentic Markdown Todos</h1>
          </div>
          <p className="text-lg text-gray-300 mb-2">Initializing your task management system...</p>
          <p className="text-sm text-blue-400">{initializationStep}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-gray-900 min-h-screen text-white flex items-center justify-center p-4">
        <div className="w-full max-w-2xl mx-auto">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h1 className="text-3xl font-bold text-white">Agentic Markdown Todos</h1>
            </div>
            <p className="text-lg text-gray-300 mb-2">Welcome to your AI-powered task management system</p>
            <p className="text-sm text-gray-400 max-w-lg mx-auto">
              Set up your Git repository and AI assistant to get started with intelligent task management. 
              Your tasks will be stored as markdown files in your own GitHub or GitLab repository.
            </p>
          </div>

          {/* Setup Form Container */}
          <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Application Setup
              </h2>
              <p className="text-blue-100 text-sm mt-1">Configure your repository and AI assistant</p>
            </div>
            
            <div className="p-6">
              <GitSettings onSettingsSaved={handleSettingsSaved} />
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              Your data stays in your Git repository. We never store or access your personal information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {/* Mobile hamburger menu */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`md:hidden mr-3 p-2 rounded-lg transition-colors ${
                  sidebarOpen 
                    ? 'text-blue-400 bg-blue-900/20' 
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <div>
                <h1 className="text-lg md:text-2xl font-bold">
                  <span className="hidden sm:inline">Agentic Markdown Todos</span>
                  <span className="sm:hidden">AM Todos</span>
                </h1>
                <p className="text-gray-400 text-xs md:text-sm hidden sm:block">Your tasks, your repo, your AI assistant.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Project Manager */}
              <ProjectManager onProjectChanged={handleProjectChanged} />
              
              {/* Mobile Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className="sm:hidden px-2 py-1.5 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors text-sm min-h-[32px] flex items-center justify-center"
                title="Settings"
              >
                ⚙️
              </button>
              
              {/* Settings/Refresh - Desktop Only */}
              <div className="hidden sm:flex items-center space-x-2">
                <button
                  onClick={() => fetchTodos()}
                  className="px-2 py-1.5 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors text-sm min-h-[32px] flex items-center justify-center"
                  title="Refresh"
                >
                  🔄
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-2 py-1.5 bg-gray-600 text-gray-200 rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors text-sm min-h-[32px] flex items-center justify-center"
                  title="Settings"
                >
                  ⚙️
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Archive/Active Tabs */}
        <div className="px-4 pb-3">
          <div className="flex">
            <button
              onClick={() => setViewMode('active')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                viewMode === 'active'
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              📋 Active Tasks ({allTodos.filter(t => !t.path.includes('/archive/')).length})
              {viewMode === 'active' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
            <button
              onClick={() => setViewMode('archived')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                viewMode === 'archived'
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              📦 Archived ({allTodos.filter(t => t.path.includes('/archive/')).length})
              {viewMode === 'archived' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"></div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex">
        {/* Mobile Sidebar Backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-30 md:z-auto transition-all duration-300 ease-in-out w-80 md:w-80 flex-shrink-0 h-full md:h-auto inset-y-0 md:inset-y-0`}>
          <TodoSidebar
            todos={todos}
            selectedTodoId={selectedTodoId}
            onTodoSelect={async (id) => {
              // Check if this is a search result by looking for it in search results
              const searchResult = searchResults.find(result => result.sha === id);
              
              if (searchResult) {
                // This is a search result - need to fetch the full todo content
                try {
                  logger.log('Loading search result todo:', searchResult.path);
                  
                  // Check if this todo is from a different project and offer to switch context
                  const todoPath = searchResult.path;
                  const pathParts = todoPath.split('/');
                  const todoFolder = pathParts.length > 1 ? pathParts[0] : (settings?.folder || 'todos');
                  const currentFolder = settings?.folder || 'todos';
                  
                  if (todoFolder !== currentFolder && pathParts.length > 1) {
                    const switchProject = window.confirm(
                      `This todo is from '${todoFolder}' project.\n\n` +
                      `Switch to '${todoFolder}' project to see related todos?\n\n` +
                      `Current: ${currentFolder} → Switch to: ${todoFolder}`
                    );
                    
                    if (switchProject) {
                      logger.log('Switching project context:', { from: currentFolder, to: todoFolder });
                      
                      // Update settings to new project
                      const newSettings = { ...settings, folder: todoFolder };
                      saveSettings(newSettings);
                      setSettings(newSettings);
                      
                      // Reload todos from new project context using explicit settings
                      // This avoids React state batching issues where fetchTodos() uses old settings
                      // Use preserveTodoPath to maintain selection after refresh
                      logger.log('Refreshing todos with new project context:', todoFolder);
                      await fetchTodosWithSettings(newSettings, viewMode, searchResult.path, false);
                      
                      // Clear search results since we're in new project context
                      setSearchResults([]);
                      setSearchQuery('');
                      setIsSearching(false);
                      setSearchError(null);
                      
                      logger.log('Project context switch completed');
                      
                      // Exit early - the preserveTodoPath should have handled selection
                      return;
                    } else {
                      // User declined to switch projects, continue with normal loading
                      logger.log('User declined project switch, loading cross-folder todo in current context');
                    }
                  }
                  
                  // Check if this todo is already in our todos array
                  const existingTodo = todos.find(todo => todo.path === searchResult.path);
                  if (existingTodo) {
                    // Todo already exists, just select it
                    setSelectedTodoId(existingTodo.id);
                  } else {
                    // Need to fetch the full todo content
                    logger.log('Loading cross-folder todo:', searchResult.path);
                    
                    const metadata = await getFileMetadata(searchResult.path);
                    const content = await getFileContent(searchResult.path);
                    const parsedMarkdown = parseMarkdownWithFrontmatter(content);
                    
                    // Create a full todo object with correct frontmatter access
                    const fullTodo = {
                      id: metadata.sha,
                      title: parsedMarkdown.frontmatter?.title || searchResult.name.replace('.md', ''),
                      content: parsedMarkdown.markdownContent,
                      frontmatter: parsedMarkdown.frontmatter,
                      path: searchResult.path,
                      sha: metadata.sha
                    };
                    
                    // Add to todos array and select it
                    setTodos(prev => [...prev, fullTodo]);
                    setSelectedTodoId(fullTodo.id);
                  }
                } catch (error) {
                  logger.error('Error loading search result todo:', error);
                  alert('Failed to load selected todo: ' + (error instanceof Error ? error.message : 'Unknown error'));
                }
              } else {
                // Regular todo selection
                setSelectedTodoId(id);
              }
              
              setSidebarOpen(false); // Close sidebar on mobile after selection
            }}
            onNewTodo={() => setShowNewTodoInput(true)}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            searchResults={searchResults}
            isSearching={isSearching}
            searchError={searchError}
            searchScope={searchScope}
            onSearchScopeChange={handleSearchScopeChange}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col bg-gray-900 overflow-hidden">
          <TodoEditor
            selectedTodo={selectedTodo}
            onTodoUpdate={handleTodoUpdate}
            onTitleUpdate={handleTitleUpdate}
            onPriorityUpdate={handlePriorityUpdate}
            onArchiveToggle={handleArchiveToggle}
            onDeleteTodo={handleDeleteTodo}
            token={settings?.pat}
            owner={settings?.owner}
            repo={settings?.repo}
          />
        </div>
      </div>

      {/* New Todo Modal */}
      {showNewTodoInput && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Create New Task</h2>
            <NewTodoInput 
              onGoalSubmit={handleGoalSubmit}
              onCancel={() => setShowNewTodoInput(false)}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors min-h-[32px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <GitSettings onSettingsSaved={handleSettingsSaved} />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Creating Task...</h3>
            <p className="text-gray-300 text-sm">{creationStep}</p>
            <div className="mt-4 bg-gray-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                   style={{ width: getProgressWidth() }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Loading Overlay */}
      {isDeletingTask && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Deleting Task...</h3>
            <p className="text-gray-300 text-sm">{deletionStep}</p>
            <div className="mt-4 bg-gray-700 rounded-full h-2">
              <div className="bg-red-500 h-2 rounded-full transition-all duration-500" 
                   style={{ width: getDeletionProgressWidth() }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Save Loading Overlay */}
      {isSavingTask && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 text-center">
            <div className="mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Saving Task...</h3>
            <p className="text-gray-300 text-sm">{saveStep}</p>
            <div className="mt-4 bg-gray-700 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                   style={{ width: getSaveProgressWidth() }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;