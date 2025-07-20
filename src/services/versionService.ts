import logger from '../utils/logger';
import { fetchJsonWithTimeout, TIMEOUT_VALUES } from '../utils/fetchWithTimeout';

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
  return '';
};

export const getVersionInfo = async (): Promise<VersionInfo> => {
  try {
    return await fetchJsonWithTimeout(`${getBackendUrl()}/api/version`, {
      timeout: TIMEOUT_VALUES.FAST,
    });
  } catch (error) {
    logger.error('Failed to fetch version info:', error);
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