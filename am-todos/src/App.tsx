import React, { useState, useEffect, useCallback } from 'react';
import NewTodoInput from './components/NewTodoInput';
import TodoSidebar from './components/TodoSidebar';
import TodoEditor from './components/TodoEditor';
import GitHubSettings from './components/GitHubSettings';
import { loadSettings } from './utils/localStorage';
import { getTodos, getFileContent, createOrUpdateTodo, ensureTodosDirectory } from './services/githubService';
import { generateInitialPlan, generateCommitMessage } from './services/aiService';
import { parseMarkdownWithFrontmatter, stringifyMarkdownWithFrontmatter, TodoFrontmatter } from './utils/markdown';

function App() {
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  

  const [todos, setTodos] = useState<any[]>([]);
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null);
  const [showNewTodoInput, setShowNewTodoInput] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [creationStep, setCreationStep] = useState('');
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [deletionStep, setDeletionStep] = useState('');

  const fetchTodos = useCallback(async () => {
    console.log('Fetching todos...', settings ? 'Settings available' : 'No settings');
    if (!settings) {
      console.log('No settings, skipping fetch');
      return;
    }
    
    try {
      console.log(`Fetching from: ${settings.owner}/${settings.repo}`);
      const githubFiles = await getTodos(settings.pat, settings.owner, settings.repo);
      console.log('GitHub files retrieved:', githubFiles.length, 'files');
      
      if (githubFiles.length === 0) {
        console.log('No todo files found, setting empty todos array');
        setTodos([]);
        setSelectedTodoId(null);
        return;
      }
      
      const fetchedTodos = await Promise.all(
        githubFiles.map(async (file: any) => {
          const content = await getFileContent(settings.pat, settings.owner, settings.repo, file.path);
          const { frontmatter, markdownContent } = parseMarkdownWithFrontmatter(content);
          return {
            id: file.sha, // Using SHA as a unique ID for now
            title: frontmatter?.title || file.name,
            content: markdownContent,
            frontmatter: frontmatter,
            path: file.path,
            sha: file.sha,
          };
        })
      );
      console.log('Todos processed:', fetchedTodos.length);
      setTodos(fetchedTodos);
      
      // Auto-select first todo if none selected or if the previously selected todo no longer exists
      setSelectedTodoId(currentSelectedId => {
        const currentTodoExists = fetchedTodos.some(todo => todo.id === currentSelectedId);
        if (fetchedTodos.length > 0 && (!currentSelectedId || !currentTodoExists)) {
          const firstTodo = fetchedTodos[0];
          console.log('Auto-selected todo:', firstTodo.title);
          return firstTodo.id;
        } else if (fetchedTodos.length === 0) {
          // No todos left, clear selection
          console.log('No todos found, cleared selection');
          return null;
        }
        return currentSelectedId;
      });
    } catch (error) {
      console.error("Error fetching todos:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Only show alert if it's not a simple empty directory issue
      if (!errorMessage.includes('404') && !errorMessage.includes('not found')) {
        alert(`Failed to fetch tasks: ${errorMessage}`);
      } else {
        console.log('Directory not found, treating as empty todos list');
        setTodos([]);
        setSelectedTodoId(null);
      }
    }
  }, [settings]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleSettingsSaved = () => {
    setSettings(loadSettings());
    fetchTodos(); // Fetch todos after settings are saved
  };

  const handleGoalSubmit = async (goal: string) => {
    console.log('Goal submitted:', goal);
    if (!settings) {
      console.error('No settings available for goal submission');
      return;
    }
    
    try {
      setShowNewTodoInput(false);
      setIsCreatingTask(true);
      setCreationStep('Starting...');
      console.log('Starting todo creation process...');
      
      // 1. Generate Initial Plan
      setCreationStep('🤖 Generating task plan with AI...');
      console.log('Generating initial plan...');
      const markdownContent = await generateInitialPlan(goal);
      console.log('Initial plan generated:', markdownContent?.substring(0, 100) + '...');

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
      console.log('Full content prepared, length:', fullContent.length);

      // 3. Generate Commit Message
      setCreationStep('💬 Generating commit message...');
      console.log('Generating commit message...');
      const commitMessage = await generateCommitMessage(`feat: Add new todo for "${goal}"`);
      console.log('Commit message generated:', commitMessage);

      // 4. Ensure todos directory exists and create file with user-friendly name
      setCreationStep('📂 Setting up repository...');
      console.log('Ensuring todos directory exists...');
      await ensureTodosDirectory(settings.pat, settings.owner, settings.repo);
      
      const createSlug = (title: string) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .trim()
          .substring(0, 50); // Limit length
      };
      
      const slug = createSlug(goal);
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `todos/${timestamp}-${slug}.md`;
      
      setCreationStep('💾 Saving to GitHub...');
      console.log('Creating file on GitHub:', filename);
      await createOrUpdateTodo(settings.pat, settings.owner, settings.repo, filename, fullContent, commitMessage);
      console.log('File created successfully on GitHub');

      // 5. Sync State with retry logic
      setCreationStep('🔄 Refreshing task list...');
      console.log('Fetching updated todos...');
      
      // Retry logic to handle GitHub API delays
      let retryCount = 0;
      const maxRetries = 8;
      const retryDelay = 5000; // 5 seconds
      
      const fetchWithRetry = async (): Promise<void> => {
        try {
          const githubFiles = await getTodos(settings.pat, settings.owner, settings.repo);
          console.log(`Retry ${retryCount + 1} - Found ${githubFiles.length} files`);
          
          // Check if the new todo file exists in the response
          const newTodoExists = githubFiles.some(file => 
            file.path === filename || file.name === filename.split('/').pop()
          );
          
          if (!newTodoExists && retryCount < maxRetries) {
            retryCount++;
            console.log(`Retry ${retryCount}/${maxRetries} - Todo not found yet, retrying in ${retryDelay}ms...`);
            setCreationStep(`🔄 Waiting for GitHub (${retryCount}/${maxRetries})...`);
            setTimeout(fetchWithRetry, retryDelay);
          } else if (newTodoExists) {
            console.log('Todo found! Refreshing full todo list...');
            setCreationStep('✅ Task found, refreshing list...');
            await fetchTodos();
            
            // Wait a bit more to ensure the UI updates
            setTimeout(() => {
              setIsCreatingTask(false);
              setCreationStep('');
            }, 500);
          } else {
            console.log('Max retries reached, refreshing anyway...');
            setCreationStep('⚠️ Taking longer than expected...');
            await fetchTodos();
            setTimeout(() => {
              setIsCreatingTask(false);
              setCreationStep('');
            }, 500);
          }
        } catch (error) {
          console.error('Error in retry logic:', error);
          if (retryCount < maxRetries) {
            retryCount++;
            setCreationStep(`❌ Error, retrying (${retryCount}/${maxRetries})...`);
            setTimeout(fetchWithRetry, retryDelay);
          } else {
            console.log('Max retries reached due to errors, stopping...');
            await fetchTodos();
            setIsCreatingTask(false);
            setCreationStep('');
          }
        }
      };
      
      // Initial fetch with delay
      setTimeout(fetchWithRetry, 1000);
    } catch (error) {
      console.error("Error creating new todo:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to create task: ${errorMessage}`);
      setIsCreatingTask(false);
      setCreationStep('');
    }
  };

  const handleTodoUpdate = async (id: string, newContent: string, newChatHistory?: any[]) => {
    if (!settings) return;
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) {
        console.error("Todo not found for update:", id);
        return;
      }

      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        ...(newChatHistory && { chatHistory: newChatHistory })
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, newContent);

      // Generate Commit Message for update
      const commitMessage = await generateCommitMessage(`fix: Update todo "${todoToUpdate.title}"`);

      await createOrUpdateTodo(settings.pat, settings.owner, settings.repo, todoToUpdate.path, fullContent, commitMessage, todoToUpdate.sha);
      fetchTodos(); // Re-fetch to get updated SHA and content
    } catch (error) {
      console.error("Error updating todo:", error);
      // Handle error
    }
  };

  const handlePriorityUpdate = async (id: string, newPriority: number) => {
    if (!settings) return;
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) return;

      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        priority: newPriority
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, todoToUpdate.content);
      const commitMessage = await generateCommitMessage(`feat: Update priority of "${todoToUpdate.title}" to P${newPriority}`);

      await createOrUpdateTodo(settings.pat, settings.owner, settings.repo, todoToUpdate.path, fullContent, commitMessage, todoToUpdate.sha);
      fetchTodos();
    } catch (error) {
      console.error("Error updating priority:", error);
    }
  };

  const handleArchiveToggle = async (id: string) => {
    if (!settings) return;
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);
      if (!todoToUpdate) return;

      const newArchivedState = !todoToUpdate.frontmatter?.isArchived;
      const updatedFrontmatter = {
        ...todoToUpdate.frontmatter,
        isArchived: newArchivedState
      };
      const fullContent = stringifyMarkdownWithFrontmatter(updatedFrontmatter, todoToUpdate.content);
      const commitMessage = await generateCommitMessage(`feat: ${newArchivedState ? 'Archive' : 'Unarchive'} "${todoToUpdate.title}"`);

      await createOrUpdateTodo(settings.pat, settings.owner, settings.repo, todoToUpdate.path, fullContent, commitMessage, todoToUpdate.sha);
      fetchTodos();
    } catch (error) {
      console.error("Error toggling archive:", error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    console.log('Delete button clicked for ID:', id);
    if (!settings) {
      console.error('No settings available');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      console.log('Delete cancelled by user');
      return;
    }
    
    try {
      const todoToDelete = todos.find(todo => todo.id === id);
      if (!todoToDelete) {
        console.error('Todo not found for ID:', id);
        return;
      }

      setIsDeletingTask(true);
      setDeletionStep('🤖 Generating commit message...');
      console.log('Deleting todo:', todoToDelete.path);

      // Generate AI commit message for deletion
      const commitMessage = await generateCommitMessage(`feat: Delete task "${todoToDelete.title}"`);

      setDeletionStep('🗑️ Deleting from GitHub...');
      // GitHub API call to delete file
      const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${todoToDelete.path}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${settings.pat}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: commitMessage,
          sha: todoToDelete.sha,
        }),
      });

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete response error:', errorText);
        throw new Error(`Failed to delete todo: ${response.statusText}`);
      }

      console.log('Todo deleted successfully');

      // If deleted todo was selected, clear selection
      if (selectedTodoId === id) {
        setSelectedTodoId(null);
      }

      setDeletionStep('🔄 Refreshing task list...');
      
      // Check if this is the last todo - if so, we can skip verification
      const remainingTodos = todos.filter(todo => todo.id !== id);
      const isLastTodo = remainingTodos.length === 0;
      
      if (isLastTodo) {
        console.log('This is the last todo - skipping verification and directly updating state');
        setDeletionStep('✅ Last task deleted, clearing list...');
        setTodos([]);
        setSelectedTodoId(null);
        setTimeout(() => {
          setIsDeletingTask(false);
          setDeletionStep('');
        }, 1000);
        return;
      }
      
      // Retry logic to handle GitHub API delays for deletion
      const maxRetries = 8;
      const retryDelay = 3000; // 3 seconds
      let retryCount = 0;
      
      const verifyDeletion = async (): Promise<void> => {
        try {
          const githubFiles = await getTodos(settings.pat, settings.owner, settings.repo);
          console.log(`Delete verification ${retryCount + 1} - Found ${githubFiles.length} files`);
          console.log(`Files in directory:`, githubFiles.map(f => f.name));
          console.log(`Looking for deleted file: ${todoToDelete.path}`);
          
          // Check if the deleted todo file still exists in the response
          const deletedTodoStillExists = githubFiles.some(file => 
            file.path === todoToDelete.path
          );
          
          // Deletion is successful if:
          // 1. File is not found in the list (normal case)
          // 2. Directory is empty (githubFiles.length === 0) - this covers the "last file" scenario
          const deletionSuccessful = !deletedTodoStillExists;
          
          if (!deletionSuccessful && retryCount < maxRetries) {
            retryCount++;
            console.log(`Delete verification ${retryCount}/${maxRetries} - Todo still exists, retrying in ${retryDelay}ms...`);
            setDeletionStep(`🔄 Verifying deletion (${retryCount}/${maxRetries})...`);
            setTimeout(verifyDeletion, retryDelay);
          } else {
            // Deletion successful or max retries reached
            if (deletionSuccessful) {
              console.log('Deletion verified! File no longer found in directory listing.');
              setDeletionStep('✅ Deletion confirmed, refreshing list...');
            } else {
              console.log('Max retries reached, assuming deletion succeeded...');
              setDeletionStep('⚠️ Verification timeout, but deletion likely succeeded...');
            }
            
            try {
              await fetchTodos();
            } catch (fetchError) {
              console.log('Fetch error after deletion verification, assuming empty directory');
              setTodos([]);
              setSelectedTodoId(null);
            }
            
            setTimeout(() => {
              setIsDeletingTask(false);
              setDeletionStep('');
            }, 500);
          }
        } catch (error) {
          console.error('Error in delete verification:', error);
          // If there's an error (like 404 for empty directory), deletion was successful
          console.log('Verification error (likely empty directory), deletion was successful...');
          setDeletionStep('✅ Directory empty, deletion successful...');
          
          // Handle empty directory case - directly update state
          const errorMessage = error instanceof Error ? error.message : '';
          if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            console.log('Empty directory detected, clearing todos');
            setTodos([]);
            setSelectedTodoId(null);
          } else {
            // For other errors, try to fetch normally but catch errors
            try {
              await fetchTodos();
            } catch (fetchError) {
              console.log('Fetch error after deletion, assuming empty directory');
              setTodos([]);
              setSelectedTodoId(null);
            }
          }
          
          setTimeout(() => {
            setIsDeletingTask(false);
            setDeletionStep('');
          }, 500);
        }
      };
      
      // Start verification with delay
      setTimeout(verifyDeletion, 1000);
    } catch (error) {
      console.error("Error deleting todo:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to delete task: ${errorMessage}`);
      setIsDeletingTask(false);
      setDeletionStep('');
    }
  };

  const getProgressWidth = () => {
    if (!creationStep) return '0%';
    if (creationStep.includes('Generating task plan')) return '20%';
    if (creationStep.includes('Preparing task content')) return '40%';
    if (creationStep.includes('Generating commit message')) return '60%';
    if (creationStep.includes('Setting up repository')) return '70%';
    if (creationStep.includes('Saving to GitHub')) return '80%';
    if (creationStep.includes('Refreshing task list')) return '85%';
    if (creationStep.includes('Waiting for GitHub')) return '90%';
    if (creationStep.includes('Task found')) return '95%';
    if (creationStep.includes('Taking longer than expected')) return '95%';
    if (creationStep.includes('Error, retrying')) return '90%';
    return '100%';
  };

  const getDeletionProgressWidth = () => {
    if (!deletionStep) return '0%';
    if (deletionStep.includes('Generating commit message')) return '25%';
    if (deletionStep.includes('Deleting from GitHub')) return '50%';
    if (deletionStep.includes('Refreshing task list')) return '70%';
    if (deletionStep.includes('Verifying deletion')) return '80%';
    if (deletionStep.includes('Deletion confirmed')) return '95%';
    if (deletionStep.includes('Directory empty')) return '95%';
    if (deletionStep.includes('Verification timeout')) return '90%';
    return '100%';
  };

  const selectedTodo = todos.find(todo => todo.id === selectedTodoId) || null;

  if (!settings) {
    return (
      <div className="bg-gray-900 min-h-screen text-white p-4 flex items-center justify-center">
        <GitHubSettings onSettingsSaved={handleSettingsSaved} />
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden mr-3 p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Agentic Markdown Todos</h1>
              <p className="text-gray-400 text-xs md:text-sm hidden sm:block">Your tasks, your repo, your AI assistant.</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTodoInput(true)}
            className="px-3 py-2 md:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm"
          >
            <span className="hidden sm:inline">+ New Task</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex relative">
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative z-30 md:z-auto transition-transform duration-300 ease-in-out`}>
          <TodoSidebar
            todos={todos}
            selectedTodoId={selectedTodoId}
            onTodoSelect={(id) => {
              setSelectedTodoId(id);
              setSidebarOpen(false); // Close sidebar on mobile after selection
            }}
            onNewTodo={() => setShowNewTodoInput(true)}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <TodoEditor
            selectedTodo={selectedTodo}
            onTodoUpdate={handleTodoUpdate}
            onPriorityUpdate={handlePriorityUpdate}
            onArchiveToggle={handleArchiveToggle}
            onDeleteTodo={handleDeleteTodo}
          />
        </div>
      </div>

      {/* New Todo Modal */}
      {showNewTodoInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h2 className="text-lg sm:text-xl font-bold mb-4">Create New Task</h2>
            <NewTodoInput 
              onGoalSubmit={handleGoalSubmit}
              onCancel={() => setShowNewTodoInput(false)}
            />
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
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
    </div>
  );
}

export default App;