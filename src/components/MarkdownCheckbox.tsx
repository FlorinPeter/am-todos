import React from 'react';

interface MarkdownCheckboxProps {
  index: number;
  isChecked: boolean;
  content: string;
  onToggle: (index: number) => void;
}

const MarkdownCheckbox: React.FC<MarkdownCheckboxProps> = ({ 
  index, 
  isChecked, 
  content, 
  onToggle 
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onToggle(index);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onToggle(index);
    }
  };

  return (
    <span className="markdown-checkbox-wrapper flex items-center">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        data-checkbox-index={index}
        data-checkbox-content={content}
        data-checkbox-state={isChecked ? 'checked' : 'unchecked'}
        className="w-4 h-4 mr-2 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer flex-shrink-0"
      />
      <span className="text-gray-200 leading-normal ml-1">{content}</span>
    </span>
  );
};

export default MarkdownCheckbox;