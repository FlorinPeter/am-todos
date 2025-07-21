import React from 'react';

// Mock ReactMarkdown component
const ReactMarkdown = ({ children, components, ...props }) => {
  // HTML sanitization function to prevent XSS
  const sanitizeHTML = (html) => {
    if (!html) return '';
    
    // Remove dangerous tags and attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*>/gi, '')
      .replace(/<link\b[^<]*>/gi, '')
      .replace(/<meta\b[^<]*>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/data:text\/html/gi, '') // Remove data URLs with HTML
      .replace(/vbscript:/gi, '') // Remove vbscript: URLs
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ''); // Remove style tags
  };

  // Safe content processing with HTML sanitization
  const processContent = (content) => {
    if (!content) return '';
    
    // Escape HTML entities in user content first
    const escapeHTML = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    };
    
    // Only process known safe markdown patterns with escaped content
    let processed = escapeHTML(content)
      .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-white mb-6 mt-8 pb-2 border-b border-gray-600">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold text-white mb-4 mt-6">$1</h2>')
      .replace(/^- \[ \] (.+)$/gm, '<li class="flex items-start text-gray-300 mb-2 list-none ml-0"><input type="checkbox" disabled="true" class="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 opacity-75 cursor-not-allowed" />$1</li>')
      .replace(/^- \[x\] (.+)$/gm, '<li class="flex items-start text-gray-300 mb-2 list-none ml-0"><input type="checkbox" checked disabled="true" class="w-4 h-4 mr-3 mt-1 rounded border-gray-400 bg-gray-700 text-blue-500 opacity-75 cursor-not-allowed" />$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
    
    // Additional sanitization pass
    return sanitizeHTML(processed);
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