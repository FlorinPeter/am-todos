import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';

// Mock the AI service
vi.mock('../../services/aiService');

const mockProps = {
  content: '# Test Task\n\n- [ ] First item\n- [ ] Second item',
  chatHistory: [],
  onMarkdownChange: vi.fn(),
  onChatHistoryChange: vi.fn(),
  filePath: 'test-file.md',
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  taskId: 'test-task-id'
};

describe('MarkdownViewer - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders markdown content in view mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('handles empty content gracefully', () => {
      render(<MarkdownViewer {...mockProps} content="" />);
      
      // Component should render without errors - check for Edit button
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders edit button when not in edit mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders component without crashing', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  describe('Checkbox Functionality', () => {
    it('renders checkboxes in markdown content', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Should render checkboxes for task items
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
    });

    it('handles content with checked items', () => {
      const contentWithChecked = '# Test\n\n- [x] Completed item\n- [ ] Pending item';
      render(<MarkdownViewer {...mockProps} content={contentWithChecked} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe('AI Chat Integration', () => {
    it('renders AI chat assistant button', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });

    it('handles chat history prop', () => {
      const chatHistory = [
        { role: 'user' as const, content: 'Test message', timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: 'Test response', timestamp: new Date().toISOString() }
      ];
      
      render(<MarkdownViewer {...mockProps} chatHistory={chatHistory} />);
      
      expect(screen.getByText('AI Chat Assistant')).toBeInTheDocument();
    });
  });

  describe('Content Handling', () => {
    it('renders markdown content correctly', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Should show markdown content
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('handles different content types', () => {
      const complexContent = `# Complex Task

## Subtasks

- [ ] Task 1
- [x] Task 2
  - [ ] Subtask 2.1
  - [x] Subtask 2.2

## Code Block

\`\`\`javascript
const example = 'test';
\`\`\`

## Table

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |

## Links

[Example Link](https://example.com)

> This is a quote block

**Bold text** and *italic text*
`;

      render(<MarkdownViewer {...mockProps} content={complexContent} />);
      
      expect(screen.getByText('Complex Task')).toBeInTheDocument();
      expect(screen.getByText('Subtasks')).toBeInTheDocument();
    });

    it('renders with minimal props', () => {
      const minimalProps = {
        content: 'Simple content',
        chatHistory: [],
        onMarkdownChange: vi.fn(),
        onChatHistoryChange: vi.fn(),
        filePath: 'test.md',
        token: 'token',
        owner: 'owner',
        repo: 'repo',
        taskId: 'task'
      };

      render(<MarkdownViewer {...minimalProps} />);
      
      expect(screen.getByText('Simple content')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles null content gracefully', () => {
      render(<MarkdownViewer {...mockProps} content={null as any} />);
      
      // Component should render without errors - check for Edit button
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('handles undefined content gracefully', () => {
      render(<MarkdownViewer {...mockProps} content={undefined as any} />);
      
      // Component should render without errors - check for Edit button
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = '# Long Task\n\n' + 'A'.repeat(10000);
      
      render(<MarkdownViewer {...mockProps} content={longContent} />);
      
      expect(screen.getByText('Long Task')).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialContent = '# Special 🚀 ❤️ 👍\n\n- [ ] Task with émojis 🎉\n- [ ] Unicode: áéíóú';
      
      render(<MarkdownViewer {...mockProps} content={specialContent} />);
      
      expect(screen.getByText(/Special.*🚀.*❤️.*👍/)).toBeInTheDocument();
    });
  });

  describe('Prop Updates', () => {
    it('handles prop updates correctly', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      
      rerender(<MarkdownViewer {...mockProps} content="# Updated Task" />);
      
      expect(screen.getByText('Updated Task')).toBeInTheDocument();
    });

    it('handles function prop updates', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      const newOnChange = vi.fn();
      rerender(<MarkdownViewer {...mockProps} onMarkdownChange={newOnChange} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('maintains state during re-renders', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      // Component should maintain its state
      expect(screen.getByText('Edit')).toBeInTheDocument();
      
      rerender(<MarkdownViewer {...mockProps} content={mockProps.content} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });
});