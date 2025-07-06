interface GitHubSettings {
  pat: string;
  owner: string;
  repo: string;
  folder: string;
}

const SETTINGS_KEY = 'githubSettings';

export const saveSettings = (settings: GitHubSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Error saving settings to localStorage", error);
  }
};

export const loadSettings = (): GitHubSettings | null => {
  try {
    const settingsString = localStorage.getItem(SETTINGS_KEY);
    if (!settingsString) return null;
    
    const settings = JSON.parse(settingsString);
    // Ensure folder field exists, default to 'todos' for backward compatibility
    if (!settings.folder) {
      settings.folder = 'todos';
    }
    return settings;
  } catch (error) {
    console.error("Error loading settings from localStorage", error);
    return null;
  }
};
