import React, { useState, useEffect, useCallback } from 'react';
import { getFileHistory, getFileAtCommit } from '../services/gitService';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';
import { parseFilenameMetadata, parseLegacyFilenameMetadata, FileMetadata } from '../utils/filenameMetadata';
import { TodoFrontmatter } from '../types';

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  filePath?: string; // Enhanced: Track which file path was used for this commit
  frontmatter?: TodoFrontmatter | null; // Enhanced: Optional parsed frontmatter
  metadata?: FileMetadata | null; // Enhanced: Filename-based metadata
  contentLoaded?: boolean; // Track if we've tried to load content for this commit
}

interface GitHistoryProps {
  filePath: string;
  onRestore: (content: string, commitSha: string) => void;
  onClose: () => void;
}

// Enhanced: Performance optimization - frontmatter and metadata cache
const frontmatterCache = new Map<string, { frontmatter: TodoFrontmatter | null; timestamp: number }>();
const metadataCache = new Map<string, { metadata: FileMetadata | null; timestamp: number }>();
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
  const [previewFileInfo, setPreviewFileInfo] = useState<{
    filePath?: string;
    originalPath?: string;
    foundViaSimilarity?: boolean;
  } | null>(null);

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

  // Enhanced: Performance optimization - cached metadata parsing from filename
  const getCachedMetadata = useCallback((filePath: string): FileMetadata | null => {
    const cacheKey = filePath;
    const cached = metadataCache.get(cacheKey);
    
    // Check if cached result is still valid
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      return cached.metadata;
    }
    
    // Extract metadata from filename
    let metadata: FileMetadata | null;
    
    // Try new format first
    metadata = parseFilenameMetadata(filePath);
    
    // Fall back to legacy format if new format fails
    if (!metadata) {
      metadata = parseLegacyFilenameMetadata(filePath);
    }
    
    // Cache the result
    metadataCache.set(cacheKey, {
      metadata,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries periodically
    if (metadataCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of metadataCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
          metadataCache.delete(key);
        }
      }
    }
    
    return metadata;
  }, []);

  // Enhanced: Load and parse frontmatter and metadata for specific commits
  const loadFrontmatterForCommits = useCallback(async (commitsToLoad: GitCommit[]) => {
    const promises = commitsToLoad.map(async (commit) => {
      if (commit.contentLoaded) return commit; // Already loaded
      
      try {
        const fileData = await getFileAtCommit(filePath, commit.sha);
        const frontmatter = getCachedFrontmatter(fileData.content, commit.sha);
        const metadata = getCachedMetadata(filePath);
        
        return {
          ...commit,
          frontmatter,
          metadata,
          contentLoaded: true
        };
      } catch (error) {
        // If we can't load content, still try to extract metadata from filename
        const metadata = getCachedMetadata(filePath);
        
        return {
          ...commit,
          frontmatter: null,
          metadata,
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
  }, [getCachedFrontmatter, getCachedMetadata, filePath]);

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

    void fetchHistory();
  }, [filePath, loadFrontmatterForCommits]);

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
      setPreviewFileInfo(null);
      
      // Enhanced: Ensure frontmatter is loaded for this commit
      await loadFrontmatterForCommit(commitSha);
      
      const fileData = await getFileAtCommit(filePath, commitSha);
      
      // Store the raw content for restoration
      setRawContent(fileData.content);
      
      // Store file path information for display
      setPreviewFileInfo({
        filePath: fileData.filePath,
        originalPath: fileData.originalPath,
        foundViaSimilarity: fileData.foundViaSimilarity
      });
      
      // Update the commit's filePath if we discovered a historical path
      if (fileData.historicalPathDiscovered && fileData.filePath !== filePath) {
        setCommits(prevCommits => 
          prevCommits.map(commit => 
            commit.sha === commitSha 
              ? { ...commit, filePath: fileData.filePath }
              : commit
          )
        );
      }
      
      // Parse and display only the markdown content (without frontmatter)
      const { markdownContent } = parseMarkdownWithFrontmatter(fileData.content);
      setPreviewContent(markdownContent);
      
      // Auto-switch to preview on mobile after selecting a commit
      setMobileView('preview');
    } catch (err) {
      // Enhanced error handling for renamed files
      let errorMessage = err instanceof Error ? err.message : 'Failed to fetch file content';
      
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        errorMessage = `File not found at this commit. The file might have had a different name or location at this point in history.`;
      }
      
      setError(errorMessage);
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

  // Helper function to extract priority from file path
  const extractPriorityFromPath = useCallback((filePath: string) => {
    const filename = filePath.split('/').pop() || '';
    const priorityMatch = filename.match(/^P([1-5])--/);
    return priorityMatch ? parseInt(priorityMatch[1], 10) : undefined;
  }, []);

  // Simple: Show filename badge when commit has different filename than current file
  const getFilenameBadge = useCallback((commit: GitCommit) => {
    if (!commit.filePath) return null;
    
    const currentFileName = filePath.split('/').pop();
    const commitFileName = commit.filePath.split('/').pop();
    
    // Only show badge if the filename is actually different
    if (currentFileName !== commitFileName) {
      return (
        <span 
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white border border-blue-500"
          title={`File was named: ${commitFileName}`}
        >
          📁 {commitFileName}
        </span>
      );
    }
    
    return null;
  }, [filePath]);

  const renderCommitMetadata = useCallback((commit: GitCommit, index: number) => {
    // Enhanced: Use the historical file path for this commit to extract accurate priority
    
    let priority: number | undefined;
    let isArchived: boolean = false;
    let createdAt: string | undefined;
    
    // Conservative: only show priority when we have reliable data AND not currently loading
    // For commits 1-5: Always reliable (pre-analyzed)  
    // For commits 6+: Only reliable after content is loaded AND not currently being previewed
    const isCurrentlyBeingAnalyzed = (index >= 5 && selectedCommit === commit.sha && loadingPreview);
    const isAnalyzed = (index < 5) || (commit.contentLoaded && !isCurrentlyBeingAnalyzed);
    
    if (isAnalyzed) {
      // This commit has been analyzed - extract priority from the correct path
      const pathToUse = commit.filePath || filePath;
      priority = extractPriorityFromPath(pathToUse);
      
      // Extract other metadata
      if (commit.metadata) {
        priority = priority || commit.metadata.priority;
        createdAt = commit.metadata.date;
        isArchived = pathToUse.includes('/archive/');
      } else if (commit.frontmatter) {
        priority = priority || (commit.frontmatter as any).priority;
        createdAt = (commit.frontmatter as any).createdAt;
        isArchived = (commit.frontmatter as any).isArchived || pathToUse.includes('/archive/');
      } else {
        isArchived = pathToUse.includes('/archive/');
      }
    } else {
      // Not analyzed yet - just extract basic metadata for createdAt
      if (commit.metadata) {
        createdAt = commit.metadata.date;
      } else if (commit.frontmatter) {
        createdAt = (commit.frontmatter as any).createdAt;
      }
    }
    
    // Get filename badge for renamed files
    const filenameBadge = getFilenameBadge(commit);
    
    // Create helpful hint badge when we don't have reliable priority data
    const getHintBadge = () => {
      // Show hint badge for commits that haven't been analyzed yet
      if (!isAnalyzed) {
        return (
          <span 
            className="px-2 py-1 text-xs rounded bg-gray-600 text-gray-300 border border-gray-500 cursor-pointer hover:bg-gray-500 transition-colors"
            title="Click this commit to discover its historical priority"
          >
            👆 Click for details
          </span>
        );
      }
      return null;
    };

    // Show loading state for commits that are being analyzed (clicked but not yet complete)
    const getLoadingBadge = () => {
      if (index >= 5 && selectedCommit === commit.sha && loadingPreview) {
        return (
          <div className="flex items-center gap-1">
            <div className="animate-pulse bg-gray-600 h-4 w-12 rounded"></div>
          </div>
        );
      }
      return null;
    };

    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {priority ? getPriorityBadge(priority) : (getLoadingBadge() || getHintBadge())}
        {isArchived && getArchiveBadge()}
        {filenameBadge}
        {createdAt && formatCreatedDate(createdAt, commit.date)}
      </div>
    );
  }, [getPriorityBadge, getArchiveBadge, formatCreatedDate, getFilenameBadge, filePath, selectedCommit, loadingPreview, extractPriorityFromPath]);

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
                  {commits.map((commit, index) => (
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
                      {renderCommitMetadata(commit, index)}
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
                  {/* Enhanced: File path info for renamed files */}
                  {previewFileInfo && (previewFileInfo.filePath !== filePath || previewFileInfo.foundViaSimilarity) && (
                    <div className="mb-3 p-2 bg-yellow-900/50 rounded border border-yellow-600/50">
                      <div className="text-xs text-yellow-200">
                        {previewFileInfo.foundViaSimilarity ? (
                          <>
                            <span className="font-medium">⚠️ File found via similarity matching</span>
                            <br />
                            Used file: <span className="font-mono">{previewFileInfo.filePath}</span>
                            {previewFileInfo.originalPath && (
                              <>
                                <br />
                                Requested: <span className="font-mono">{previewFileInfo.originalPath}</span>
                              </>
                            )}
                          </>
                        ) : previewFileInfo.filePath !== filePath ? (
                          <>
                            <span className="font-medium">📁 Different filename at this commit</span>
                            <br />
                            Historical name: <span className="font-mono">{previewFileInfo.filePath}</span>
                            <br />
                            Current name: <span className="font-mono">{filePath}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {/* Enhanced: Metadata section for selected commit */}
                  {selectedCommit && (() => {
                    const commit = commits.find(c => c.sha === selectedCommit);
                    if (!commit) return null;
                    
                    // Use the historical file path for this commit if available
                    const historicalPath = commit.filePath || filePath;
                    
                    let priority: number | undefined;
                    let isArchived = false;
                    let createdAt: string | undefined;
                    let title: string | undefined;
                    
                    // Extract priority from the historical filename (most reliable)
                    const priorityFromPath = extractPriorityFromPath(historicalPath);
                    
                    if (commit.metadata) {
                      priority = priorityFromPath || commit.metadata.priority;
                      createdAt = commit.metadata.date;
                      title = commit.metadata.displayTitle;
                      isArchived = historicalPath.includes('/archive/');
                    } else if (commit.frontmatter) {
                      // Legacy fallback
                      priority = priorityFromPath || (commit.frontmatter as any).priority;
                      isArchived = (commit.frontmatter as any).isArchived || historicalPath.includes('/archive/');
                      createdAt = (commit.frontmatter as any).createdAt;
                      title = (commit.frontmatter as any).title;
                    } else {
                      // No metadata available, extract what we can from the path
                      priority = priorityFromPath;
                      isArchived = historicalPath.includes('/archive/');
                    }
                    
                    return (
                      <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Metadata</h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {priority && getPriorityBadge(priority)}
                          {isArchived && getArchiveBadge()}
                          {createdAt && formatCreatedDate(createdAt, commit.date)}
                        </div>
                        {title && (
                          <div className="mt-2 text-sm text-gray-300">
                            <span className="text-gray-400">Title:</span> {title}
                          </div>
                        )}
                      </div>
                    );
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
                    {commits.map((commit, index) => (
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
                        {renderCommitMetadata(commit, index)}
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
                    {/* Enhanced: File path info for renamed files (mobile) */}
                    {previewFileInfo && (previewFileInfo.filePath !== filePath || previewFileInfo.foundViaSimilarity) && (
                      <div className="mb-4 p-3 bg-yellow-900/50 rounded border border-yellow-600/50">
                        <div className="text-sm text-yellow-200">
                          {previewFileInfo.foundViaSimilarity ? (
                            <>
                              <span className="font-medium">⚠️ File found via similarity matching</span>
                              <br />
                              Used file: <span className="font-mono text-xs">{previewFileInfo.filePath}</span>
                              {previewFileInfo.originalPath && (
                                <>
                                  <br />
                                  Requested: <span className="font-mono text-xs">{previewFileInfo.originalPath}</span>
                                </>
                              )}
                            </>
                          ) : previewFileInfo.filePath !== filePath ? (
                            <>
                              <span className="font-medium">📁 Different filename at this commit</span>
                              <br />
                              Historical: <span className="font-mono text-xs">{previewFileInfo.filePath}</span>
                              <br />
                              Current: <span className="font-mono text-xs">{filePath}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )}
                    {/* Enhanced: Metadata section for selected commit (mobile) */}
                    {selectedCommit && (() => {
                      const commit = commits.find(c => c.sha === selectedCommit);
                      if (!commit?.metadata && !commit?.frontmatter) return null;
                      
                      let priority: number | undefined;
                      let isArchived: boolean = false;
                      let createdAt: string | undefined;
                      let title: string | undefined;
                      
                      if (commit.metadata) {
                        priority = commit.metadata.priority;
                        createdAt = commit.metadata.date;
                        title = commit.metadata.displayTitle;
                        isArchived = filePath.includes('/archive/');
                      } else if (commit.frontmatter) {
                        // Legacy fallback
                        priority = (commit.frontmatter as any).priority;
                        isArchived = (commit.frontmatter as any).isArchived || false;
                        createdAt = (commit.frontmatter as any).createdAt;
                        title = (commit.frontmatter as any).title;
                      }
                      
                      return (
                        <div className="mb-4 p-3 bg-gray-900 rounded border border-gray-600">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Metadata</h4>
                          <div className="flex flex-wrap items-center gap-2">
                            {priority && getPriorityBadge(priority)}
                            {isArchived && getArchiveBadge()}
                            {createdAt && formatCreatedDate(createdAt, commit.date)}
                          </div>
                          {title && (
                            <div className="mt-2 text-sm text-gray-300">
                              <span className="text-gray-400">Title:</span> {title}
                            </div>
                          )}
                        </div>
                      );
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