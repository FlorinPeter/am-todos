import React, { useState, useRef, useEffect } from 'react';
import { saveCheckpoint, getCheckpoints, clearCheckpoints, generateCheckpointId, Checkpoint } from '../utils/localStorage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  checkpointId?: string; // Link to checkpoint for AI responses
}

interface AIChatProps {
  currentContent: string;
  onContentUpdate: (newContent: string) => void;
  onChatMessage: (message: string, currentContent: string) => Promise<string>;
  taskId?: string; // Unique identifier for the current task
  onCheckpointRestore?: (content: string) => void; // Callback for checkpoint restore
}

const AIChat: React.FC<AIChatProps> = ({ 
  currentContent, 
  onContentUpdate, 
  onChatMessage,
  taskId,
  onCheckpointRestore
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localChatHistory, setLocalChatHistory] = useState<ChatMessage[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localChatHistory]);

  // Load checkpoints when taskId changes
  useEffect(() => {
    if (taskId) {
      try {
        const loadedCheckpoints = getCheckpoints(taskId);
        setCheckpoints(loadedCheckpoints);
      } catch (error) {
        console.error('Error loading checkpoints:', error);
        setCheckpoints([]);
      }
    } else {
      setCheckpoints([]);
    }
  }, [taskId]);

  // Clear checkpoints when task changes
  useEffect(() => {
    if (taskId) {
      // Clear chat history when switching tasks
      setLocalChatHistory([]);
    }
  }, [taskId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    const newLocalHistory = [...localChatHistory, userMessage];
    setLocalChatHistory(newLocalHistory);
    setInputMessage('');
    setIsLoading(true);

    // Create checkpoint BEFORE AI response to capture the state before changes
    const checkpointId = generateCheckpointId();
    const checkpoint: Checkpoint = {
      id: checkpointId,
      content: currentContent, // Store the content BEFORE AI modification
      timestamp: new Date().toISOString(),
      chatMessage: inputMessage.trim(),
      description: `Before: ${inputMessage.trim().length > 40 ? inputMessage.trim().substring(0, 40) + '...' : inputMessage.trim()}`
    };

    // Save checkpoint to localStorage if taskId is available
    if (taskId) {
      try {
        saveCheckpoint(taskId, checkpoint);
        setCheckpoints(prev => [...prev, checkpoint]);
      } catch (error) {
        console.error('Error saving checkpoint:', error);
      }
    }

    try {
      const updatedContent = await onChatMessage(inputMessage.trim(), currentContent);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: 'Task updated successfully',
        timestamp: new Date().toISOString(),
        checkpointId: checkpointId
      };

      const finalLocalHistory = [...newLocalHistory, assistantMessage];
      setLocalChatHistory(finalLocalHistory);
      onContentUpdate(updatedContent);
    } catch (error) {
      console.error('Error processing chat message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        timestamp: new Date().toISOString()
      };
      setLocalChatHistory([...newLocalHistory, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCheckpointRestore = (checkpointId: string) => {
    const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
    if (checkpoint && onCheckpointRestore) {
      if (window.confirm(`Restore to the state before this AI response?\n\nRequest: "${checkpoint.description.replace('Before: ', '')}"\nTimestamp: ${new Date(checkpoint.timestamp).toLocaleString()}\n\nThis will replace your current content with the state from before the AI responded. You will need to save manually to persist changes.`)) {
        onCheckpointRestore(checkpoint.content);
      }
    }
  };

  const handleClearCheckpoints = () => {
    if (taskId && window.confirm('Clear all checkpoints for this task? This cannot be undone.')) {
      clearCheckpoints(taskId);
      setCheckpoints([]);
    }
  };

  return (
    <div className="border-t border-gray-700 mt-4">
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center justify-between"
      >
        <span className="flex items-center">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          AI Chat Assistant (Session Only)
          {localChatHistory.length > 0 && (
            <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
              {localChatHistory.length}
            </span>
          )}
        </span>
        <svg 
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chat Interface */}
      {isExpanded && (
        <div className="border-t border-gray-700 bg-gray-800">
          {/* Chat History */}
          <div className="max-h-60 overflow-y-auto p-4 space-y-3">
            {localChatHistory.length === 0 ? (
              <div className="text-gray-500 text-sm text-center py-4">
                <p>Ask me to modify this task! For example:</p>
                <p className="italic mt-2">"Add a step for user authentication"</p>
                <p className="italic">"Rephrase the second item to be more formal"</p>
                <p className="italic">"Add a sub-task for database setup"</p>
              </div>
            ) : (
              localChatHistory.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-200'
                  }`}>
                    <p>{message.content}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      {message.role === 'assistant' && message.checkpointId && onCheckpointRestore && (
                        <button
                          onClick={() => handleCheckpointRestore(message.checkpointId!)}
                          className="text-xs text-blue-300 hover:text-blue-200 underline ml-2"
                          title="Restore to this checkpoint"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-200 px-3 py-2 rounded-lg text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 sm:p-4 border-t border-gray-700">
            {(localChatHistory.length > 0 || checkpoints.length > 0) && (
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-600">
                <div className="flex items-center space-x-4">
                  <span className="text-xs text-gray-400">Session chat (not saved)</span>
                  {checkpoints.length > 0 && (
                    <span className="text-xs text-green-400">
                      {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {checkpoints.length > 0 && (
                    <button
                      onClick={handleClearCheckpoints}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Clear Checkpoints
                    </button>
                  )}
                  {localChatHistory.length > 0 && (
                    <button
                      onClick={() => setLocalChatHistory([])}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Clear Chat
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me to modify this task..."
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChat;