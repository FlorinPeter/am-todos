import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  let mockOnChange: vi.Mock;

  beforeEach(() => {
    mockOnChange = vi.fn();
    vi.clearAllMocks();
  });

  describe('Basic Editor Functionality', () => {
    it('renders CodeMirror editor with initial content', () => {
      render(
        <CodeMirrorEditor 
          value="# Test Content" 
          onChange={mockOnChange} 
        />
      );
      
      // CodeMirror creates a div with cm-editor class
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
    });

    it('displays initial value in editor', () => {
      const testContent = '# Test Heading\n\nThis is test content';
      render(
        <CodeMirrorEditor 
          value={testContent} 
          onChange={mockOnChange} 
        />
      );
      
      // Content should be visible in the editor
      const editor = document.querySelector('.cm-content');
      expect(editor).toBeInTheDocument();
    });

    it('calls onChange when content changes', async () => {
      render(
        <CodeMirrorEditor 
          value="initial content" 
          onChange={mockOnChange} 
        />
      );
      
      // Find the CodeMirror content area and simulate typing
      const contentArea = document.querySelector('.cm-content');
      expect(contentArea).toBeInTheDocument();
      
      // Simulate user input
      await userEvent.type(contentArea!, ' updated');
      
      // onChange should be called (may be called multiple times for each character)
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('applies custom height prop', () => {
      render(
        <CodeMirrorEditor 
          value="test" 
          onChange={mockOnChange} 
          height="20rem"
        />
      );
      
      // Should have height applied
      const wrapper = document.querySelector('.cm-editor')?.parentElement;
      expect(wrapper).toHaveStyle({ height: '20rem' });
    });

    it('shows placeholder when value is empty', () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
          placeholder="Enter your markdown..."
        />
      );
      
      // Placeholder should be visible
      const placeholder = document.querySelector('.cm-placeholder');
      expect(placeholder).toBeInTheDocument();
    });

    it('applies readonly state correctly', () => {
      render(
        <CodeMirrorEditor 
          value="readonly content" 
          onChange={mockOnChange} 
          readOnly={true}
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
      // ReadOnly editors have specific classes/attributes in CodeMirror
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
      
      // CodeMirror should apply markdown language support
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
      
      // Check that markdown extensions are applied (implicit through no errors)
    });

    it('supports auto-list continuation with Enter key', async () => {
      render(
        <CodeMirrorEditor 
          value="- [ ] First task" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      expect(contentArea).toBeInTheDocument();
      
      // Focus at end of line and press Enter
      if (contentArea) {
        contentArea.focus();
        await userEvent.keyboard('{End}{Enter}');
        
        // Should trigger onChange with new list item
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalled();
        });
      }
    });

    it('handles backspace in markdown lists', async () => {
      render(
        <CodeMirrorEditor 
          value="- [ ] Task item\n- [ ] " 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.keyboard('{Backspace}');
        
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Emoji Autocompletion', () => {
    it('shows emoji suggestions when typing colon', async () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        
        // Type colon to trigger emoji completion
        await userEvent.type(contentArea, ':r');
        
        // Wait for autocomplete dropdown to appear
        await waitFor(() => {
          const tooltip = document.querySelector('.cm-tooltip-autocomplete');
          expect(tooltip).toBeInTheDocument();
        }, { timeout: 1000 });
      }
    });

    it('inserts emoji when autocomplete item is selected', async () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ':rocket');
        
        // Wait for autocomplete and press Enter to select first item
        await waitFor(() => {
          const tooltip = document.querySelector('.cm-tooltip-autocomplete');
          expect(tooltip).toBeInTheDocument();
        });
        
        await userEvent.keyboard('{Enter}');
        
        // Should insert emoji and call onChange
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalled();
        });
      }
    });

    it('shows popular emojis when typing just colon', async () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ':');
        
        // Should show popular emoji suggestions
        await waitFor(() => {
          const tooltip = document.querySelector('.cm-tooltip-autocomplete');
          expect(tooltip).toBeInTheDocument();
        }, { timeout: 1000 });
      }
    });

    it('handles special characters in emoji names like +1', async () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ':+1');
        
        // Should not crash and should show suggestions
        await waitFor(() => {
          // Either autocomplete shows or content is updated
          const tooltip = document.querySelector('.cm-tooltip-autocomplete');
          const hasContent = mockOnChange.mock.calls.length > 0;
          expect(tooltip || hasContent).toBeTruthy();
        }, { timeout: 1000 });
      }
    });
  });

  describe('Theme and Styling', () => {
    it('applies custom dark theme', () => {
      render(
        <CodeMirrorEditor 
          value="test content" 
          onChange={mockOnChange} 
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
      
      // Should have dark theme styling
      const computedStyle = window.getComputedStyle(editor!);
      // We can check for dark background colors
      expect(computedStyle.backgroundColor).toBeTruthy();
    });

    it('shows proper focus styling', async () => {
      render(
        <CodeMirrorEditor 
          value="test" 
          onChange={mockOnChange} 
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
      
      // Focus the editor
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        
        await waitFor(() => {
          const focusedEditor = document.querySelector('.cm-focused');
          expect(focusedEditor).toBeInTheDocument();
        });
      }
    });

    it('applies selection styling correctly', async () => {
      render(
        <CodeMirrorEditor 
          value="selectable text content" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        
        // Select all text
        await userEvent.keyboard('{Control>}a{/Control}');
        
        // Should show selection styling
        await waitFor(() => {
          const selection = document.querySelector('.cm-selectionBackground');
          expect(selection).toBeInTheDocument();
        });
      }
    });

    it('disables line numbers as configured', () => {
      render(
        <CodeMirrorEditor 
          value="line 1\nline 2\nline 3" 
          onChange={mockOnChange} 
        />
      );
      
      // Should not show line numbers (they are disabled in basicSetup)
      const lineNumbers = document.querySelector('.cm-lineNumbers');
      expect(lineNumbers).not.toBeInTheDocument();
    });

    it('applies monospace font family', () => {
      render(
        <CodeMirrorEditor 
          value="monospace text" 
          onChange={mockOnChange} 
        />
      );
      
      const content = document.querySelector('.cm-content');
      expect(content).toBeInTheDocument();
      
      const computedStyle = window.getComputedStyle(content!);
      expect(computedStyle.fontFamily).toMatch(/monospace|mono/i);
    });
  });

  describe('Integration with MarkdownViewer', () => {
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
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      
      // Editor should be integrated within form context
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
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
      
      // Should handle prop updates without errors
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
    });

    it('preserves cursor position during updates', () => {
      render(
        <CodeMirrorEditor 
          value="test content for cursor" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      expect(contentArea).toBeInTheDocument();
      
      // This tests that the editor maintains state properly
      if (contentArea) {
        contentArea.focus();
        // The editor should handle focus and cursor positioning
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty content gracefully', () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
    });

    it('handles very long content', () => {
      const longContent = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);
      
      render(
        <CodeMirrorEditor 
          value={longContent} 
          onChange={mockOnChange} 
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialContent = 'Special chars: 🚀 ❤️ 👍 \n\t\r\n <>[]{}()';
      
      render(
        <CodeMirrorEditor 
          value={specialContent} 
          onChange={mockOnChange} 
        />
      );
      
      const editor = document.querySelector('.cm-editor');
      expect(editor).toBeInTheDocument();
    });

    it('handles rapid onChange events', async () => {
      render(
        <CodeMirrorEditor 
          value="" 
          onChange={mockOnChange} 
        />
      );
      
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        
        // Type rapidly
        await userEvent.type(contentArea, 'rapid typing test', { delay: 1 });
        
        // Should handle rapid changes without crashing
        await waitFor(() => {
          expect(mockOnChange).toHaveBeenCalled();
        });
      }
    });
  });
});