import React, { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import AIChat from './AIChat';
import GitHistory from './GitHistory';
import CodeMirrorEditor from './CodeMirrorEditor';
import { processChatMessage } from '../services/aiService';
import { parseMarkdownWithFrontmatter } from '../utils/markdown';
import { saveDraft, getDraft, clearDraft, TodoDraft } from '../utils/localStorage';
import { ChatMessage } from '../types';
import logger from '../utils/logger';


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
          stableDraftKey: filePath.trim().toLowerCase(), // Generate stable key from path
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

  // Create checkbox coordinate mapping (line, char position) - memoized for performance
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
  
  // Memoized checkbox toggle handler for performance
  const memoizedHandleCheckboxToggle = React.useCallback((line: number, char: number) => {
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
  }, [isEditMode, editContent, viewContent, onMarkdownChange]);


  // Memoized chat message handler for performance
  const handleChatMessage = React.useCallback(async (
    message: string, 
    currentContent: string,
    chatHistory: ChatMessage[]
  ) => {
    // Convert ChatMessage format to simple format expected by AI service
    const historyForAI = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const response = await processChatMessage(message, currentContent, historyForAI);
    return response;
  }, []);

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
    // Mode switching is always safe since content gets synced between edit and view states
    if (isEditMode) {
      // Switching from edit to view - sync viewContent with editContent
      setViewContent(editContent);
      setIsEditMode(false);
    } else {
      // Switching from view to edit - sync editContent with viewContent
      setEditContent(viewContent);
      setIsEditMode(true);
    }
  };

  const handleEditChange = (value: string) => {
    setEditContent(value);
    setHasUnsavedChanges(value !== content);
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
    
    // FIXED: Preserve the full content including frontmatter
    // Previously only used markdownContent, now we preserve the complete restored content
    
    // Set the restored content for display (keep full content with frontmatter)
    setEditContent(restoredContent);
    setViewContent(restoredContent);
    setHasUnsavedChanges(true); // Mark as unsaved since we need to commit the restore
    setIsEditMode(false); // Switch to view mode to show the restored content
    
    // Auto-save the restored content - pass the full content with frontmatter preserved
    if (window.confirm(`Restore content from commit ${commitSha.substring(0, 7)}? This will save the restored version immediately.`)) {
      onMarkdownChange(restoredContent);
      setHasUnsavedChanges(false);
    }
  };

  const handleCheckpointRestore = (restoredContent: string) => {
    // FIXED: Preserve the full content including frontmatter
    // Previously only used markdownContent, now we preserve the complete restored content
    
    // Set the restored content for display (always mark as unsaved for manual save)
    if (isEditMode) {
      setEditContent(restoredContent);
    } else {
      setViewContent(restoredContent);
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
          <CodeMirrorEditor
            value={editContent}
            onChange={handleEditChange}
            placeholder="Edit your markdown content here..."
            height="24rem"
            className="w-full"
          />
        ) : (
          <div className="markdown-content">
            {(() => {
              // Counter for matching checkboxes to their line positions - reset on each render
              let checkboxCounter = 0;
              
              return (
                <MarkdownPreview
                  source={isEditMode ? editContent : viewContent}
                  data-color-mode="dark"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#d1d5db',
                  }}
                  className="github-markdown-dark"
                  components={{
                    h1: ({ node, ...props }: any) => {
                      return <h1 {...props} className="text-3xl font-bold mb-4 text-white border-b border-gray-600 pb-2" />;
                    },
                    h2: ({ node, ...props }: any) => {
                      return <h2 {...props} className="text-2xl font-semibold mb-3 text-white" />;
                    },
                    h3: ({ node, ...props }: any) => {
                      return <h3 {...props} className="text-xl font-medium mb-2 text-white" />;
                    },
                    h4: ({ node, ...props }: any) => {
                      return <h4 {...props} className="text-lg font-medium mb-2 text-white" />;
                    },
                    h5: ({ node, ...props }: any) => {
                      return <h5 {...props} className="text-base font-medium mb-1 text-white" />;
                    },
                    h6: ({ node, ...props }: any) => {
                      return <h6 {...props} className="text-sm font-medium mb-1 text-white" />;
                    },
                    a: ({ node, ...props }: any) => {
                      // Open external links in new tab
                      if (props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'))) {
                        return <a {...props} target="_blank" rel="noopener noreferrer" />;
                      }
                      return <a {...props} />;
                    },
                    input: ({ node, ...props }: any) => {
                      // Handle task list checkboxes with custom interaction
                      if (props.type === 'checkbox') {
                        const currentContent = isEditMode ? editContent : viewContent;
                        const lines = currentContent.split('\n');
                        
                        // Find the nth checkbox (where n is checkboxCounter)
                        let foundCheckboxes = 0;
                        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                          const line = lines[lineIndex];
                          const checkboxMatch = line.match(/^(\s*-\s*)\[([x ])\](.*)$/i);
                          if (checkboxMatch) {
                            if (foundCheckboxes === checkboxCounter) {
                              const charPos = line.indexOf('[');
                              checkboxCounter++;
                              
                              // Calculate checked state from the actual character in brackets
                              const isChecked = checkboxMatch[2].toLowerCase() === 'x';
                              
                              return (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    // Let checkbox change naturally for mobile compatibility
                                    // Update markdown content to match checkbox state
                                    memoizedHandleCheckboxToggle(lineIndex, charPos);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === ' ' || e.key === 'Enter') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      memoizedHandleCheckboxToggle(lineIndex, charPos);
                                    }
                                  }}
                                  className="w-4 h-4 mr-2 rounded border-gray-400 bg-gray-700 text-blue-500 cursor-pointer hover:bg-gray-600 transition-colors touch-manipulation"
                                  style={{ accentColor: '#3b82f6' }}
                                />
                              );
                            }
                            foundCheckboxes++;
                          }
                        }
                        
                        // Fallback: return a basic checkbox
                        checkboxCounter++;
                        return (
                          <input
                            {...props}
                            className="w-4 h-4 mr-2 rounded border-gray-400 bg-gray-700 text-blue-500"
                            style={{ accentColor: '#3b82f6' }}
                          />
                        );
                      }
                      return <input {...props} />;
                    },
                  }}
                  wrapperElement={{
                    'data-color-mode': 'dark'
                  }}
                />
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
