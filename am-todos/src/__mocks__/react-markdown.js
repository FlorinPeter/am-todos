import React from 'react';

// Mock ReactMarkdown component
const ReactMarkdown = ({ children, components, ...props }) => {
  // Simple mock that renders content with basic processing
  const processContent = (content) => {
    if (!content) return '';
    
    // Handle basic markdown patterns for testing
    let processed = content
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-white mb-6 mt-8 pb-2 border-b border-gray-600">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold text-white mb-4 mt-6">$1</h2>')
      .replace(/^- \[ \] (.+)$/gm, '<li class="flex items-start text-gray-300 mb-2 list-none ml-0"><input type="checkbox" disabled="true" class="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 opacity-75 cursor-not-allowed" />$1</li>')
      .replace(/^- \[x\] (.+)$/gm, '<li class="flex items-start text-gray-300 mb-2 list-none ml-0"><input type="checkbox" checked disabled="true" class="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 opacity-75 cursor-not-allowed" />$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
    
    return processed;
  };

  // Apply custom components if provided
  if (components) {
    // Handle input components specifically for checkboxes
    if (components.input) {
      const checkboxMatches = children.match(/- \[[ x]\] /g);
      if (checkboxMatches) {
        return React.createElement('div', {
          dangerouslySetInnerHTML: { __html: processContent(children) },
          'data-testid': 'markdown-content'
        });
      }
    }
  }
  
  return React.createElement('div', {
    dangerouslySetInnerHTML: { __html: processContent(children) },
    'data-testid': 'markdown-content'
  });
};

export default ReactMarkdown;