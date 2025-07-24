import React, { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '../utils/localStorage';
import { listProjectFolders, createProjectFolder } from '../services/gitService';
import logger from '../utils/logger';

interface ProjectManagerProps {
  onProjectChanged: (newSettings?: any) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ onProjectChanged }) => {
  const [settings, setSettings] = useState(loadSettings());
  const [availableFolders, setAvailableFolders] = useState<string[]>(['todos']);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Debouncing for loadFolders to prevent rapid successive calls
  const [loadFoldersTimeout, setLoadFoldersTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadedSettings = loadSettings();
    logger.log('ProjectManager: Settings loaded:', loadedSettings);
    setSettings(loadedSettings);
    
    // Force load folders if we have valid settings for any provider (check new dual-config format)
    let timeoutId: NodeJS.Timeout | null = null;
    const hasGitHubConfig = (
      (loadedSettings?.github?.pat && loadedSettings?.github?.owner && loadedSettings?.github?.repo) ||
      (loadedSettings?.pat && loadedSettings?.owner && loadedSettings?.repo) // fallback to legacy
    );
    const hasGitLabConfig = loadedSettings?.gitProvider === 'gitlab' && (
      (loadedSettings?.gitlab?.instanceUrl && loadedSettings?.gitlab?.projectId && loadedSettings?.gitlab?.token) ||
      (loadedSettings?.instanceUrl && loadedSettings?.projectId && loadedSettings?.token) // fallback to legacy
    );
    
    if (hasGitHubConfig || hasGitLabConfig) {
      logger.log('ProjectManager: Force loading folders for', loadedSettings?.gitProvider || 'github');
      timeoutId = setTimeout(() => debouncedLoadFolders(), 100);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (loadFoldersTimeout) {
        clearTimeout(loadFoldersTimeout);
      }
    };
  }, []);

  // Watch for external settings changes (like project context switching)
  useEffect(() => {
    const checkForSettingsChanges = () => {
      const currentSettings = loadSettings();
      const currentFolder = currentSettings?.folder || 'todos';
      const localFolder = settings?.folder || 'todos';
      
      if (currentFolder !== localFolder) {
        logger.log('ProjectManager: External settings change detected', { 
          localFolder, 
          currentFolder,
          fullSettings: currentSettings 
        });
        setSettings(currentSettings);
      }
    };

    // Only check immediately - no polling
    checkForSettingsChanges();
    
    // Listen for storage events instead of polling (for cross-tab changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'am-todos-settings') {
        checkForSettingsChanges();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [settings?.folder]);

  const loadFolders = async () => {
    // Check if we have the required settings for any provider (new dual-config format)
    const hasGitHubSettings = !!(
      (settings?.github?.pat && settings?.github?.owner && settings?.github?.repo) ||
      (settings?.pat && settings?.owner && settings?.repo) // fallback to legacy format
    );
    const hasGitLabSettings = !!(
      (settings?.gitlab?.instanceUrl && settings?.gitlab?.projectId && settings?.gitlab?.token) ||
      (settings?.instanceUrl && settings?.projectId && settings?.token) // fallback to legacy format
    );
    
    logger.log('ProjectManager: loadFolders called', { hasGitHubSettings, hasGitLabSettings });
    
    if (!hasGitHubSettings && !hasGitLabSettings) return;
    
    setIsLoading(true);
    try {
      const folders = await listProjectFolders();
      logger.log('ProjectManager: Folders loaded:', folders);
      setAvailableFolders(folders);
    } catch (error) {
      logger.error('ProjectManager: Failed to load folders:', error);
      logger.error('ProjectManager: Error details:', error.message, error.stack);
      // Keep default folders on error
      setAvailableFolders(['todos']);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced version to prevent rapid successive calls
  const debouncedLoadFolders = () => {
    const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.log('🔄 ProjectManager: debouncedLoadFolders called', {
      callId,
      hasExistingTimeout: !!loadFoldersTimeout,
      settings: {
        provider: settings?.gitProvider,
        folder: settings?.folder
      }
    });
    
    if (loadFoldersTimeout) {
      logger.log('⏰ ProjectManager: Clearing existing timeout', { callId });
      clearTimeout(loadFoldersTimeout);
    }
    
    const newTimeout = setTimeout(() => {
      logger.log('⚡ ProjectManager: Executing debounced loadFolders', { callId });
      loadFolders();
      setLoadFoldersTimeout(null);
    }, 1000); // 1 second debounce
    
    setLoadFoldersTimeout(newTimeout);
    logger.log('⏲️ ProjectManager: New timeout set', { callId, timeoutId: newTimeout });
  };

  useEffect(() => {
    const effectId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const hasGitHubSettings = !!(settings?.pat && settings?.owner && settings?.repo);
    const hasGitLabSettings = !!(settings?.instanceUrl && settings?.projectId && settings?.token);
    
    logger.log('📋 ProjectManager: settings useEffect triggered', {
      effectId,
      hasGitHubSettings,
      hasGitLabSettings,
      dependencies: {
        pat: !!settings?.pat,
        owner: !!settings?.owner,
        repo: !!settings?.repo,
        instanceUrl: !!settings?.instanceUrl,
        projectId: !!settings?.projectId,
        token: !!settings?.token
      },
      provider: settings?.gitProvider
    });
    
    if (hasGitHubSettings || hasGitLabSettings) {
      logger.log('✅ ProjectManager: Valid settings found, calling debounced loadFolders', { effectId });
      debouncedLoadFolders();
    } else {
      logger.log('❌ ProjectManager: No valid settings, skipping loadFolders', { effectId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.pat, settings?.owner, settings?.repo, settings?.instanceUrl, settings?.projectId, settings?.token]);

  const handleProjectSwitch = (newFolder: string) => {
    if (!settings) return;
    
    const updatedSettings = { ...settings, folder: newFolder };
    saveSettings(updatedSettings);
    setSettings(updatedSettings);
    onProjectChanged(updatedSettings);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    
    // Check if we have the required settings for any provider
    const hasGitHubSettings = !!(settings?.pat && settings?.owner && settings?.repo);
    const hasGitLabSettings = !!(settings?.instanceUrl && settings?.projectId && settings?.token);
    
    if (!hasGitHubSettings && !hasGitLabSettings) return;
    
    setIsCreating(true);
    try {
      await createProjectFolder(newProjectName.trim());
      
      await loadFolders(); // Use direct call here since we want immediate loading after creation
      handleProjectSwitch(newProjectName.trim());
      
      setNewProjectName('');
      setShowCreateModal(false);
    } catch (error) {
      logger.error('Failed to create project:', error);
      alert('Failed to create project: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const currentProject = settings?.folder || 'todos';

  const hasGitHubSettings = !!(
    (settings?.github?.pat && settings?.github?.owner && settings?.github?.repo) ||
    (settings?.pat && settings?.owner && settings?.repo) // fallback to legacy format
  );
  const hasGitLabSettings = !!(
    (settings?.gitlab?.instanceUrl && settings?.gitlab?.projectId && settings?.gitlab?.token) ||
    (settings?.instanceUrl && settings?.projectId && settings?.token) // fallback to legacy format
  );
  
  logger.log('ProjectManager: Render check', { 
    hasGitHubSettings, 
    hasGitLabSettings, 
    availableFolders, 
    availableFoldersLength: availableFolders.length,
    availableFoldersContent: [...availableFolders],
    currentProject,
    showDropdown: availableFolders.length > 1,
    settingsSnapshot: {
      gitProvider: settings?.gitProvider,
      github: settings?.github ? 'configured' : 'missing',
      gitlab: settings?.gitlab ? 'configured' : 'missing',
      legacyFields: {
        pat: !!settings?.pat,
        owner: !!settings?.owner,
        repo: !!settings?.repo,
        instanceUrl: !!settings?.instanceUrl,
        projectId: !!settings?.projectId,
        token: !!settings?.token
      }
    }
  });
  
  if (!hasGitHubSettings && !hasGitLabSettings) {
    logger.log('ProjectManager: Not rendering - no settings');
    return null; // Don't show if not configured
  }

  return (
    <>
      {/* Mobile: Compact Project Management */}
      <div className="md:hidden flex items-center space-x-2">
        {/* Visual indicator */}
        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
        
        {/* Project Switcher for mobile */}
        {availableFolders.length > 1 ? (
          <select
            value={currentProject}
            onChange={(e) => handleProjectSwitch(e.target.value)}
            className="text-xs bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-white focus:ring-blue-500 focus:border-blue-500 max-w-24"
            disabled={isLoading}
            title="Switch Project"
          >
            {availableFolders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-medium text-white truncate max-w-20" title={currentProject}>
            {currentProject}
          </span>
        )}
        
        {/* Create button for mobile */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-2 py-1.5 rounded-md text-sm min-h-[32px] w-8 flex-shrink-0"
          title="Create New Project"
        >
          <span>+</span>
        </button>
      </div>

      {/* Desktop: Streamlined Project Management */}
      <div className="hidden md:flex items-center space-x-3">
        {/* Project Switcher with Visual Indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          {availableFolders.length > 1 ? (
            <select
              value={currentProject}
              onChange={(e) => handleProjectSwitch(e.target.value)}
              className="text-sm bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              {availableFolders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-white">{currentProject}</span>
          )}
        </div>

        {/* Create New Project Button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md flex items-center space-x-1 min-h-[32px]"
          title="Create New Project"
        >
          <span>+</span>
          <span>New Project</span>
        </button>
      </div>

      {/* Project Management Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-white mb-4">Project Management</h3>
            
            {/* Current Project & Switcher */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Project: <span className="text-blue-400">{currentProject}</span>
              </label>
              
              {availableFolders.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Switch to:
                  </label>
                  <select
                    value={currentProject}
                    onChange={(e) => {
                      handleProjectSwitch(e.target.value);
                      setShowCreateModal(false);
                    }}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  >
                    {availableFolders.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Create New Project Section */}
            <div className="border-t border-gray-600 pt-4">
              <h4 className="text-md font-medium text-white mb-3">Create New Project</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
                  placeholder="work-tasks"
                  pattern="^[a-zA-Z][a-zA-Z0-9_-]*$"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Letters, numbers, underscores, and hyphens only
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isCreating}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-md"
              >
                {isCreating ? 'Creating...' : 'Create Project'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectManager;