import React, { useState, useEffect, useCallback, useRef } from 'react';
import NewTodoInput from './components/NewTodoInput';
import TodoSidebar from './components/TodoSidebar';
import TodoEditor from './components/TodoEditor';
import GitSettings from './components/GitSettings';
import ProjectManager from './components/ProjectManager';
import { loadSettings, getUrlConfig, saveSettings, saveSelectedTodoId, loadSelectedTodoId, clearSelectedTodoId } from './utils/localStorage';
import { getTodos, getFileContent, getFileMetadata, createOrUpdateTodo, ensureDirectory, moveTaskToArchive, moveTaskFromArchive, deleteFile } from './services/gitService';
import { generateInitialPlan, generateCommitMessage } from './services/aiService';
import { searchTodosDebounced, SearchResult } from './services/searchService';
import { parseMarkdownWithFrontmatter, stringifyMarkdownWithFrontmatter, TodoFrontmatter } from './utils/markdown';
import logger from './utils/logger';

function App() {
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    // Check for URL configuration first
    const urlConfig = getUrlConfig();
    if (urlConfig) {
      // Auto-configure from URL and save to localStorage
      saveSettings(urlConfig);
      setSettings(urlConfig);
      // Remove the config parameter from URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('config');
      window.history.replaceState({}, '', url.toString());
    } else {
      setSettings(loadSettings());
    }
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
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [allTodos, setAllTodos] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<'folder' | 'repo'>('folder');
  const currentSearchIdRef = useRef<string>('');

  const getProviderName = () => {
    const provider = settings?.gitProvider || 'github';
    return provider === 'github' ? 'GitHub' : 'GitLab';
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
          setSearchResults([]);
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
    setSearchScope(scope);
    
    // Re-run search with new scope if there's an active query
    if (searchQuery.trim()) {
      // Generate unique search ID to prevent race conditions
      const searchId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      currentSearchIdRef.current = searchId;
      
      // CRITICAL: Immediately clear previous search results to prevent scope bleeding
      setSearchResults([]);
      setIsSearching(true);
      setSearchError(null);
      
      searchTodosDebounced(searchQuery, scope, (results, error) => {
        // Only process results if this search is still current
        if (searchId === currentSearchIdRef.current) {
          setIsSearching(false);
          if (error) {
            setSearchError(error);
            setSearchResults([]);
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
  }, [searchQuery]);

  const fetchTodosWithSettings = useCallback(async (useSettings?: any, useViewMode?: 'active' | 'archived', preserveTodoPath?: string) => {
    const currentSettings = useSettings || settings;
    const currentViewMode = useViewMode || viewMode;
    logger.log('Fetching todos with settings...', currentSettings ? 'Settings available' : 'No settings');
    logger.log('Current folder:', currentSettings?.folder || 'todos');
    
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
      const filteredTodos = currentViewMode === 'archived' 
        ? fetchedTodos.filter((todo: any) => todo.path.includes('/archive/'))
        : fetchedTodos.filter((todo: any) => !todo.path.includes('/archive/'));
      
      logger.log(`Filtered todos for ${currentViewMode} view:`, filteredTodos.length);
      setTodos(filteredTodos);
      
      // Auto-select logic with preserve path support and localStorage persistence
      setSelectedTodoId(currentSelectedId => {
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
          logger.log('Keeping current selection:', filteredTodos.find((todo: any) => todo.id === currentSelectedId)?.title);
          return currentSelectedId;
        }
        
        // If current selection doesn't exist, try to restore from localStorage
        const persistedTodoId = loadSelectedTodoId();
        if (persistedTodoId && filteredTodos.length > 0) {
          const persistedTodo = filteredTodos.find((todo: any) => todo.id === persistedTodoId);
          if (persistedTodo) {
            logger.log('Restored todo from localStorage:', persistedTodo.title);
            return persistedTodoId;
          }
        }
        
        // Finally, fall back to first todo if no selection or persisted todo exists
        if (filteredTodos.length > 0) {
          const firstTodo = filteredTodos[0];
          logger.log('Auto-selected first todo:', firstTodo.title);
          return firstTodo.id;
        }
        
        return null;
      });
      
    } catch (error) {
      logger.error('Error fetching todos:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      setTodos([]);
      setAllTodos([]);
    }
  }, [settings, viewMode]);

  const fetchTodos = useCallback(async (preserveTodoPath?: string) => {
    await fetchTodosWithSettings(undefined, undefined, preserveTodoPath);
  }, [fetchTodosWithSettings]);

  useEffect(() => {
    if (settings) {
      fetchTodos();
    }
  }, [fetchTodos, settings]);

  // Persist selected todo ID to localStorage
  useEffect(() => {
    saveSelectedTodoId(selectedTodoId);
  }, [selectedTodoId]);

  const handleProjectChanged = (newSettings?: any) => {
    const settingsToUse = newSettings || loadSettings();
    setSettings(settingsToUse);
    setSelectedTodoId(null); // Clear selection when switching projects
    clearSelectedTodoId(); // Clear persisted selection since it's a different project
    
    // Fetch todos immediately with the new settings
    fetchTodosWithSettings(settingsToUse);
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
      const commitMessage = await generateCommitMessage(`feat: Add new todo for "${goal}"`);
      logger.log('Commit message generated:', commitMessage);

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

  const handleTodoUpdate = async (id: string, newContent: string, newChatHistory?: any[]) => {
    if (!settings) return;
    
    try {
      setIsSavingTask(true);
      setSaveStep('🔍 Preparing to save...');
      logger.log('App: handleTodoUpdate called with id:', id, 'content length:', newContent.length);
      
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) {
        logger.error("Todo not found for update:", id);
        return;
      }

      setSaveStep('📝 Preparing content...');
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        ...(newChatHistory && { chatHistory: newChatHistory })
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, newContent);
      logger.log('App: Full content prepared, generating commit message...');

      setSaveStep('🤖 Generating commit message...');
      const commitMessage = await generateCommitMessage(`fix: Update todo "${todoToUpdate.title}"`);
      logger.log('App: Commit message generated:', commitMessage);

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
        } catch (saveError) {
          if (saveError instanceof Error && saveError.message.includes('does not match')) {
            retryCount++;
            logger.log(`App: SHA conflict detected, retry ${retryCount}/${maxRetries}`);
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
      
      setSaveStep('🔄 Refreshing task list...');
      await fetchTodos(todoToUpdate.path); // Re-fetch and preserve selection
      
      setSaveStep('✅ Save completed!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
      }, 1000);
      
    } catch (error) {
      logger.error("Error updating todo:", error);
      setSaveStep('❌ Save failed!');
      setTimeout(() => {
        setIsSavingTask(false);
        setSaveStep('');
        alert(`Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }, 1000);
    }
  };

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
                  
                  // Check if this todo is already in our todos array
                  const existingTodo = todos.find(todo => todo.path === searchResult.path);
                  if (existingTodo) {
                    // Todo already exists, just select it
                    setSelectedTodoId(existingTodo.id);
                  } else {
                    // Need to fetch the full todo content
                    const metadata = await getFileMetadata(searchResult.path);
                    const content = await getFileContent(searchResult.path);
                    const frontmatter = parseMarkdownWithFrontmatter(content);
                    
                    // Create a full todo object
                    const fullTodo = {
                      id: metadata.sha,
                      title: frontmatter.title || searchResult.name.replace('.md', ''),
                      content: frontmatter.content,
                      frontmatter: frontmatter.frontmatter,
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