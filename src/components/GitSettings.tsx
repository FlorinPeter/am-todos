import React, { useState, useEffect, useCallback } from 'react';
import { saveSettings, loadSettings } from '../utils/localStorage';
import { listProjectFolders, createProjectFolder } from '../services/gitService';
import SettingsSharing from './SettingsSharing';
import VersionInfo from './VersionInfo';
import logger from '../utils/logger';

interface GitSettingsProps {
  onSettingsSaved: () => void;
}

const GitSettings: React.FC<GitSettingsProps> = ({ onSettingsSaved }) => {
  // Git Provider settings
  const [gitProvider, setGitProvider] = useState<'github' | 'gitlab'>('github');
  
  // GitHub-specific settings
  const [pat, setPat] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  
  // GitLab-specific settings
  const [instanceUrl, setInstanceUrl] = useState('https://gitlab.com');
  const [projectId, setProjectId] = useState('');
  const [token, setToken] = useState('');
  
  // Common settings
  const [folder, setFolder] = useState('todos');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [availableFolders, setAvailableFolders] = useState<string[]>(['todos']);
  
  // AI Provider settings
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [showSettingsSharing, setShowSettingsSharing] = useState(false);

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setGitProvider(savedSettings.gitProvider || 'github');
      
      // Load GitHub settings from new structure
      if (savedSettings.github) {
        setPat(savedSettings.github.pat || '');
        setOwner(savedSettings.github.owner || '');
        setRepo(savedSettings.github.repo || '');
      } else {
        // Fallback to legacy direct fields (migration will handle this)
        setPat(savedSettings.pat || '');
        setOwner(savedSettings.owner || '');
        setRepo(savedSettings.repo || '');
      }
      
      // Load GitLab settings from new structure
      if (savedSettings.gitlab) {
        setInstanceUrl(savedSettings.gitlab.instanceUrl || 'https://gitlab.com');
        setProjectId(savedSettings.gitlab.projectId || '');
        setToken(savedSettings.gitlab.token || '');
      } else {
        // Fallback to legacy direct fields (migration will handle this)
        setInstanceUrl(savedSettings.instanceUrl || 'https://gitlab.com');
        setProjectId(savedSettings.projectId || '');
        setToken(savedSettings.token || '');
      }
      
      // Common settings
      setFolder(savedSettings.folder || 'todos');
      setGeminiApiKey(savedSettings.geminiApiKey || '');
      setAiProvider(savedSettings.aiProvider || 'gemini');
      setOpenRouterApiKey(savedSettings.openRouterApiKey || '');
      setAiModel(savedSettings.aiModel || '');
    }
  }, []);

  // Helper function to build dual-configuration settings
  const buildProviderSpecificSettings = () => {
    const savedSettings = loadSettings();
    
    return {
      gitProvider,
      folder, 
      geminiApiKey, 
      aiProvider, 
      openRouterApiKey, 
      aiModel,
      // Preserve both provider configurations
      github: {
        pat,
        owner,
        repo,
        branch: savedSettings?.github?.branch || 'main'
      },
      gitlab: {
        instanceUrl,
        projectId,
        token,
        branch: savedSettings?.gitlab?.branch || 'main'
      }
    };
  };

  const loadFolders = useCallback(async () => {
    // Check if we have the required settings for the selected provider
    if (gitProvider === 'github' && (!pat || !owner || !repo)) return;
    if (gitProvider === 'gitlab' && (!instanceUrl || !projectId || !token)) return;
    
    setIsLoadingFolders(true);
    try {
      // Save current form state temporarily so gitService can read it
      const currentSettings = buildProviderSpecificSettings();
      saveSettings(currentSettings);
      
      const folders = await listProjectFolders();
      setAvailableFolders(folders);
    } catch (error) {
      logger.error('Failed to load folders:', error);
      setAvailableFolders(['todos']); // Fallback
    } finally {
      setIsLoadingFolders(false);
    }
  }, [gitProvider, pat, owner, repo, instanceUrl, projectId, token, buildProviderSpecificSettings]);

  // Load folders when credentials are available
  useEffect(() => {
    if (gitProvider === 'github' && pat && owner && repo) {
      loadFolders();
    } else if (gitProvider === 'gitlab' && instanceUrl && projectId && token) {
      loadFolders();
    }
  }, [gitProvider, pat, owner, repo, instanceUrl, projectId, token, loadFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    // Check if we have the required settings for the selected provider
    if (gitProvider === 'github' && (!pat || !owner || !repo)) return;
    if (gitProvider === 'gitlab' && (!instanceUrl || !projectId || !token)) return;
    
    setIsCreatingFolder(true);
    try {
      // Save current form state temporarily so gitService can read it
      const currentSettings = buildProviderSpecificSettings();
      saveSettings(currentSettings);
      
      await createProjectFolder(newFolderName.trim());
      await loadFolders(); // Refresh folder list
      setFolder(newFolderName.trim()); // Auto-select new folder
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch (error) {
      logger.error('Failed to create folder:', error);
      alert('Failed to create folder: ' + (error as Error).message);
    } finally {
      setIsCreatingFolder(false);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settings = buildProviderSpecificSettings();
    saveSettings(settings);
    onSettingsSaved();
  };

  const handleResetSettings = () => {
    // Clear localStorage completely
    localStorage.removeItem('githubSettings');
    
    // Reset all form fields to defaults
    setGitProvider('github');
    setPat('');
    setOwner('');
    setRepo('');
    setInstanceUrl('https://gitlab.com');
    setProjectId('');
    setToken('');
    setFolder('todos');
    setGeminiApiKey('');
    setOpenRouterApiKey('');
    setAiProvider('gemini');
    setAiModel('');
    setAvailableFolders(['todos']);
    
    logger.log('Settings reset to defaults');
  };

  const handleProviderChange = (newProvider: 'github' | 'gitlab') => {
    setGitProvider(newProvider);
    logger.log(`Switched to ${newProvider} provider`);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-2xl font-bold mb-4">Application Setup</h2>
      <p className="text-gray-300 mb-6">Configure your Git repository and AI settings to get started. Choose between GitHub and GitLab for sovereign data ownership.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Git Provider Selection */}
        <div className="border-b border-gray-600 pb-4">
          <h3 className="text-lg font-medium text-gray-200 mb-4">Git Provider</h3>
          <div>
            <label htmlFor="gitProvider" className="block text-sm font-medium text-gray-300">Choose Your Git Provider</label>
            <select
              id="gitProvider"
              value={gitProvider}
              onChange={(e) => handleProviderChange(e.target.value as 'github' | 'gitlab')}
              className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </select>
            <p className="mt-1 text-sm text-gray-400">
              Both providers support sovereign data ownership - your tasks remain in your repository.
            </p>
          </div>
        </div>

        {/* GitHub Configuration */}
        {gitProvider === 'github' && (
          <div>
            <h3 className="text-lg font-medium text-gray-200 mb-4">GitHub Configuration</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="pat" className="block text-sm font-medium text-gray-300">GitHub Personal Access Token (PAT)</label>
          <input
            type="password"
            id="pat"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            required
          />
                <p className="mt-1 text-sm text-gray-400">Create a fine-grained PAT with 'contents' read/write access to your todo repository.</p>
              </div>
              
              <div>
                <label htmlFor="owner" className="block text-sm font-medium text-gray-300">Repository Owner (Username or Organization)</label>
                <input
                  type="text"
                  id="owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your-github-username"
                  required={gitProvider === 'github'}
                />
              </div>
              
              <div>
                <label htmlFor="repo" className="block text-sm font-medium text-gray-300">Repository Name</label>
                <input
                  type="text"
                  id="repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="your-todo-repo"
                  required={gitProvider === 'github'}
                />
              </div>
            </div>
          </div>
        )}

        {/* GitLab Configuration */}
        {gitProvider === 'gitlab' && (
          <div>
            <h3 className="text-lg font-medium text-gray-200 mb-4">GitLab Configuration</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="instanceUrl" className="block text-sm font-medium text-gray-300">GitLab Instance URL</label>
                <input
                  type="url"
                  id="instanceUrl"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://gitlab.com"
                  required={gitProvider === 'gitlab'}
                />
                <p className="mt-1 text-sm text-gray-400">Use https://gitlab.com for GitLab.com or your self-hosted GitLab URL.</p>
              </div>
              
              <div>
                <label htmlFor="projectId" className="block text-sm font-medium text-gray-300">Project ID</label>
                <input
                  type="text"
                  id="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123456"
                  pattern="[0-9]+"
                  title="Project ID must be numeric"
                  required={gitProvider === 'gitlab'}
                />
                <p className="mt-1 text-sm text-gray-400">Use the numeric project ID (found in project settings → General).</p>
              </div>
              
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-300">GitLab Personal Access Token</label>
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                  required={gitProvider === 'gitlab'}
                />
                <p className="mt-1 text-sm text-gray-400">Create a token with 'api' scope for full repository access.</p>
              </div>
              
            </div>
          </div>
        )}

        {/* Project Folder Configuration (shared between both providers) */}
        <div className="border-t border-gray-600 pt-4">
          <h3 className="text-lg font-medium text-gray-200 mb-4">Project Configuration</h3>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="folder" className="block text-sm font-medium text-gray-300">Project Folder</label>
              <button
                type="button"
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
              >
                {showCreateFolder ? 'Cancel' : '+ New Project'}
              </button>
            </div>
            
            {availableFolders.length > 1 ? (
              <select
                id="folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={isLoadingFolders}
              >
                {availableFolders.map((folderName) => (
                  <option key={folderName} value={folderName}>
                    {folderName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="todos"
                required
              />
            )}
            
            {isLoadingFolders && (
              <p className="mt-1 text-sm text-blue-400">Loading existing projects...</p>
            )}
            
            {!isLoadingFolders && (
              <p className="mt-1 text-sm text-gray-400">
                {availableFolders.length > 1 
                  ? `Found ${availableFolders.length} project folders. Select one or create a new project.`
                  : 'Folder in your repository where tasks will be stored (e.g., "todos", "work-tasks", "personal").'
                }
              </p>
            )}
            
            {showCreateFolder && (
              <div className="mt-4 p-4 bg-gray-900 rounded-md border border-gray-600">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Create New Project Folder</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Project Name</label>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="block w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="work-tasks"
                      pattern="^[a-zA-Z][a-zA-Z0-9_-]*$"
                    />
                    <p className="mt-1 text-xs text-gray-500">Letters, numbers, underscores, and hyphens only.</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || isCreatingFolder}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm py-2 px-3 rounded-md"
                    >
                      {isCreatingFolder ? 'Creating...' : 'Create Project'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateFolder(false);
                        setNewFolderName('');
                      }}
                      className="px-3 py-2 text-sm text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t border-gray-600 pt-4">
          <h3 className="text-lg font-medium text-gray-200 mb-4">AI Provider Configuration</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="aiProvider" className="block text-sm font-medium text-gray-300">AI Provider</label>
              <select
                id="aiProvider"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'openrouter')}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <p className="mt-1 text-sm text-gray-400">Choose your preferred AI provider for task generation and chat features.</p>
            </div>

            {aiProvider === 'gemini' && (
              <div>
                <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-300">Google Gemini API Key</label>
                <input
                  type="password"
                  id="geminiApiKey"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required={aiProvider === 'gemini'}
                />
                <p className="mt-1 text-sm text-gray-400">
                  Get your free API key from{' '}
                  <a 
                    href="https://makersuite.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Google AI Studio
                  </a>
                  . Required for AI-powered task generation and chat features.
                </p>
              </div>
            )}

            {aiProvider === 'openrouter' && (
              <div>
                <label htmlFor="openRouterApiKey" className="block text-sm font-medium text-gray-300">OpenRouter API Key</label>
                <input
                  type="password"
                  id="openRouterApiKey"
                  value={openRouterApiKey}
                  onChange={(e) => setOpenRouterApiKey(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="sk-or-vxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required={aiProvider === 'openrouter'}
                />
                <p className="mt-1 text-sm text-gray-400">
                  Get your API key from{' '}
                  <a 
                    href="https://openrouter.ai/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    OpenRouter
                  </a>
                  . Access to 400+ AI models including GPT, Claude, and more.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="aiModel" className="block text-sm font-medium text-gray-300">AI Model</label>
              <input
                type="text"
                id="aiModel"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={aiProvider === 'gemini' ? 'gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet'}
              />
              <p className="mt-1 text-sm text-gray-400">
                {aiProvider === 'gemini' 
                  ? 'Gemini model to use (e.g., gemini-2.5-flash, gemini-1.5-pro). Leave empty for default.'
                  : 'OpenRouter model to use (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o, meta-llama/llama-3.1-70b-instruct:free). Leave empty for default.'
                }
              </p>
            </div>
          </div>
        </div>

        
        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
          >
            Save Settings
          </button>
          <button
            type="button"
            onClick={() => setShowSettingsSharing(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md"
          >
            Share Config
          </button>
          <button
            type="button"
            onClick={handleResetSettings}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
            title="Clear all settings and reset to defaults"
          >
            Reset All
          </button>
        </div>
      </form>
      
      <SettingsSharing
        isVisible={showSettingsSharing}
        onClose={() => setShowSettingsSharing(false)}
      />
      
      <div className="mt-6 pt-4 border-t border-gray-600">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Application Version</h3>
        <VersionInfo />
      </div>
    </div>
  );
};

export default GitSettings;
