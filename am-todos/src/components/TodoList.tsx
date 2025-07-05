import React from 'react';
import MarkdownViewer from './MarkdownViewer';
import PrioritySelector from './PrioritySelector';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Todo {
  id: string;
  title: string;
  content: string;
  frontmatter: {
    chatHistory: ChatMessage[];
    priority: number;
    createdAt: string;
    isArchived: boolean;
  };
}

interface TodoListProps {
  todos: Todo[];
  onTodoUpdate: (id: string, newContent: string, newChatHistory?: ChatMessage[]) => void;
  onPriorityUpdate: (id: string, newPriority: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, onTodoUpdate, onPriorityUpdate }) => {
  return (
    <div>
      {todos.map((todo) => (
        <div key={todo.id} className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">{todo.title}</h2>
            <PrioritySelector
              priority={todo.frontmatter?.priority || 3}
              onPriorityChange={(newPriority) => onPriorityUpdate(todo.id, newPriority)}
            />
          </div>
          <MarkdownViewer
            content={todo.content}
            chatHistory={todo.frontmatter?.chatHistory || []}
            onMarkdownChange={(newContent) => onTodoUpdate(todo.id, newContent)}
            onChatHistoryChange={(newChatHistory) => onTodoUpdate(todo.id, todo.content, newChatHistory)}
          />
        </div>
      ))}
    </div>
  );
};

export default TodoList;
