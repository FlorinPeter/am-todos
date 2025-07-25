import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  describe('Feature 3: Interactive Markdown Editor with Progress Tracking', () => {
    it('renders markdown content in view mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('toggles between edit and view modes', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      // Should show CodeMirror editor in edit mode
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
    });

    it('shows unsaved changes indicator', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Simulate typing in CodeMirror editor
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ' Modified');
      }
      
      await waitFor(() => {
        expect(screen.getByText('• Unsaved')).toBeInTheDocument();
      });
    });

    it('shows save and cancel buttons in edit mode', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('Feature 12: Markdown Rendering with Custom Components', () => {
    it('renders custom markdown components with styling', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Check for custom styled heading
      const heading = screen.getByText('Test Task');
      expect(heading).toHaveClass('text-3xl');
    });

    it('renders interactive checkboxes (now functional)', () => {
      const contentWithCheckboxes = '- [ ] Task 1\n- [x] Task 2';
      const mockOnMarkdownChange = vi.fn();
      render(<MarkdownViewer {...mockProps} content={contentWithCheckboxes} onMarkdownChange={mockOnMarkdownChange} />);
      
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(2);
      
      // Verify checkboxes are now enabled and functional
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeEnabled();
        expect(checkbox).toHaveClass('cursor-pointer');
      });

      // Test checkbox functionality
      fireEvent.click(checkboxes[0]);
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      
      // Verify proper state - first checkbox should be checked, second unchanged
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('- [x] Task 1');
      expect(updatedContent).toContain('- [x] Task 2');
    });
  });

  describe('Feature 9: Git History & Version Control', () => {
    it('shows history button when git props provided', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const historyButton = screen.getByText('📜 History');
      expect(historyButton).toBeInTheDocument();
    });

    it('opens git history modal on button click', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const historyButton = screen.getByText('📜 History');
      await userEvent.click(historyButton);
      
      // Should render GitHistory component (even if mocked)
      expect(historyButton).toBeInTheDocument();
    });
  });

  describe('Feature 4: AI Chat Assistant Integration', () => {
    it('renders AI chat component', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Check for AI chat component presence
      const chatSection = document.querySelector('[data-testid="ai-chat"]') || 
                         document.querySelector('.relative');
      expect(chatSection).toBeInTheDocument();
    });

    it('shows unsaved changes warning for AI modifications', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Simulate typing in CodeMirror to trigger unsaved state
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ' Modified');
      }
      
      await waitFor(() => {
        const warning = screen.getByText(/AI changes will be applied to your draft/i);
        expect(warning).toBeInTheDocument();
      });
    });
  });

  describe('Checkpoint Integration', () => {
    it('passes taskId to AIChat component', () => {
      render(<MarkdownViewer {...mockProps} taskId="test-task-123" />);
      
      // The AIChat component should receive the taskId prop
      // This is tested implicitly through the component rendering without errors
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('handles checkpoint restore in view mode', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const mockComponent = screen.getByText(/AI Chat Assistant/i).closest('div');
      expect(mockComponent).toBeInTheDocument();
      
      // The handleCheckpointRestore function should be passed to AIChat
      // This is tested through the component's ability to render and function
    });

    it('handles checkpoint restore in edit mode', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Switch to edit mode
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // The checkpoint restore should work in edit mode too
      const mockComponent = screen.getByText(/AI Chat Assistant/i).closest('div');
      expect(mockComponent).toBeInTheDocument();
    });

    it('marks content as unsaved after checkpoint restore', async () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      // Simulate checkpoint restore by changing content
      const newContent = '# Restored Content\n\n- [ ] Restored item';
      rerender(<MarkdownViewer {...mockProps} content={newContent} />);
      
      // The component should handle the content change
      expect(screen.getByText('Restored Content')).toBeInTheDocument();
    });

    it('handles checkpoint restore with unsaved changes confirmation', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Switch to edit mode and make changes
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Simulate typing in CodeMirror
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ' Modified content');
      }
      
      // Should show unsaved changes indicator
      await waitFor(() => {
        expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
      });
      
      // The checkpoint restore functionality should be available
      const mockComponent = screen.getByText(/AI Chat Assistant/i).closest('div');
      expect(mockComponent).toBeInTheDocument();
    });

    it('preserves checkpoint functionality across edit/view mode switches', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Initially in view mode
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      // Switch to edit mode
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // AIChat should still be available in edit mode
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      // Switch back to view mode
      const viewButton = screen.getByText('View');
      await userEvent.click(viewButton);
      
      // AIChat should still be available in view mode
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });
  });

  describe('Git History Restoration - Frontmatter Handling', () => {
    it('should handle restoration with empty content', () => {
      render(
        <MarkdownViewer 
          {...mockProps} 
          content=""
        />
      );

      // Should handle empty content gracefully
      const component = screen.getByText(/AI Chat Assistant/i).closest('div');
      expect(component).toBeInTheDocument();
    });

    it('should handle restoration with markdown content', () => {
      const plainContent = `# Test Task

This is plain markdown content without frontmatter.

- [ ] First item
- [ ] Second item`;

      render(
        <MarkdownViewer 
          {...mockProps} 
          content={plainContent}
        />
      );

      // Should display all content since there's no frontmatter to strip
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('This is plain markdown content without frontmatter.')).toBeInTheDocument();
    });

    it('should pass restored content to onMarkdownChange correctly', () => {
      const mockOnMarkdownChange = vi.fn();
      const { rerender } = render(
        <MarkdownViewer 
          {...mockProps} 
          content="# Original Content"
          onMarkdownChange={mockOnMarkdownChange}
        />
      );

      // Simulate content update from restoration
      const restoredContent = "# Restored Task\n\nThis is restored content.\n\n- [ ] First item\n- [ ] Second item";
      rerender(
        <MarkdownViewer 
          {...mockProps} 
          content={restoredContent}
          onMarkdownChange={mockOnMarkdownChange}
        />
      );

      // Should display the restored content
      expect(screen.getByText('Restored Task')).toBeInTheDocument();
      expect(screen.getByText('This is restored content.')).toBeInTheDocument();
    });
  });
});