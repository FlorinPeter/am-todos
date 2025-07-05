import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AIChat from './AIChat';
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
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ 
  content, 
  chatHistory, 
  onMarkdownChange, 
  onChatHistoryChange 
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Update editContent when content prop changes
  React.useEffect(() => {
    setEditContent(content);
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
    currentContent: string, 
    chatHistory: ChatMessage[]
  ): Promise<string> => {
    const updatedContent = await processChatMessage(message, currentContent, chatHistory);
    return updatedContent;
  };

  const handleContentUpdate = (newContent: string, newChatHistory: ChatMessage[]) => {
    onMarkdownChange(newContent);
    onChatHistoryChange(newChatHistory);
  };

  const handleEditModeToggle = () => {
    if (isEditMode && hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to switch to view mode?')) {
        setIsEditMode(false);
        setEditContent(content);
        setHasUnsavedChanges(false);
      }
    } else {
      setIsEditMode(!isEditMode);
      if (!isEditMode) {
        setEditContent(content);
      }
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
    setHasUnsavedChanges(e.target.value !== content);
  };

  const handleSave = () => {
    console.log('MarkdownViewer: Saving content...', editContent.substring(0, 100));
    onMarkdownChange(editContent);
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        setEditContent(content);
        setHasUnsavedChanges(false);
        setIsEditMode(false);
      }
    } else {
      setIsEditMode(false);
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
        
        {isEditMode && (
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
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                input: ({ node, ...props }) => {
                  if (props.type === 'checkbox') {
                    const lineNum = node?.position?.start.line;
                    return <input {...props} onChange={handleCheckboxChange} data-line={lineNum} />;
                  }
                  return <input {...props} />;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      
      {/* AI Chat - only show in view mode */}
      {!isEditMode && (
        <AIChat
          currentContent={content}
          chatHistory={chatHistory}
          onContentUpdate={handleContentUpdate}
          onChatMessage={handleChatMessage}
        />
      )}
    </div>
  );
};

export default MarkdownViewer;
