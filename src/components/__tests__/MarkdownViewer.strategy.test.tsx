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
  const mockTodo = {
    id: 'test-id',
    filename: 'test.md',
    content: '# Test Todo\n\n- [ ] Task 1\n- [x] Task 2\n\n```javascript\nconst test = "hello";\n```\n\n[External Link](https://example.com)',
    frontmatter: {
      title: 'Test Todo',
      createdAt: '2023-01-01',
      priority: 3,
      isArchived: false,
      chatHistory: []
    },
    path: 'todos/test.md',
    sha: 'abc123'
  };

  const defaultProps = {
    todo: mockTodo,
    onTodoUpdate: vi.fn(),
    onToggleArchive: vi.fn(),
    onDeleteTodo: vi.fn(),
    chatHistory: [],
    onChatUpdate: vi.fn(),
    isEditMode: false,
    onEditModeChange: vi.fn(),
    hasUnsavedChanges: false,
    editContent: '',
    onEditContentChange: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
  };

  it('should render inline code elements (lines 460-462)', () => {
    const todoWithInlineCode = {
      ...mockTodo,
      content: '# Test\n\nThis has `inline code` in text.'
    };

    render(<MarkdownViewer {...defaultProps} todo={todoWithInlineCode} />);
    
    // Should render inline code with specific styling
    const codeElement = screen.getByText('inline code');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
  });

  it('should render block code elements (lines 464-467)', () => {
    const todoWithBlockCode = {
      ...mockTodo,
      content: '# Test\n\n```\nconst test = "hello";\nconsole.log(test);\n```'
    };

    render(<MarkdownViewer {...defaultProps} todo={todoWithBlockCode} />);
    
    // Should render block code with specific styling
    const codeBlock = screen.getByText(/const test = "hello"/);
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock.tagName).toBe('CODE');
  });

  it('should render external links with target="_blank" (lines 475-483)', () => {
    const todoWithLink = {
      ...mockTodo,
      content: '# Test\n\n[Visit Example](https://example.com)'
    };

    render(<MarkdownViewer {...defaultProps} todo={todoWithLink} />);
    
    // Should render external link with correct attributes
    const link = screen.getByText('Visit Example');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render pre elements (lines 469-473)', () => {
    const todoWithPre = {
      ...mockTodo,
      content: '# Test\n\n```bash\necho "hello world"\n```'
    };

    render(<MarkdownViewer {...defaultProps} todo={todoWithPre} />);
    
    // Should render pre element with specific styling
    const preElement = screen.getByText('echo "hello world"').parentElement;
    expect(preElement?.tagName).toBe('PRE');
  });
});