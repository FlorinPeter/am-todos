import React, { useState } from 'react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import AIChat from './AIChat';
import GitHistory from './GitHistory';
import CodeMirrorEditor from './CodeMirrorEditor';
import MarkdownCheckbox from './MarkdownCheckbox';
import { processChatMessage } from '../services/aiService';
import { saveDraft, getDraft, clearDraft, TodoDraft } from '../utils/localStorage';
import { preprocessMarkdownCheckboxes, updateContentWithCheckboxStates, CheckboxData } from '../utils/checkboxPreprocessor';
import { ChatMessage, TodoFrontmatter } from '../types';
import { stringifyMarkdownWithMetadata } from '../utils/markdown';
import logger from '../utils/logger';


interface MarkdownViewerProps {
  content: string;
  frontmatter: TodoFrontmatter; // Add frontmatter for reconstructing complete content
  chatHistory: ChatMessage[];
  onMarkdownChange: (newContent: string) => void;
  onChatHistoryChange: (newChatHistory: ChatMessage[]) => void;
  filePath?: string;
  taskId?: string; // Add taskId for checkpoint management
  todoId?: string; // SHA-based ID for draft persistence
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  content, 
  frontmatter,
  chatHistory, 
  onMarkdownChange, 
  onChatHistoryChange,
  filePath,
  taskId,
  todoId,
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

  // Pure React checkbox processing - preprocesses content and creates registry
  const { processedContent, checkboxRegistry } = React.useMemo(() => {
    const currentContent = isEditMode ? editContent : viewContent;
    return preprocessMarkdownCheckboxes(currentContent);
  }, [isEditMode, editContent, viewContent]);

  // Mutable checkbox registry for state updates
  const mutableCheckboxRegistry = React.useRef<CheckboxData[]>(checkboxRegistry);
  
  // Update mutable registry when checkbox registry changes
  React.useEffect(() => {
    mutableCheckboxRegistry.current = [...checkboxRegistry];
  }, [checkboxRegistry]);
  
  // Pure React checkbox toggle handler
  const handleCheckboxToggle = React.useCallback((checkboxIndex: number) => {
    logger.debug(`🔄 TOGGLE: Checkbox ${checkboxIndex} clicked`);
    
    const registry = mutableCheckboxRegistry.current;
    const checkboxEntry = registry[checkboxIndex];
    
    if (!checkboxEntry) {
      console.error(`❌ TOGGLE ERROR: No registry entry for index ${checkboxIndex}`);
      return;
    }
    
    // Update checkbox state in mutable registry
    checkboxEntry.isChecked = !checkboxEntry.isChecked;
    
    // Update content with new checkbox states
    const originalContent = isEditMode ? editContent : viewContent;
    const newContent = updateContentWithCheckboxStates(originalContent, registry);
    
    logger.debug(`✅ TOGGLE SUCCESS: Checkbox ${checkboxIndex} ("${checkboxEntry.content}") -> ${checkboxEntry.isChecked ? 'checked' : 'unchecked'}`);
    
    if (isEditMode) {
      setEditContent(newContent);
      setHasUnsavedChanges(true);
    } else {
      setViewContent(newContent);
      setHasUnsavedChanges(true);
      // Auto-save in view mode for immediate GitHub sync
      onMarkdownChange(newContent);
    }
  }, [isEditMode, editContent, viewContent, onMarkdownChange]);



  // Helper function to reconstruct complete content with frontmatter for AI processing
  const reconstructCompleteContent = React.useCallback((markdownContent: string) => {
    return stringifyMarkdownWithMetadata(frontmatter, markdownContent);
  }, [frontmatter]);

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
    
    // Reconstruct complete content with frontmatter
    const completeContent = reconstructCompleteContent(currentContent);
    const response = await processChatMessage(message, completeContent, historyForAI);
    return response;
  }, [reconstructCompleteContent]);

  // Helper function to strip frontmatter from AI responses
  const stripFrontmatter = React.useCallback((content: string): string => {
    // Check if content starts with frontmatter (handle both "---\n" and "--- \n")
    if (content.startsWith('---\n') || content.startsWith('--- \n')) {
      // Find the closing frontmatter delimiter
      const frontmatterEndPattern = /\n---\s*\n/;
      const match = content.match(frontmatterEndPattern);
      if (match) {
        // Return content after the closing frontmatter delimiter
        const endIndex = match.index! + match[0].length;
        return content.substring(endIndex);
      }
    }
    return content;
  }, []);

  const handleContentUpdate = (newContent: string) => {
    // Strip frontmatter from AI responses before updating content
    // AI responses may include frontmatter, but the editor should only show markdown
    const contentToUpdate = stripFrontmatter(newContent);
    
    if (contentToUpdate !== newContent) {
      logger.log('AI Chat: Stripped frontmatter from AI response');
    }

    if (isEditMode) {
      // In edit mode, update the edit content without saving
      setEditContent(contentToUpdate);
      setHasUnsavedChanges(contentToUpdate !== content);
    } else {
      // In view mode, switch to edit mode and update the edit content
      // This ensures AI updates are treated as manual edits and get drafted
      setIsEditMode(true);
      setEditContent(contentToUpdate);
      setViewContent(contentToUpdate);
      setHasUnsavedChanges(contentToUpdate !== content);
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
            <MarkdownPreview
              source={processedContent}
              data-color-mode="dark"
              style={{
                backgroundColor: 'transparent',
                color: '#d1d5db',
              }}
              className="github-markdown-dark"
              components={{
                h1: ({ node, children, ...props }: any) => {
                  return <h1 {...props} className="text-3xl font-bold mb-4 text-white border-b border-gray-600 pb-2">{children}</h1>;
                },
                h2: ({ node, children, ...props }: any) => {
                  return <h2 {...props} className="text-2xl font-semibold mb-3 text-white">{children}</h2>;
                },
                h3: ({ node, children, ...props }: any) => {
                  return <h3 {...props} className="text-xl font-medium mb-2 text-white">{children}</h3>;
                },
                h4: ({ node, children, ...props }: any) => {
                  return <h4 {...props} className="text-lg font-medium mb-2 text-white">{children}</h4>;
                },
                h5: ({ node, children, ...props }: any) => {
                  return <h5 {...props} className="text-base font-medium mb-1 text-white">{children}</h5>;
                },
                h6: ({ node, children, ...props }: any) => {
                  return <h6 {...props} className="text-sm font-medium mb-1 text-white">{children}</h6>;
                },
                a: ({ node, children, ...props }: any) => {
                  // Open external links in new tab
                  if (props.href && (props.href.startsWith('http://') || props.href.startsWith('https://'))) {
                    return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
                  }
                  return <a {...props}>{children}</a>;
                },
                // Helper function to extract text from React elements recursively
                ...((() => {
                  const extractTextFromChildren = (children: any): string => {
                    if (typeof children === 'string') {
                      return children;
                    }
                    if (typeof children === 'number') {
                      return String(children);
                    }
                    if (Array.isArray(children)) {
                      return children.map(extractTextFromChildren).join('');
                    }
                    if (children && typeof children === 'object') {
                      if (children.props?.children !== undefined) {
                        return extractTextFromChildren(children.props.children);
                      }
                      if (children.children !== undefined) {
                        return extractTextFromChildren(children.children);
                      }
                    }
                    return '';
                  };

                  return {
                    // Custom list item component to handle checkbox tokens
                    li: ({ node, children, ...props }: any) => {
                      const text = extractTextFromChildren(children);
                      const hasToken = text.includes('XCHECKBOXX');
                      
                      const checkboxTokenMatch = text.match(/XCHECKBOXX(\d+)XENDX/);
                      if (checkboxTokenMatch) {
                        const checkboxIndex = parseInt(checkboxTokenMatch[1], 10);
                        const checkboxData = checkboxRegistry[checkboxIndex];
                        
                        if (checkboxData) {
                          // Filter out the checkbox token from children, preserve nested content
                          const preservedChildren = React.Children.toArray(children).filter((child: any) => {
                            if (typeof child === 'string') {
                              const hasToken = child.includes(`XCHECKBOXX${checkboxIndex}XENDX`);
                              return !hasToken;
                            }
                            
                            // For React elements, check if they contain the token recursively
                            const childText = extractTextFromChildren(child);
                            const hasToken = childText.includes(`XCHECKBOXX${checkboxIndex}XENDX`);
                            return !hasToken;
                          });
                          
                          return (
                            <div className="checkbox-wrapper mb-2 relative">
                              <div className="flex items-start">
                                <MarkdownCheckbox
                                  key={`checkbox-${checkboxIndex}`}
                                  index={checkboxIndex}
                                  isChecked={checkboxData.isChecked}
                                  content={checkboxData.content}
                                  onToggle={handleCheckboxToggle}
                                />
                              </div>
                              {preservedChildren.length > 0 && (
                                <div style={{ marginLeft: '-12px' }} className="mt-1">
                                  {preservedChildren}
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          console.error('❌ REGISTRY MISMATCH:', {
                            tokenIndex: checkboxIndex,
                            registrySize: checkboxRegistry.length,
                            availableIndexes: checkboxRegistry.map((_, i) => i),
                            token: checkboxTokenMatch[0]
                          });
                          
                          // Fallback: render as text for debugging
                          return (
                            <li {...props} style={{ color: 'red', fontFamily: 'monospace' }}>
                              DEBUG: Token {checkboxTokenMatch[0]} not found in registry (size: {checkboxRegistry.length})
                              <br />Original children: {JSON.stringify(children)}
                            </li>
                          );
                        }
                      } else if (hasToken) {
                        console.warn('⚠️ TOKEN DETECTION FAILED:', {
                          text: text.substring(0, 200),
                          hasXCHECKBOX: text.includes('XCHECKBOXX'),
                          regexMatch: text.match(/XCHECKBOXX\d+XENDX/g),
                          children: children
                        });
                        
                        // Fallback: render as text for debugging
                        return (
                          <li {...props} style={{ color: 'orange', fontFamily: 'monospace' }}>
                            DEBUG: Token detected but regex failed
                            <br />Text: {text.substring(0, 100)}
                            <br />Children: {JSON.stringify(children)}
                          </li>
                        );
                      }
                      
                      return <li {...props}>{children}</li>;
                    },
                    // Override ul to detect and handle checkbox-containing lists
                    ul: ({ node, children, ...props }: any) => {
                      // Check if this ul contains any checkbox items
                      const hasCheckboxes = React.Children.toArray(children).some((child: any) => {
                        if (child?.props?.children) {
                          const text = extractTextFromChildren(child.props.children);
                          return text.includes('XCHECKBOXX');
                        }
                        return false;
                      });
                      
                      if (hasCheckboxes) {
                        return (
                          <ul {...props} className="checkbox-parent-list">
                            {children}
                          </ul>
                        );
                      }
                      
                      return <ul {...props}>{children}</ul>;
                    }
                  };
                })()),
              }}
              wrapperElement={{
                'data-color-mode': 'dark'
              }}
            />
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
