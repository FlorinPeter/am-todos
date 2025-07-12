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

  useEffect(() => {
    const loadedSettings = loadSettings();
    logger.log('ProjectManager: Settings loaded:', loadedSettings);
    setSettings(loadedSettings);
    
    // Force load folders if we have settings
    let timeoutId: NodeJS.Timeout | null = null;
    if (loadedSettings?.gitProvider === 'gitlab' && loadedSettings?.instanceUrl && loadedSettings?.projectId && loadedSettings?.token) {
      logger.log('ProjectManager: Force loading GitLab folders');
      timeoutId = setTimeout(() => loadFolders(), 100);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const loadFolders = async () => {
    // Check if we have the required settings for any provider
    const hasGitHubSettings = !!(settings?.pat && settings?.owner && settings?.repo);
    const hasGitLabSettings = !!(settings?.instanceUrl && settings?.projectId && settings?.token);
    
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

  useEffect(() => {
    const hasGitHubSettings = !!(settings?.pat && settings?.owner && settings?.repo);
    const hasGitLabSettings = !!(settings?.instanceUrl && settings?.projectId && settings?.token);
    
    logger.log('ProjectManager: useEffect triggered', { hasGitHubSettings, hasGitLabSettings, settings });
    
    if (hasGitHubSettings || hasGitLabSettings) {
      logger.log('ProjectManager: Calling loadFolders');
      loadFolders();
    } else {
      logger.log('ProjectManager: Not loading folders - no valid settings');
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
      
      await loadFolders();
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

  const hasGitHubSettings = settings?.pat && settings?.owner && settings?.repo;
  const hasGitLabSettings = settings?.instanceUrl && settings?.projectId && settings?.token;
  
  logger.log('ProjectManager: Render check', { 
    hasGitHubSettings, 
    hasGitLabSettings, 
    availableFolders, 
    availableFoldersLength: availableFolders.length,
    availableFoldersContent: [...availableFolders],
    currentProject,
    showDropdown: availableFolders.length > 1
  });
  
  if (!hasGitHubSettings && !hasGitLabSettings) {
    logger.log('ProjectManager: Not rendering - no settings');
    return null; // Don't show if not configured
  }

  return (
    <>
      {/* Mobile: Compact Project Indicator */}
      <div className="md:hidden flex items-center">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-md text-sm min-h-[32px]"
          title={`Current: ${currentProject}`}
        >
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="truncate max-w-20">{currentProject}</span>
          <span>+</span>
        </button>
      </div>

      {/* Desktop: Full Project Management */}
      <div className="hidden md:flex items-center space-x-3">
        {/* Current Project Display */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Project:</span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-white">{currentProject}</span>
          </div>
        </div>

        {/* Project Switcher */}
        {availableFolders.length > 1 && (
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
        )}

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