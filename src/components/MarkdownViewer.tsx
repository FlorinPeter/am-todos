import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AIChat from './AIChat';
import GitHistory from './GitHistory';
import { processChatMessage } from '../services/aiService';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';
import { saveDraft, getDraft, clearDraft, TodoDraft } from '../utils/localStorage';
import logger from '../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MarkdownViewerProps {
  content: string;
  chatHistory: ChatMessage[];
  onMarkdownChange: (newContent: string) => void;
  onChatHistoryChange: (newChatHistory: ChatMessage[]) => void;
  filePath?: string;
  taskId?: string; // Add taskId for checkpoint management
  todoId?: string; // SHA-based ID for draft persistence
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  content, 
  chatHistory, 
  onMarkdownChange, 
  onChatHistoryChange,
  filePath,
  taskId,
  todoId
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewContent, setViewContent] = useState(content); // Track content for view mode
  const [showHistory, setShowHistory] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false); // Track if draft was restored

  // Draft restoration and content initialization
  React.useEffect(() => {
    setDraftRestored(false);
    
    // Try to restore draft if we have todoId and filePath
    if (todoId && filePath) {
      try {
        const savedDraft = getDraft(todoId, filePath);
        
        if (savedDraft) {
          // Restore draft content and enter edit mode
          setEditContent(savedDraft.editContent);
          setViewContent(savedDraft.viewContent);
          setHasUnsavedChanges(savedDraft.hasUnsavedChanges);
          setDraftRestored(true);
          setIsEditMode(true); // Automatically enter edit mode when draft is restored
          logger.log(`Draft restored for todo: ${filePath}`);
          return;
        }
      } catch (error) {
        // Handle corrupted draft data gracefully
        logger.error('Failed to restore draft:', error);
      }
    }
    
    // No draft found or no draft info - use original content
    setEditContent(content);
    setViewContent(content);
    setHasUnsavedChanges(false);
  }, [content, todoId, filePath]);

  // Auto-save draft when content changes
  const saveDraftIfNeeded = React.useCallback(() => {
    if (todoId && filePath && hasUnsavedChanges) {
      try {
        const draft: TodoDraft = {
          todoId,
          path: filePath,
          editContent,
          viewContent,
          hasUnsavedChanges,
          timestamp: Date.now()
        };
        saveDraft(draft);
      } catch (error) {
        // Handle localStorage errors gracefully - auto-save is not critical
        logger.error('Failed to auto-save draft:', error);
      }
    }
  }, [todoId, filePath, editContent, viewContent, hasUnsavedChanges]);

  // Auto-save draft when content changes (debounced)
  React.useEffect(() => {
    if (hasUnsavedChanges) {
      const timeoutId = setTimeout(saveDraftIfNeeded, 500); // 500ms debounce
      return () => clearTimeout(timeoutId);
    }
  }, [hasUnsavedChanges, saveDraftIfNeeded]);

  // Create checkbox coordinate mapping (line, char position)
  const createCheckboxCoordinates = React.useMemo(() => {
    const currentContent = isEditMode ? editContent : viewContent;
    const lines = currentContent.split('\n');
    const checkboxCoordinates: { line: number; char: number; content: string }[] = [];
    
    // Find exact coordinates of each checkbox
    lines.forEach((line, lineIndex) => {
      if (/^\s*-\s*\[[ xX]\]/.test(line)) {
        const charIndex = line.indexOf('[');
        const content = line.replace(/^\s*-\s*\[[ xX]\]\s*/, '').trim();
        checkboxCoordinates.push({ line: lineIndex, char: charIndex, content });
      }
    });
    return checkboxCoordinates;
  }, [isEditMode, editContent, viewContent]);

  // Interactive checkbox toggle with exact coordinate targeting
  const handleCheckboxToggle = (line: number, char: number) => {
    const contentToUpdate = isEditMode ? editContent : viewContent;
    const lines = contentToUpdate.split('\n');
    const currentLine = lines[line];
    
    if (currentLine && char >= 0 && char + 1 < currentLine.length) {
      const currentChar = currentLine[char + 1]; // The character inside the brackets
      const newChar = currentChar === ' ' ? 'x' : ' ';
      
      // Direct character replacement at exact position
      const newLine = currentLine.substring(0, char + 1) + newChar + currentLine.substring(char + 2);
      lines[line] = newLine;
      const newContent = lines.join('\n');
      
      if (isEditMode) {
        setEditContent(newContent);
        setHasUnsavedChanges(true);
      } else {
        setViewContent(newContent);
        setHasUnsavedChanges(true);
        // Auto-save in view mode for immediate GitHub sync
        onMarkdownChange(newContent);
      }
    }
  };

  const handleChatMessage = async (
    message: string, 
    currentContent: string
  ): Promise<string> => {
    // Always work with the latest frontend content, no persistent chat history
    const updatedContent = await processChatMessage(message, currentContent, []);
    return updatedContent;
  };

  const handleContentUpdate = (newContent: string) => {
    if (isEditMode) {
      // In edit mode, update the edit content without saving
      setEditContent(newContent);
      setHasUnsavedChanges(newContent !== content);
    } else {
      // In view mode, switch to edit mode and update the edit content
      // This ensures AI updates are treated as manual edits and get drafted
      setIsEditMode(true);
      setEditContent(newContent);
      setViewContent(newContent);
      setHasUnsavedChanges(newContent !== content);
    }
    // No chat history saving - AI chat is now stateless
  };

  const handleEditModeToggle = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch modes?')) {
        if (isEditMode) {
          // Switching from edit to view - sync viewContent with editContent
          setViewContent(editContent);
          setIsEditMode(false);
        } else {
          // Switching from view to edit - sync editContent with viewContent
          setEditContent(viewContent);
          setIsEditMode(true);
        }
      }
    } else {
      setIsEditMode(!isEditMode);
      if (!isEditMode) {
        // Switching to edit mode - sync editContent with viewContent
        setEditContent(viewContent);
      } else {
        // Switching to view mode - sync viewContent with editContent
        setViewContent(editContent);
      }
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
    setHasUnsavedChanges(e.target.value !== content);
  };

  // Update unsaved changes detection when viewContent changes
  React.useEffect(() => {
    setHasUnsavedChanges(viewContent !== content || editContent !== content);
  }, [viewContent, editContent, content]);

  const handleSave = () => {
    const contentToSave = isEditMode ? editContent : viewContent;
    
    // Clear draft since we're saving to GitHub
    try {
      clearDraft();
    } catch (error) {
      logger.error('Failed to clear draft:', error);
    }
    setDraftRestored(false);
    
    // Update the view content immediately to show the saved version
    setViewContent(contentToSave);
    setEditContent(contentToSave);
    setHasUnsavedChanges(false);
    setIsEditMode(false);
    
    // Call parent to save to GitHub
    onMarkdownChange(contentToSave);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        // Clear draft since we're discarding changes
        try {
          clearDraft();
        } catch (error) {
          logger.error('Failed to clear draft:', error);
        }
        setDraftRestored(false);
        
        setEditContent(content);
        setViewContent(content);
        setHasUnsavedChanges(false);
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(false);
    }
  };

  const handleRestoreFromHistory = (restoredContent: string, commitSha: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Restoring from history will discard them. Continue?')) {
        return;
      }
    }
    
    // Parse the restored content to separate frontmatter from markdown for display
    const { markdownContent } = parseMarkdownWithFrontmatter(restoredContent);
    
    // Set the restored content for display
    setEditContent(markdownContent);
    setViewContent(markdownContent);
    setHasUnsavedChanges(true); // Mark as unsaved since we need to commit the restore
    setIsEditMode(false); // Switch to view mode to show the restored content
    
    // Optionally auto-save the restored content - pass only the markdown content 
    if (window.confirm(`Restore content from commit ${commitSha.substring(0, 7)}? This will save the restored version immediately.`)) {
      onMarkdownChange(markdownContent);
      setHasUnsavedChanges(false);
    }
  };

  const handleCheckpointRestore = (restoredContent: string) => {
    // Parse the restored content to separate frontmatter from markdown for display
    const { markdownContent } = parseMarkdownWithFrontmatter(restoredContent);
    
    // Set the restored content for display (always mark as unsaved for manual save)
    if (isEditMode) {
      setEditContent(markdownContent);
    } else {
      setViewContent(markdownContent);
    }
    setHasUnsavedChanges(true); // Mark as unsaved since user needs to save manually
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Edit/View Mode Toggle */}
      <div className="bg-gray-700 border-b border-gray-600 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-2 min-w-0">
            <button
              onClick={handleEditModeToggle}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex-shrink-0 min-h-[32px] flex items-center justify-center ${
                isEditMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
              }`}
            >
              {isEditMode ? 'View' : 'Edit'}
            </button>
            {hasUnsavedChanges && (
              <span className="text-yellow-400 text-xs sm:text-sm whitespace-nowrap">
                • {draftRestored ? 'Draft restored' : 'Unsaved'}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* History button */}
            {filePath && (
              <button
                onClick={() => setShowHistory(true)}
                className="px-3 py-1.5 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors hidden sm:block min-h-[32px] flex items-center justify-center"
                title="View History"
              >
                📜 History
              </button>
            )}
            {filePath && (
              <button
                onClick={() => setShowHistory(true)}
                className="px-2 py-1.5 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors sm:hidden min-h-[32px] flex items-center justify-center"
                title="View History"
              >
                📜
              </button>
            )}
            
            {(isEditMode || hasUnsavedChanges) && (
              <>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1.5 sm:px-3 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors min-h-[32px] flex items-center justify-center"
                >
                  <span className="hidden sm:inline">Cancel</span>
                  <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges}
                  className={`px-2 py-1.5 sm:px-3 rounded text-sm font-medium transition-colors min-h-[32px] flex items-center justify-center ${
                    hasUnsavedChanges
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-500 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="hidden sm:inline">Save</span>
                  <span className="sm:hidden">💾</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {isEditMode ? (
          <textarea
            value={editContent}
            onChange={handleEditChange}
            className="w-full h-96 bg-gray-900 text-white p-4 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-vertical"
            placeholder="Edit your markdown content here..."
          />
        ) : (
          <div className="markdown-content">
            {(() => {
              // Manual markdown parsing for precise checkbox control
              const currentContent = isEditMode ? editContent : viewContent;
              const lines = currentContent.split('\n');
              
              return (
                <div>
                  {lines.map((line, lineIndex) => {
                    // Check if this line contains a task list checkbox
                    const checkboxMatch = line.match(/^(\s*-\s*)\[([x ])\](.*)$/i);
                    
                    if (checkboxMatch) {
                      const [, prefix, checkState, suffix] = checkboxMatch;
                      const isChecked = checkState.toLowerCase() === 'x';
                      const charPos = line.indexOf('[');
                      const taskText = suffix.trim();
                      
                      return (
                        <div key={`task-${lineIndex}`} className="flex items-start mb-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCheckboxToggle(lineIndex, charPos)}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                handleCheckboxToggle(lineIndex, charPos);
                              }
                            }}
                            className="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 cursor-pointer hover:bg-gray-600 transition-colors"
                            aria-label={`Toggle task completion: ${taskText}`}
                          />
                          <span className="text-gray-300">
                            {taskText.startsWith('**') && taskText.endsWith('**') ? (
                              <strong className="font-semibold text-white">
                                {taskText.slice(2, -2)}
                              </strong>
                            ) : (
                              taskText
                            )}
                          </span>
                        </div>
                      );
                    } else if (line.trim()) {
                      // Regular content line - render with ReactMarkdown
                      return (
                        <ReactMarkdown
                          key={`content-${lineIndex}`}
                          remarkPlugins={[remarkGfm]}
                          components={{
                            input: ({ node, ...props }: any) => {
                              // Prevent any checkbox processing in regular content
                              return props.type === 'checkbox' ? null : <input {...props} />;
                            },
                            h1: ({ children }) => (
                              <h1 className="text-3xl font-bold text-white mb-6 mt-8 pb-2 border-b border-gray-600">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-2xl font-semibold text-white mb-4 mt-6">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-xl font-medium text-white mb-3 mt-5">
                                {children}
                              </h3>
                            ),
                            h4: ({ children }) => (
                              <h4 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                                {children}
                              </h4>
                            ),
                            p: ({ children }) => (
                              <p className="text-gray-300 mb-4 leading-relaxed">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="space-y-2 mb-4 ml-6">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="space-y-2 mb-4 ml-6 list-decimal list-outside">
                                {children}
                              </ol>
                            ),
                            li: ({ children, ...props }) => (
                              <li className="text-gray-300 mb-1 list-disc list-outside" {...props}>
                                {children}
                              </li>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-gray-800 rounded-r">
                                <div className="text-gray-300 italic">
                                  {children}
                                </div>
                              </blockquote>
                            ),
                            code: ({ children, ...props }: any) => {
                              const { inline } = props;
                              return inline ? (
                                <code className="bg-gray-700 text-blue-300 px-2 py-1 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm border border-gray-600">
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-gray-900 border border-gray-600 rounded-lg overflow-x-auto mb-4">
                                {children}
                              </pre>
                            ),
                            a: ({ children, href, ...props }) => (
                              <a 
                                href={href} 
                                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                              >
                                {children}
                              </a>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-gray-200">
                                {children}
                              </em>
                            ),
                            hr: () => (
                              <hr className="border-gray-600 my-6" />
                            ),
                          }}
                        >
                          {line}
                        </ReactMarkdown>
                      );
                    } else {
                      // Empty line
                      return <div key={`empty-${lineIndex}`} className="mb-4" />;
                    }
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      
      {/* AI Chat - available in both modes, uses appropriate content */}
      <div className="relative">
        {hasUnsavedChanges && (
          <div className="bg-blue-900/50 text-blue-200 text-sm p-2 border-t border-blue-700">
            💡 AI changes will be applied to your draft. Use the Save button above to commit changes.
          </div>
        )}
        <AIChat
          currentContent={isEditMode ? editContent : viewContent}
          onContentUpdate={handleContentUpdate}
          onChatMessage={handleChatMessage}
          taskId={taskId}
          todoId={todoId}
          filePath={filePath}
          onCheckpointRestore={handleCheckpointRestore}
        />
      </div>
      
      {/* Git History Modal */}
      {showHistory && filePath && (
        <GitHistory
          filePath={filePath}
          onRestore={handleRestoreFromHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

export default MarkdownViewer;
