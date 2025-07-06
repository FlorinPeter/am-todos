interface GitHubSettings {
  pat: string;
  owner: string;
  repo: string;
  folder: string;
  geminiApiKey?: string;
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

export const encodeSettingsToUrl = (settings: GitHubSettings): string => {
  try {
    const settingsToEncode = {
      pat: settings.pat,
      owner: settings.owner,
      repo: settings.repo,
      folder: settings.folder,
      geminiApiKey: settings.geminiApiKey || ''
    };
    const encoded = btoa(JSON.stringify(settingsToEncode));
    return `${window.location.origin}${window.location.pathname}?config=${encoded}`;
  } catch (error) {
    console.error("Error encoding settings to URL", error);
    return '';
  }
};

export const decodeSettingsFromUrl = (configParam: string): GitHubSettings | null => {
  try {
    const decoded = atob(configParam);
    const settings = JSON.parse(decoded);
    
    // Validate required fields
    if (!settings.pat || !settings.owner || !settings.repo) {
      console.error("Invalid settings configuration - missing required fields");
      return null;
    }
    
    // Ensure folder field exists
    if (!settings.folder) {
      settings.folder = 'todos';
    }
    
    return settings;
  } catch (error) {
    console.error("Error decoding settings from URL", error);
    return null;
  }
};

export const getUrlConfig = (): GitHubSettings | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const configParam = urlParams.get('config');
  
  if (!configParam) {
    return null;
  }
  
  return decodeSettingsFromUrl(configParam);
};
