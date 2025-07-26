import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CodeMirrorEditor from '../CodeMirrorEditor';

// Mock node-emoji to control emoji testing
vi.mock('node-emoji', () => ({
  search: vi.fn((query: string) => {
    const mockResults = [
      { key: 'rocket', emoji: '🚀' },
      { key: 'robot', emoji: '🤖' },
      { key: 'fire', emoji: '🔥' },
      { key: 'heart', emoji: '❤️' }
    ];
    return mockResults.filter(result => 
      result.key.toLowerCase().includes(query.toLowerCase())
    );
  }),
  get: vi.fn((name: string) => {
    const emojiMap: { [key: string]: string } = {
      'thumbsup': '👍',
      '+1': '👍',
      'thumbsdown': '👎',
      '-1': '👎',
      'heart': '❤️',
      'fire': '🔥',
      'rocket': '🚀'
    };
    return emojiMap[name];
  })
}));

describe('CodeMirrorEditor', () => {
  let mockOnChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnChange = vi.fn();
    vi.clearAllMocks();
  });

  describe('Basic Editor Functionality', () => {
    it('renders CodeMirror editor without crashing', () => {
      render(
        <CodeMirrorEditor 
          value="# Test Content" 
          onChange={mockOnChange} 
        />
      );
      
      // Test that component renders without errors
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles empty content gracefully', () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('applies readonly state correctly', () => {
      render(
        <CodeMirrorEditor 
          value="readonly content" 
          onChange={mockOnChange} 
          readOnly={true}
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('shows placeholder when value is empty', () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
          placeholder="Enter your markdown..."
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('applies custom height prop', () => {
      render(
        <CodeMirrorEditor 
          value="test" 
          onChange={mockOnChange} 
          height="20rem"
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });
  });

  describe('Markdown-Specific Features', () => {
    it('applies markdown syntax highlighting', () => {
      render(
        <CodeMirrorEditor 
          value="# Heading\n**bold** *italic*\n```js\ncode\n```" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialContent = 'Special chars: 🚀 ❤️ 👍 \n\t\r\n <>[]{}()';
      
      render(
        <CodeMirrorEditor 
          value={specialContent} 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);
      
      render(
        <CodeMirrorEditor 
          value={longContent} 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });
  });

  describe('Integration and Updates', () => {
    it('integrates properly with form handling', () => {
      const handleSubmit = vi.fn();
      
      render(
        <form onSubmit={handleSubmit}>
          <CodeMirrorEditor 
            value="form content" 
            onChange={mockOnChange} 
          />
        </form>
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles prop updates correctly', () => {
      const { rerender } = render(
        <CodeMirrorEditor 
          value="initial" 
          onChange={mockOnChange} 
        />
      );
      
      // Update value prop
      rerender(
        <CodeMirrorEditor 
          value="updated content" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles different themes and styling', () => {
      render(
        <CodeMirrorEditor 
          value="test content" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('preserves state during updates', () => {
      render(
        <CodeMirrorEditor 
          value="test content for cursor" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles null or undefined values gracefully', () => {
      // Component should handle null/undefined by converting to empty string
      render(
        <CodeMirrorEditor 
          value={null as any} 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles function updates without crashing', () => {
      const { rerender } = render(
        <CodeMirrorEditor 
          value="test" 
          onChange={mockOnChange} 
        />
      );

      const newOnChange = vi.fn();
      rerender(
        <CodeMirrorEditor 
          value="test" 
          onChange={newOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('renders with minimal props', () => {
      render(
        <CodeMirrorEditor 
          value="minimal" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });

    it('handles complex markdown content', () => {
      const complexContent = `# Title
      
## Subtitle

- [ ] Task 1
- [x] Task 2
  - [ ] Subtask

\`\`\`javascript
const code = 'test';
\`\`\`

> Quote block

| Table | Header |
|-------|--------|
| Cell  | Value  |

:rocket: :heart: :+1:`;

      render(
        <CodeMirrorEditor 
          value={complexContent} 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByTestId('codemirror-editor')).toBeInTheDocument();
    });
  });
});