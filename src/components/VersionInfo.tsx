import React, { useState, useEffect } from 'react';
import { getVersionInfo, VersionInfo } from '../services/versionService';

const VersionInfoComponent: React.FC = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        const info = await getVersionInfo();
        setVersionInfo(info);
      } catch (error) {
        console.error('Failed to load version info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVersionInfo();
  }, []);

  if (isLoading) {
    return (
      <div className="text-xs text-gray-500">
        Loading version info...
      </div>
    );
  }

  if (!versionInfo) {
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === 'unknown') return null;
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}${month}${day}${hours}${minutes}`;
    } catch {
      return dateString;
    }
  };

  const formatSha = (sha: string) => {
    if (sha === 'development' || sha === 'unknown') return sha;
    return sha.substring(0, 7);
  };

  return (
    <div className="text-xs text-gray-500 space-y-1">
      <div className="flex items-center space-x-2">
        <span className="font-medium">Version:</span>
        <span className="font-mono">
          {versionInfo.gitTag && versionInfo.gitTag !== 'unknown' && versionInfo.gitTag !== null
            ? versionInfo.gitTag 
            : versionInfo.version}
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="font-medium">Commit:</span>
        <span className="font-mono bg-gray-100 px-1 rounded">
          {formatSha(versionInfo.gitSha)}
        </span>
      </div>
      
      {versionInfo.buildDate && formatDate(versionInfo.buildDate) && (
        <div className="flex items-center space-x-2">
          <span className="font-medium">Built:</span>
          <span>{formatDate(versionInfo.buildDate)}</span>
        </div>
      )}
      
      {versionInfo.nodeEnv && (
        <div className="flex items-center space-x-2">
          <span className="font-medium">Environment:</span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            versionInfo.nodeEnv === 'production' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {versionInfo.nodeEnv}
          </span>
        </div>
      )}
    </div>
  );
};

export default VersionInfoComponent;