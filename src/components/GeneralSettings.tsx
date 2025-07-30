import React, { useState, useEffect, useCallback } from 'react';
import { saveSettings, loadSettings } from '../utils/localStorage';
import type { GeneralSettings } from '../utils/localStorage';
import { listProjectFolders, createProjectFolder } from '../services/gitService';
import SettingsSharing from './SettingsSharing';
import VersionInfo from './VersionInfo';
import { getVersionInfo, VersionInfo as VersionInfoType } from '../services/versionService';
import logger from '../utils/logger';

interface GeneralSettingsProps {
  onSettingsSaved: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ onSettingsSaved }) => {
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
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter' | 'local-proxy'>('gemini');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  
  // Local AI Proxy settings
  const [mainServerToken, setMainServerToken] = useState('');
  const [versionInfo, setVersionInfo] = useState<VersionInfoType | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [showSettingsSharing, setShowSettingsSharing] = useState(false);
  
  // User Proxy Configuration (new)
  const [proxyUuid, setProxyUuid] = useState('');
  const [proxyLocalToken, setProxyLocalToken] = useState('');
  const [proxyConnectionStatus, setProxyConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [proxyStatusMessage, setProxyStatusMessage] = useState('');
  const [isCheckingProxyStatus, setIsCheckingProxyStatus] = useState(false);
  const [lastProxyCheck, setLastProxyCheck] = useState<Date | null>(null);
  const [selectedAiProvider, setSelectedAiProvider] = useState<'lmstudio' | 'ollama'>('lmstudio');

  // Fetch connected proxies count from server
  const fetchConnectedProxiesCount = useCallback(async () => {
    try {
      const response = await fetch('/api/main-server-token');
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          setMainServerToken(data.token);
        }
      } else {
        // Handle server errors (token not configured)
        logger.warn('Server token not available:', response.status);
        setMainServerToken('Server token not configured');
      }
    } catch (error) {
      logger.error('Failed to fetch proxy status:', error);
      setMainServerToken('Error loading token');
    }
  }, []); // No dependencies - should only be called once on mount

  // Fetch version info for Docker instructions
  const fetchVersionInfo = useCallback(async () => {
    try {
      const info = await getVersionInfo();
      setVersionInfo(info);
    } catch (error) {
      logger.error('Failed to fetch version info:', error);
    }
  }, []);

  // Check user-specific proxy connection status
  const checkProxyStatus = useCallback(async (uuid?: string, token?: string) => {
    const uuidToCheck = uuid || proxyUuid;
    const tokenToCheck = token || proxyLocalToken;
    
    if (!uuidToCheck || !tokenToCheck) {
      setProxyConnectionStatus('disconnected');
      setProxyStatusMessage('Please configure your proxy UUID and local token');
      return;
    }
    
    setIsCheckingProxyStatus(true);
    setProxyConnectionStatus('connecting');
    setProxyStatusMessage('Checking proxy connection...');
    
    try {
      const response = await fetch('/api/proxy-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proxyUuid: uuidToCheck,
          proxyLocalToken: tokenToCheck
        })
      });
      
      const data = await response.json();
      setLastProxyCheck(new Date());
      
      if (data.connected) {
        setProxyConnectionStatus('connected');
        setProxyStatusMessage(`Connected: ${data.proxyInfo?.displayName || 'Local AI Proxy'}`);
      } else {
        setProxyConnectionStatus('error');
        setProxyStatusMessage(data.message || 'Proxy not connected');
      }
    } catch (error) {
      logger.error('Failed to check proxy status:', error);
      setProxyConnectionStatus('error');
      setProxyStatusMessage('Failed to check proxy status');
    } finally {
      setIsCheckingProxyStatus(false);
    }
  }, [proxyUuid, proxyLocalToken]);

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
      
      // Load main server token (used for local proxy setup)
      setMainServerToken(savedSettings.mainServerToken || '');
      
      // Load user proxy configuration
      if (savedSettings.localProxy) {
        setProxyUuid(savedSettings.localProxy.proxyUuid || '');
        setProxyLocalToken(savedSettings.localProxy.proxyLocalToken || '');
        // Always start as disconnected - we'll check the actual status
        setProxyConnectionStatus('disconnected');
        
        // If user has configured proxy credentials, check their status
        if (savedSettings.localProxy.proxyUuid && savedSettings.localProxy.proxyLocalToken) {
          checkProxyStatus(savedSettings.localProxy.proxyUuid, savedSettings.localProxy.proxyLocalToken);
        }
      }
      
      // Fetch connected proxies count from server
      fetchConnectedProxiesCount();
      
      // Fetch version info for Docker instructions
      fetchVersionInfo();
    }
  }, [fetchVersionInfo]); // Fixed: Removed checkProxyStatus to prevent infinite loop

  // Periodic proxy status checking when local-proxy is selected
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Only set up periodic checking if local-proxy is selected and credentials are configured
    // Add validation to ensure both credentials are actually present and non-empty
    if (aiProvider === 'local-proxy' && proxyUuid && proxyUuid.trim() && proxyLocalToken && proxyLocalToken.trim()) {
      // Check immediately with current values
      checkProxyStatus(proxyUuid, proxyLocalToken);
      
      // Set up periodic checking every 30 seconds
      intervalId = setInterval(() => {
        // Always use current state values for periodic checks
        checkProxyStatus(proxyUuid, proxyLocalToken);
      }, 30000);
    }
    
    // Cleanup interval on unmount or when conditions change
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [aiProvider, proxyUuid, proxyLocalToken]); // Fixed: Removed checkProxyStatus dependency

  // Handle AI provider change with real-time proxy validation
  const handleAiProviderChange = useCallback((newProvider: 'gemini' | 'openrouter' | 'local-proxy') => {
    setAiProvider(newProvider);
    
    // If user selects local-proxy, automatically check connection status
    if (newProvider === 'local-proxy') {
      // Check if proxy credentials are configured with enhanced validation
      if (proxyUuid && proxyUuid.trim() && proxyLocalToken && proxyLocalToken.trim()) {
        // Auto-check connection status with current values
        checkProxyStatus(proxyUuid, proxyLocalToken);
      } else {
        // Set disconnected status with helpful message
        setProxyConnectionStatus('disconnected');
        if (!proxyUuid || !proxyUuid.trim()) {
          setProxyStatusMessage('Please enter proxy UUID in the Local AI Proxy Setup section below');
        } else if (!proxyLocalToken || !proxyLocalToken.trim()) {
          setProxyStatusMessage('Please enter local token in the Local AI Proxy Setup section below');
        } else {
          setProxyStatusMessage('Please configure your proxy UUID and local token in the Local AI Proxy Setup section below');
        }
      }
    }
  }, [proxyUuid, proxyLocalToken]); // Fixed: Removed checkProxyStatus dependency

  // Handle proxy credential changes with debounced validation
  const handleProxyCredentialChange = useCallback((field: 'uuid' | 'token', value: string) => {
    if (field === 'uuid') {
      setProxyUuid(value);
    } else {
      setProxyLocalToken(value);
    }
    
    // If both credentials are provided and local-proxy is selected, check connection after short delay
    const newProxyUuid = field === 'uuid' ? value : proxyUuid;
    const newProxyLocalToken = field === 'token' ? value : proxyLocalToken;
    
    // Enhanced validation: ensure both credentials are present and non-empty
    if (newProxyUuid && newProxyUuid.trim() && newProxyLocalToken && newProxyLocalToken.trim() && aiProvider === 'local-proxy') {
      // Debounce the connection check to avoid too many requests while user is typing
      setTimeout(() => {
        checkProxyStatus(newProxyUuid, newProxyLocalToken);
      }, 1000);
    } else if (aiProvider === 'local-proxy') {
      // Clear status if credentials are incomplete - be more specific about what's missing
      setProxyConnectionStatus('disconnected');
      if (!newProxyUuid || !newProxyUuid.trim()) {
        setProxyStatusMessage('Please enter proxy UUID');
      } else if (!newProxyLocalToken || !newProxyLocalToken.trim()) {
        setProxyStatusMessage('Please enter local token');
      } else {
        setProxyStatusMessage('Please enter both proxy UUID and local token');
      }
    }
  }, [proxyUuid, proxyLocalToken, aiProvider]); // Fixed: Removed checkProxyStatus dependency

  // Helper function to build dual-configuration settings
  const buildProviderSpecificSettings = useCallback((): GeneralSettings => {
    const savedSettings = loadSettings();
    
    return {
      gitProvider,
      folder, 
      geminiApiKey, 
      aiProvider, 
      openRouterApiKey, 
      aiModel,
      mainServerToken,
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
      },
      // User proxy configuration
      localProxy: {
        endpoint: 'http://localhost:1234', // Default endpoint
        isConnected: proxyConnectionStatus === 'connected',
        connectionStatus: proxyConnectionStatus, // Save current status for aiService
        proxyUuid: proxyUuid,
        proxyLocalToken: proxyLocalToken,
        userConfigured: !!(proxyUuid && proxyLocalToken),
        lastHeartbeat: lastProxyCheck?.toISOString()
      }
    };
  }, [gitProvider, folder, geminiApiKey, aiProvider, openRouterApiKey, aiModel, pat, owner, repo, instanceUrl, projectId, token, mainServerToken, proxyUuid, proxyLocalToken, proxyConnectionStatus, lastProxyCheck]);

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
    localStorage.removeItem('generalSettings');
    
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
                onChange={(e) => handleAiProviderChange(e.target.value as 'gemini' | 'openrouter' | 'local-proxy')}
                className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openrouter">OpenRouter</option>
                <option value="local-proxy">Local Proxy</option>
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


            {/* Model configuration - not needed for local proxy */}
            {aiProvider !== 'local-proxy' && (
              <div>
                <label htmlFor="aiModel" className="block text-sm font-medium text-gray-300">AI Model</label>
                <input
                  type="text"
                  id="aiModel"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="mt-1 block w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    aiProvider === 'gemini' ? 'gemini-2.5-flash' : 
                    aiProvider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' :
                    'mistralai/mistral-small-3.2'
                  }
                />
              <p className="mt-1 text-sm text-gray-400">
                {aiProvider === 'gemini' 
                  ? 'Gemini model to use (e.g., gemini-2.5-flash, gemini-1.5-pro). Leave empty for default.'
                  : aiProvider === 'openrouter'
                  ? 'OpenRouter model to use (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o, meta-llama/llama-3.1-70b-instruct:free). Leave empty for default.'
                  : 'Local AI model to use (e.g., mistralai/mistral-small-3.2, llama2, codellama). Leave empty for proxy default.'
                }
              </p>
              </div>
            )}
          </div>
        </div>

        {/* Local AI Proxy Setup - Only show when Local Proxy is selected */}
        {aiProvider === 'local-proxy' && (
          <div className="border-t border-gray-600 pt-4">
            <h3 className="text-lg font-medium text-gray-200 mb-4">🔐 Local AI Proxy Setup</h3>
          <div className="space-y-4">
            

            {/* Setup Instructions with Tabs */}
            <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-600/30">
              <h4 className="text-sm font-medium text-blue-400 mb-3">📖 Setup Instructions</h4>
              
              {/* AI Provider Tabs */}
              <div className="flex space-x-1 mb-4">
                <button
                  type="button"
                  onClick={() => setSelectedAiProvider('lmstudio')}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    selectedAiProvider === 'lmstudio'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🖥️ LMStudio
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAiProvider('ollama')}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    selectedAiProvider === 'ollama'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  🦙 Ollama
                </button>
              </div>

              {/* LMStudio Configuration */}
              {selectedAiProvider === 'lmstudio' && (
                <div className="space-y-2 text-xs text-gray-300">
                  <p><strong>1.</strong> Install and start LMStudio on your secure machine with the Mistral model loaded</p>
                  <p><strong>2.</strong> Run this command to deploy the local AI proxy:</p>
                  <div className="bg-gray-800 p-3 rounded mt-2 font-mono text-green-400 text-xs overflow-x-auto">
                    <div className="whitespace-nowrap">
                      docker run -d --name am_todos_proxy \<br/>
                      &nbsp;&nbsp;-v ./proxy-config:/config \<br/>
                      &nbsp;&nbsp;-e LOCAL_PROXY_MODE=true \<br/>
                      &nbsp;&nbsp;-e MAIN_SERVER_TOKEN={mainServerToken || 'LOADING...'} \<br/>
                      &nbsp;&nbsp;-e MAIN_SERVER_URL={(window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/proxy-ws'} \<br/>
                      &nbsp;&nbsp;-e LOCAL_AI_ENDPOINT=http://host.docker.internal:1234 \<br/>
                      &nbsp;&nbsp;-e LOCAL_AI_MODEL=mistralai/mistral-small-3.2 \<br/>
                      &nbsp;&nbsp;ghcr.io/florinpeter/am-todos:{versionInfo?.gitTag || versionInfo?.version || 'latest'}
                    </div>
                  </div>
                  <p><strong>3.</strong> The proxy will connect automatically to this server</p>
                  <p><strong>4.</strong> Create todos - they'll be processed locally via LMStudio!</p>
                  <div className="mt-3 p-2 bg-blue-900/30 border border-blue-600/30 rounded">
                    <p className="text-xs text-blue-400">
                      <strong>💡 Note:</strong> Ensure LMStudio is running on port 1234 with the mistralai/mistral-small-3.2 model loaded.
                    </p>
                  </div>
                </div>
              )}

              {/* Ollama Configuration */}
              {selectedAiProvider === 'ollama' && (
                <div className="space-y-2 text-xs text-gray-300">
                  <p><strong>1.</strong> Install and start Ollama on your secure machine with the Mistral model loaded</p>
                  <p><strong>2.</strong> Pull the Mistral model: <code className="bg-gray-700 px-1 rounded text-yellow-400">ollama pull mistral-small:3.2</code></p>
                  <p><strong>3.</strong> Run this command to deploy the local AI proxy:</p>
                  <div className="bg-gray-800 p-3 rounded mt-2 font-mono text-green-400 text-xs overflow-x-auto">
                    <div className="whitespace-nowrap">
                      docker run -d --name am_todos_proxy \<br/>
                      &nbsp;&nbsp;-v ./proxy-config:/config \<br/>
                      &nbsp;&nbsp;-e LOCAL_PROXY_MODE=true \<br/>
                      &nbsp;&nbsp;-e MAIN_SERVER_TOKEN={mainServerToken || 'LOADING...'} \<br/>
                      &nbsp;&nbsp;-e MAIN_SERVER_URL={(window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/proxy-ws'} \<br/>
                      &nbsp;&nbsp;-e LOCAL_AI_ENDPOINT=http://host.docker.internal:11434 \<br/>
                      &nbsp;&nbsp;-e LOCAL_AI_MODEL=mistral-small:3.2 \<br/>
                      &nbsp;&nbsp;ghcr.io/florinpeter/am-todos:{versionInfo?.gitTag || versionInfo?.version || 'latest'}
                    </div>
                  </div>
                  <p><strong>4.</strong> The proxy will connect automatically to this server</p>
                  <p><strong>5.</strong> Create todos - they'll be processed locally via Ollama!</p>
                  <div className="mt-3 p-2 bg-blue-900/30 border border-blue-600/30 rounded">
                    <p className="text-xs text-blue-400">
                      <strong>💡 Note:</strong> Ensure Ollama is running on port 11434 with the mistral-small:3.2 model available.
                    </p>
                  </div>
                </div>
              )}
            </div>


            {/* User Proxy Configuration Section */}
            <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600/30">
              <h4 className="text-sm font-medium text-purple-400 mb-3">🔧 Configure Your Proxy Credentials</h4>
              <div className="space-y-4">
                <div className="bg-gray-800 rounded p-3">
                  <p className="text-xs text-gray-300 mb-3">
                    <strong>Step 1:</strong> After running the Docker command above, get your proxy credentials:
                  </p>
                  <div className="bg-gray-900 p-2 rounded font-mono text-xs text-green-400">
                    cat proxy-config/settings.json
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Copy the <code className="text-yellow-400">uuid</code> and <code className="text-yellow-400">localToken</code> values from the output.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Proxy UUID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={proxyUuid}
                      onChange={(e) => handleProxyCredentialChange('uuid', e.target.value)}
                      className="block w-full p-2 text-xs bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                      placeholder="550e8400-e29b-41d4-a716-446655440000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-1">
                      Local Token <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={proxyLocalToken}
                      onChange={(e) => handleProxyCredentialChange('token', e.target.value)}
                      className="block w-full p-2 text-xs bg-gray-700 border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                      placeholder="a1b2c3d4e5f6..."
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => checkProxyStatus()}
                    disabled={!proxyUuid || !proxyLocalToken || isCheckingProxyStatus}
                    className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md"
                  >
                    {isCheckingProxyStatus ? '🔄 Checking...' : '🔍 Test Connection'}
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${
                      proxyConnectionStatus === 'connected' ? 'bg-green-400' :
                      proxyConnectionStatus === 'connecting' ? 'bg-yellow-400' :
                      proxyConnectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
                    }`}></span>
                    <span className="text-xs text-gray-300">
                      {proxyConnectionStatus === 'connected' 
                        ? (proxyStatusMessage || 'Connected: Local AI Proxy')
                        : proxyConnectionStatus === 'connecting'
                        ? 'Checking proxy connection...'
                        : proxyConnectionStatus === 'error'
                        ? (proxyStatusMessage.startsWith('Connected:') ? 'Proxy not connected' : proxyStatusMessage || 'Proxy not connected')
                        : (proxyStatusMessage || 'Not configured')
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ready Status */}
            <div className={`rounded-lg p-4 border ${
              proxyConnectionStatus === 'connected' 
                ? 'bg-green-900/30 border-green-600/30' 
                : 'bg-yellow-900/30 border-yellow-600/30'
            }`}>
              <div className="flex items-center space-x-3">
                <span className={`text-lg ${
                  proxyConnectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  {proxyConnectionStatus === 'connected' ? '✅' : '⚠️'}
                </span>
                <div>
                  <h4 className={`text-sm font-medium ${
                    proxyConnectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {proxyConnectionStatus === 'connected' 
                      ? 'Ready to process todos locally' 
                      : 'Configure your proxy to process todos locally'
                    }
                  </h4>
                  <p className="text-xs text-gray-300 mt-1">
                    {proxyConnectionStatus === 'connected' 
                      ? '🔒 Your proxy is connected and validated. Todos will be processed locally.'
                      : '📝 Complete the proxy setup and configuration above to enable local processing.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        
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

export default GeneralSettings;