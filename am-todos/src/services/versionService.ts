export interface VersionInfo {
  version: string;
  gitSha: string;
  gitTag: string | null;
  buildDate: string | null;
  nodeEnv: string;
}

// Get backend URL based on environment
const getBackendUrl = () => {
  // In development, the proxy handles /api routes
  return process.env.NODE_ENV === 'production' ? '' : '';
};

export const getVersionInfo = async (): Promise<VersionInfo> => {
  try {
    const response = await fetch(`${getBackendUrl()}/api/version`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch version info:', error);
    // Return fallback version info
    return {
      version: process.env.REACT_APP_VERSION || '0.1.0',
      gitSha: process.env.REACT_APP_GIT_SHA || 'development',
      gitTag: process.env.REACT_APP_GIT_TAG || null,
      buildDate: process.env.REACT_APP_BUILD_DATE || null,
      nodeEnv: process.env.NODE_ENV || 'development'
    };
  }
};