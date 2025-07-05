interface GitHubSettings {
  pat: string;
  owner: string;
  repo: string;
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
    return settingsString ? JSON.parse(settingsString) : null;
  } catch (error) {
    console.error("Error loading settings from localStorage", error);
    return null;
  }
};
