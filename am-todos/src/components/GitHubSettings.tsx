import React, { useState, useEffect } from 'react';
import { saveSettings, loadSettings } from '../utils/localStorage';

interface GitHubSettingsProps {
  onSettingsSaved: () => void;
}

const GitHubSettings: React.FC<GitHubSettingsProps> = ({ onSettingsSaved }) => {
  const [pat, setPat] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');

  useEffect(() => {
    const savedSettings = loadSettings();
    if (savedSettings) {
      setPat(savedSettings.pat);
      setOwner(savedSettings.owner);
      setRepo(savedSettings.repo);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings({ pat, owner, repo });
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
