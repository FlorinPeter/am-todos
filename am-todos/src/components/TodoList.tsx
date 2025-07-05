import React from 'react';
import MarkdownViewer from './MarkdownViewer';

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
  };
}

interface TodoListProps {
  todos: Todo[];
  onTodoUpdate: (id: string, newContent: string, newChatHistory?: ChatMessage[]) => void;
}

const TodoList: React.FC<TodoListProps> = ({ todos, onTodoUpdate }) => {
  return (
    <div>
      {todos.map((todo) => (
        <div key={todo.id} className="mb-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-white">{todo.title}</h2>
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
