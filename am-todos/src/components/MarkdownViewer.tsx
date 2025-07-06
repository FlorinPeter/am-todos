import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AIChat from './AIChat';
import GitHistory from './GitHistory';
import { processChatMessage } from '../services/aiService';

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
  token?: string;
  owner?: string;
  repo?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  content, 
  chatHistory, 
  onMarkdownChange, 
  onChatHistoryChange,
  filePath,
  token,
  owner,
  repo
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [viewContent, setViewContent] = useState(content); // Track content for view mode
  const [showHistory, setShowHistory] = useState(false);

  // Update both editContent and viewContent when content prop changes
  React.useEffect(() => {
    setEditContent(content);
    setViewContent(content);
    setHasUnsavedChanges(false);
  }, [content]);
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked, dataset } = e.target;
    const line = parseInt(dataset.line || '0', 10);
    const lines = content.split('\n');
    const currentLine = lines[line];

    if (currentLine) {
      const newLine = currentLine.replace(/\[[ xX]\]/, checked ? '[x]' : '[ ]');
      lines[line] = newLine;
      onMarkdownChange(lines.join('\n'));
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
      // In view mode, update the view content without saving
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
    console.log('MarkdownViewer: Saving content...', contentToSave.substring(0, 100));
    
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
    
    // Set the restored content
    setEditContent(restoredContent);
    setViewContent(restoredContent);
    setHasUnsavedChanges(true); // Mark as unsaved since we need to commit the restore
    setIsEditMode(false); // Switch to view mode to show the restored content
    
    // Optionally auto-save the restored content
    if (window.confirm(`Restore content from commit ${commitSha.substring(0, 7)}? This will save the restored version immediately.`)) {
      onMarkdownChange(restoredContent);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Edit/View Mode Toggle */}
      <div className="bg-gray-700 border-b border-gray-600 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleEditModeToggle}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              isEditMode 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
            }`}
          >
            {isEditMode ? 'View' : 'Edit'}
          </button>
          {hasUnsavedChanges && (
            <span className="text-yellow-400 text-sm">• Unsaved changes</span>
          )}
        </div>
        
        {/* History button */}
        {filePath && token && owner && repo && (
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-1 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors"
          >
            📜 History
          </button>
        )}
        
        {(isEditMode || hasUnsavedChanges) && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                hasUnsavedChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-500 text-gray-400 cursor-not-allowed'
              }`}
            >
              Save
            </button>
          </div>
        )}
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                input: ({ node, ...props }) => {
                  if (props.type === 'checkbox') {
                    const lineNum = node?.position?.start.line;
                    return (
                      <input 
                        {...props} 
                        onChange={handleCheckboxChange} 
                        data-line={lineNum}
                        className="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                      />
                    );
                  }
                  return <input {...props} />;
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
                li: ({ children, ...props }) => {
                  // Check if this is a task list item
                  const isTaskItem = typeof children === 'object' && 
                    Array.isArray(children) && 
                    children.some(child => 
                      typeof child === 'object' && 
                      child?.type === 'input' && 
                      child?.props?.type === 'checkbox'
                    );
                  
                  if (isTaskItem) {
                    return (
                      <li className="flex items-start text-gray-300 mb-2 list-none ml-0" {...props}>
                        {children}
                      </li>
                    );
                  }
                  
                  return (
                    <li className="text-gray-300 mb-1 list-disc list-outside" {...props}>
                      {children}
                    </li>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 bg-gray-800 rounded-r">
                    <div className="text-gray-300 italic">
                      {children}
                    </div>
                  </blockquote>
                ),
                code: ({ children, ...props }: any) => {
                  const { inline } = props;
                  if (inline) {
                    return (
                      <code className="bg-gray-700 text-blue-300 px-2 py-1 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className="block bg-gray-900 text-green-300 p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm border border-gray-600" {...props}>
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
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-4">
                    <table className="min-w-full border border-gray-600 rounded-lg">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-gray-700 text-white font-semibold p-3 text-left border-b border-gray-600">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="text-gray-300 p-3 border-b border-gray-700">
                    {children}
                  </td>
                ),
                hr: () => (
                  <hr className="border-gray-600 my-6" />
                ),
              }}
            >
              {viewContent}
            </ReactMarkdown>
          </div>
        )}
      </div>
      
      {/* AI Chat - available in both modes, uses appropriate content */}
      <div className="relative">
        {hasUnsavedChanges && (
          <div className="bg-blue-900 bg-opacity-50 text-blue-200 text-sm p-2 border-t border-blue-700">
            💡 AI changes will be applied to your draft. Use the Save button above to commit changes.
          </div>
        )}
        <AIChat
          currentContent={isEditMode ? editContent : viewContent}
          onContentUpdate={handleContentUpdate}
          onChatMessage={handleChatMessage}
        />
      </div>
      
      {/* Git History Modal */}
      {showHistory && filePath && token && owner && repo && (
        <GitHistory
          token={token}
          owner={owner}
          repo={repo}
          filePath={filePath}
          onRestore={handleRestoreFromHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

export default MarkdownViewer;
