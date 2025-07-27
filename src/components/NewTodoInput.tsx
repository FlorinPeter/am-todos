import React, { useState, useEffect, useRef } from 'react';
import { NewTodoData } from '../types';
import { PREDEFINED_TEMPLATES } from '../config/templates';

interface NewTodoInputProps {
  onGoalSubmit: (data: NewTodoData) => void;
  onCancel?: () => void;
}

const NewTodoInput: React.FC<NewTodoInputProps> = ({ onGoalSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('general');
  const [showDescription, setShowDescription] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Robust focus management for modal timing issues
  useEffect(() => {
    // Use a small delay to ensure modal is fully rendered and any click events have finished processing
    const focusTimer = setTimeout(() => {
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    }, 100); // 100ms delay to handle modal overlay and event timing

    return () => clearTimeout(focusTimer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      const data: NewTodoData = {
        title: title.trim(),
        description: description.trim() || undefined,
        template: selectedTemplate
      };
      onGoalSubmit(data);
      setTitle('');
      setDescription('');
      setSelectedTemplate('general');
      setShowDescription(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Template
        </label>
        <select
          value={selectedTemplate}
          onChange={(e) => setSelectedTemplate(e.target.value)}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        >
          {PREDEFINED_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} - {template.description}
            </option>
          ))}
        </select>
      </div>

      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Task Title <span className="text-red-400">*</span>
        </label>
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your task title..."
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
        />
      </div>

      {/* Description Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowDescription(!showDescription)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showDescription ? '− Hide Description' : '+ Add Description (Optional)'}
        </button>
      </div>

      {/* Description Input */}
      {showDescription && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Provide additional context or details..."
            rows={3}
            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white resize-vertical"
          />
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex space-x-3 mt-6">
        <button 
          type="submit" 
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!title.trim()}
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
