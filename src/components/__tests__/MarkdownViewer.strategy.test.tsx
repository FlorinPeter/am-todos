import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';

// Mock dependencies
vi.mock('../../services/gitService', () => ({
  updateTodo: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('MarkdownViewer - Strategic Coverage', () => {
  const defaultProps = {
    content: '# Test Todo\n\n- [ ] Task 1\n- [x] Task 2',
    chatHistory: [],
    onMarkdownChange: vi.fn(),
    onChatHistoryChange: vi.fn(),
    filePath: 'todos/test.md',
    taskId: 'test-task',
    todoId: 'test-todo-id'
  };

  it('should render inline code elements (lines 460-462)', () => {
    const propsWithInlineCode = {
      ...defaultProps,
      content: '# Test\n\nThis has `inline code` in text.'
    };

    render(<MarkdownViewer {...propsWithInlineCode} />);
    
    // Should render inline code with specific styling
    const codeElement = screen.getByText('inline code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
  });

  it('should render external links with target="_blank" (lines 475-483)', () => {
    const propsWithLink = {
      ...defaultProps,
      content: '# Test\n\n[Visit Example](https://example.com)'
    };

    render(<MarkdownViewer {...propsWithLink} />);
    
    // Should render external link with correct attributes
    const link = screen.getByText('Visit Example');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render markdown content with proper formatting', () => {
    const propsWithFormatting = {
      ...defaultProps,
      content: '# Test\n\n```javascript\nconst test = "hello";\n```\n\n`inline code` test'
    };

    render(<MarkdownViewer {...propsWithFormatting} />);
    
    // Should render formatted content
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('inline code')).toBeInTheDocument();
    expect(screen.getByText(/const test = "hello"/)).toBeInTheDocument();
  });
});