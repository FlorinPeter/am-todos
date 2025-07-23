import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFileHistory, getFileAtCommit } from '../services/gitService';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';
import { TodoFrontmatter } from '../types';

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  frontmatter?: TodoFrontmatter | null; // Enhanced: Optional parsed frontmatter
  contentLoaded?: boolean; // Track if we've tried to load content for this commit
}

interface GitHistoryProps {
  filePath: string;
  onRestore: (content: string, commitSha: string) => void;
  onClose: () => void;
}

// Enhanced: Performance optimization - frontmatter cache
const frontmatterCache = new Map<string, { frontmatter: TodoFrontmatter | null; timestamp: number }>();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

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
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mobileView, setMobileView] = useState<'commits' | 'preview'>('commits');

  // Enhanced: Performance optimization - cached frontmatter parsing
  const getCachedFrontmatter = useCallback((content: string, commitSha: string): TodoFrontmatter | null => {
    const cacheKey = `${commitSha}-${content.length}`;
    const cached = frontmatterCache.get(cacheKey);
    
    // Check if cached result is still valid
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      return cached.frontmatter;
    }
    
    // Parse and cache the result
    const { frontmatter } = parseMarkdownWithFrontmatter(content);
    frontmatterCache.set(cacheKey, {
      frontmatter,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (frontmatterCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of frontmatterCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
          frontmatterCache.delete(key);
        }
      }
    }
    
    return frontmatter;
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const history = await getFileHistory(filePath);
        setCommits(history);
        
        // Load frontmatter for first 5 commits upfront for better UX
        await loadFrontmatterForCommits(history.slice(0, 5));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch git history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [filePath]);

  // Enhanced: Load and parse frontmatter for specific commits
  const loadFrontmatterForCommits = async (commitsToLoad: GitCommit[]) => {
    const promises = commitsToLoad.map(async (commit) => {
      if (commit.contentLoaded) return commit; // Already loaded
      
      try {
        const fileData = await getFileAtCommit(filePath, commit.sha);
        const frontmatter = getCachedFrontmatter(fileData.content, commit.sha);
        
        return {
          ...commit,
          frontmatter,
          contentLoaded: true
        };
      } catch (error) {
        // If we can't load content, mark as loaded but with null frontmatter
        return {
          ...commit,
          frontmatter: null,
          contentLoaded: true
        };
      }
    });

    const updatedCommits = await Promise.all(promises);
    
    setCommits(prevCommits => 
      prevCommits.map(commit => {
        const updated = updatedCommits.find(u => u.sha === commit.sha);
        return updated || commit;
      })
    );
  };

  // Enhanced: Load frontmatter for a single commit on-demand
  const loadFrontmatterForCommit = async (commitSha: string) => {
    const commit = commits.find(c => c.sha === commitSha);
    if (!commit || commit.contentLoaded) return;

    await loadFrontmatterForCommits([commit]);
  };

  const handlePreview = async (commitSha: string) => {
    try {
      setLoadingPreview(true);
      setSelectedCommit(commitSha);
      
      // Enhanced: Ensure frontmatter is loaded for this commit
      await loadFrontmatterForCommit(commitSha);
      
      const fileData = await getFileAtCommit(filePath, commitSha);
      
      // Store the raw content for restoration
      setRawContent(fileData.content);
      
      // Parse and display only the markdown content (without frontmatter)
      const { markdownContent } = parseMarkdownWithFrontmatter(fileData.content);
      setPreviewContent(markdownContent);
      
      // Auto-switch to preview on mobile after selecting a commit
      setMobileView('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch file content');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestore = () => {
    if (selectedCommit && rawContent !== null) {
      onRestore(rawContent, selectedCommit);
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Enhanced: Helper functions for metadata display (memoized for performance)
  const getPriorityBadge = useCallback((priority: number) => {
    const priorityColors = {
      1: 'bg-red-600 text-white',
      2: 'bg-orange-600 text-white', 
      3: 'bg-yellow-600 text-white',
      4: 'bg-blue-600 text-white',
      5: 'bg-gray-600 text-white'
    };
    
    const color = priorityColors[priority as keyof typeof priorityColors] || 'bg-gray-600 text-white';
    return (
      <span className={`px-2 py-1 text-xs rounded font-medium ${color}`}>
        P{priority}
      </span>
    );
  }, []);

  const getArchiveBadge = useCallback(() => (
    <span className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 border border-gray-600">
      📁 ARCHIVED
    </span>
  ), []);

  const formatCreatedDate = useCallback((createdAt: string, commitDate: string) => {
    const created = new Date(createdAt);
    const commit = new Date(commitDate);
    const diffDays = Math.abs(commit.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    
    // Only show createdAt if it differs significantly from commit date
    if (diffDays > 1) {
      return (
        <span className="text-xs text-gray-400">
          Created: {created.toLocaleDateString()}
        </span>
      );
    }
    return null;
  }, []);

  const renderCommitMetadata = useCallback((commit: GitCommit) => {
    if (!commit.frontmatter) {
      // Show loading indicator if we haven't tried to load content yet
      if (!commit.contentLoaded) {
        return (
          <div className="flex items-center gap-1 mt-1">
            <div className="animate-pulse bg-gray-600 h-4 w-8 rounded"></div>
          </div>
        );
      }
      return null; // No frontmatter available
    }

    const { priority, isArchived, createdAt } = commit.frontmatter;
    
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {getPriorityBadge(priority)}
        {isArchived && getArchiveBadge()}
        {formatCreatedDate(createdAt, commit.date)}
      </div>
    );
  }, [getPriorityBadge, getArchiveBadge, formatCreatedDate]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 pt-8 sm:pt-4 pb-4">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-6xl max-h-[85vh] sm:max-h-[95vh] overflow-hidden flex flex-col border border-gray-700 mt-4 sm:mt-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-xl font-bold text-white truncate pr-2 leading-tight">Git History</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl flex-shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="flex sm:hidden mb-4 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setMobileView('commits')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mobileView === 'commits'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Commits ({commits.length})
          </button>
          <button
            onClick={() => setMobileView('preview')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              mobileView === 'preview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white'
            }`}
            disabled={!selectedCommit}
          >
            Preview {selectedCommit ? '✓' : ''}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop: Side-by-side layout */}
          <div className="hidden sm:flex w-full">
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
                      {renderCommitMetadata(commit)}
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
                      disabled={rawContent === null}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Restore This Version
                    </button>
                  </div>
                  {/* Enhanced: Metadata section for selected commit */}
                  {selectedCommit && (() => {
                    const commit = commits.find(c => c.sha === selectedCommit);
                    return commit?.frontmatter ? (
                      <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Metadata</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {getPriorityBadge(commit.frontmatter.priority)}
                          {commit.frontmatter.isArchived && getArchiveBadge()}
                          {formatCreatedDate(commit.frontmatter.createdAt, commit.date)}
                        </div>
                        {commit.frontmatter.title && (
                          <div className="mt-2 text-sm text-gray-300">
                            <span className="text-gray-400">Title:</span> {commit.frontmatter.title}
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
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

          {/* Mobile: Single column with tab switching */}
          <div className="flex sm:hidden w-full overflow-y-auto">
            {mobileView === 'commits' ? (
              <div className="w-full">
                {commits.length === 0 ? (
                  <p className="text-gray-400">No commits found for this file.</p>
                ) : (
                  <div className="space-y-3">
                    {commits.map((commit) => (
                      <div
                        key={commit.sha}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedCommit === commit.sha
                            ? 'bg-blue-900 border-blue-600'
                            : 'bg-gray-700 border-gray-600 hover:bg-gray-600 active:bg-gray-600'
                        }`}
                        onClick={() => handlePreview(commit.sha)}
                      >
                        <div className="font-medium text-sm text-gray-100 mb-2">
                          {commit.message}
                        </div>
                        <div className="text-xs text-gray-300 mb-1">
                          {commit.author} • {formatDate(commit.date)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {commit.sha.substring(0, 7)}
                        </div>
                        {renderCommitMetadata(commit)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full">
                {selectedCommit ? (
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                      <button
                        onClick={() => setMobileView('commits')}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        ← Back to Commits
                      </button>
                      <button
                        onClick={handleRestore}
                        disabled={rawContent === null}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                    {/* Enhanced: Metadata section for selected commit (mobile) */}
                    {selectedCommit && (() => {
                      const commit = commits.find(c => c.sha === selectedCommit);
                      return commit?.frontmatter ? (
                        <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Metadata</h4>
                          <div className="flex flex-wrap items-center gap-2">
                            {getPriorityBadge(commit.frontmatter.priority)}
                            {commit.frontmatter.isArchived && getArchiveBadge()}
                            {formatCreatedDate(commit.frontmatter.createdAt, commit.date)}
                          </div>
                          {commit.frontmatter.title && (
                            <div className="mt-2 text-sm text-gray-300">
                              <span className="text-gray-400">Title:</span> {commit.frontmatter.title}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}
                    {loadingPreview ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        <span className="ml-2 text-gray-200">Loading preview...</span>
                      </div>
                    ) : previewContent ? (
                      <div className="flex-1 bg-gray-900 rounded p-3 overflow-auto border border-gray-600">
                        <pre className="text-xs whitespace-pre-wrap text-gray-200 font-mono leading-relaxed">
                          {previewContent}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-gray-400">Loading preview...</div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-center py-8">Select a commit from the Commits tab to preview its content</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors mb-2 sm:mb-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitHistory;