import React, { useState, useEffect } from 'react';
import { saveSettings, loadSettings } from '../utils/localStorage';
import { listProjectFolders, createProjectFolder } from '../services/githubService';

interface GitHubSettingsProps {
  onSettingsSaved: () => void;
}

const GitHubSettings: React.FC<GitHubSettingsProps> = ({ onSettingsSaved }) => {
  const [pat, setPat] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [folder, setFolder] = useState('todos');
  const [availableFolders, setAvailableFolders] = useState<string[]>(['todos']);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setPat(savedSettings.pat);
      setOwner(savedSettings.owner);
      setRepo(savedSettings.repo);
      setFolder(savedSettings.folder || 'todos');
    }
  }, []);

  const loadFolders = async () => {
    if (!pat || !owner || !repo) return;
    
    setIsLoadingFolders(true);
    try {
      const folders = await listProjectFolders(pat, owner, repo);
      setAvailableFolders(folders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setAvailableFolders(['todos']); // Fallback
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Load folders when credentials are available
  useEffect(() => {
    if (pat && owner && repo) {
      loadFolders();
    }
  }, [pat, owner, repo]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !pat || !owner || !repo) return;
    
    setIsCreatingFolder(true);
    try {
      await createProjectFolder(pat, owner, repo, newFolderName.trim());
      await loadFolders(); // Refresh folder list
      setFolder(newFolderName.trim()); // Auto-select new folder
      setNewFolderName('');
      setShowCreateFolder(false);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert('Failed to create folder: ' + (error as Error).message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ pat, owner, repo, folder });
    onSettingsSaved();
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-2xl font-bold mb-4">GitHub Settings</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            required
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
            required
          />
        </div>
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
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default GitHubSettings;
