import React, { useState, useEffect, useRef } from 'react';

interface NewTodoInputProps {
  onGoalSubmit: (goal: string) => void;
  onCancel?: () => void;
}

const NewTodoInput: React.FC<NewTodoInputProps> = ({ onGoalSubmit, onCancel }) => {
  const [goal, setGoal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Robust focus management for modal timing issues
  useEffect(() => {
    // Use a small delay to ensure modal is fully rendered and any click events have finished processing
    const focusTimer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100); // 100ms delay to handle modal overlay and event timing

    return () => clearTimeout(focusTimer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      onGoalSubmit(goal.trim());
      setGoal('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter a new high-level goal..."
        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
      />
      <div className="flex space-x-3 mt-4">
        <button 
          type="submit" 
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          disabled={!goal.trim()}
        >
          Generate Todo List
        </button>
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};

export default NewTodoInput;
