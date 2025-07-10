import React, { useState, useEffect } from 'react';
import { getFileHistory, getFileAtCommit } from '../services/gitService';

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface GitHistoryProps {
  filePath: string;
  onRestore: (content: string, commitSha: string) => void;
  onClose: () => void;
}

const GitHistory: React.FC<GitHistoryProps> = ({
  filePath,
  onRestore,
  onClose
}) => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const history = await getFileHistory(filePath);
        setCommits(history);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch git history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [filePath]);

  const handlePreview = async (commitSha: string) => {
    try {
      setLoadingPreview(true);
      setSelectedCommit(commitSha);
      const fileData = await getFileAtCommit(filePath, commitSha);
      setPreviewContent(fileData.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file content');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestore = () => {
    if (selectedCommit && previewContent) {
      onRestore(previewContent, selectedCommit);
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700">
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-200">Loading git history...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Git History Error</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-xl"
            >
              ✕
            </button>
          </div>
          <div className="text-red-400 mb-4">{error}</div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Git History - {filePath}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Commit List */}
          <div className="w-1/2 pr-4 border-r border-gray-600 overflow-y-auto">
            <h3 className="font-semibold mb-3 text-gray-200">Commits ({commits.length})</h3>
            {commits.length === 0 ? (
              <p className="text-gray-400">No commits found for this file.</p>
            ) : (
              <div className="space-y-2">
                {commits.map((commit) => (
                  <div
                    key={commit.sha}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedCommit === commit.sha
                        ? 'bg-blue-900 border-blue-600'
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                    }`}
                    onClick={() => handlePreview(commit.sha)}
                  >
                    <div className="font-medium text-sm text-gray-100 mb-1">
                      {commit.message}
                    </div>
                    <div className="text-xs text-gray-300">
                      {commit.author} • {formatDate(commit.date)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {commit.sha.substring(0, 7)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          <div className="w-1/2 pl-4 overflow-y-auto">
            {selectedCommit ? (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-200">Preview</h3>
                  <button
                    onClick={handleRestore}
                    disabled={!previewContent}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Restore This Version
                  </button>
                </div>
                {loadingPreview ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-gray-200">Loading preview...</span>
                  </div>
                ) : previewContent ? (
                  <div className="flex-1 bg-gray-900 rounded p-4 overflow-auto border border-gray-600">
                    <pre className="text-sm whitespace-pre-wrap text-gray-200 font-mono">
                      {previewContent}
                    </pre>
                  </div>
                ) : (
                  <div className="text-gray-400">Click on a commit to preview its content</div>
                )}
              </div>
            ) : (
              <div className="text-gray-400">Select a commit to view its content</div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitHistory;