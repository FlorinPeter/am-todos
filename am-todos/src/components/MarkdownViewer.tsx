import React from 'react';
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

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="prose prose-invert max-w-none p-6">
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
      <AIChat
        currentContent={content}
        chatHistory={chatHistory}
        onContentUpdate={handleContentUpdate}
        onChatMessage={handleChatMessage}
      />
    </div>
  );
};

export default MarkdownViewer;
