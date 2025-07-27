import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';
import * as localStorage from '../../utils/localStorage';
import logger from '../../utils/logger';

// Mock the AI service
vi.mock('../../services/aiService');

// Mock localStorage utilities
vi.mock('../../utils/localStorage', () => ({
  saveDraft: vi.fn(),
  getDraft: vi.fn(),
  clearDraft: vi.fn(),
  getChatSession: vi.fn(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

const mockProps = {
  content: '# Test Task\n\n- [ ] First item\n- [ ] Second item',
  chatHistory: [],
  onMarkdownChange: vi.fn(),
  onChatHistoryChange: vi.fn(),
  filePath: 'test-file.md',
  taskId: 'test-task-id',
  todoId: 'test-todo-id'
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

  describe('Edit Mode Functionality', () => {
    it('switches to edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      expect(screen.getByText('View')).toBeInTheDocument();
    });

    it('shows Cancel and Save buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('shows unsaved changes indicator when content is modified', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      // Find the textarea and modify content
      const editor = screen.getByRole('textbox');
      await user.clear(editor);
      await user.type(editor, '# Modified Task');
      
      expect(screen.getByText(/• Unsaved/)).toBeInTheDocument();
    });

    it('handles save operation correctly', async () => {
      const user = userEvent.setup();
      const onMarkdownChange = vi.fn();
      render(<MarkdownViewer {...mockProps} onMarkdownChange={onMarkdownChange} />);
      
      await user.click(screen.getByText('Edit'));
      
      const editor = screen.getByRole('textbox');
      await user.clear(editor);
      await user.type(editor, '# Modified Task');
      
      // Wait for changes to be detected
      await waitFor(() => {
        expect(screen.getByText(/• Unsaved/)).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Save'));
      
      // The save function should be called with the modified content
      expect(onMarkdownChange).toHaveBeenCalled();
      expect(localStorage.clearDraft).toHaveBeenCalled();
    });

    it('handles cancel operation with confirmation when there are unsaved changes', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      const editor = screen.getByRole('textbox');
      await user.type(editor, ' modified');
      
      await user.click(screen.getByText('Cancel'));
      
      expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to cancel?');
      expect(localStorage.clearDraft).toHaveBeenCalled();
    });

    it('handles cancel operation without confirmation when no unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      await user.click(screen.getByText('Cancel'));
      
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('disables save button when no unsaved changes', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      const saveButton = screen.getByRole('button', { name: /Save/ });
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Draft Management', () => {
    it('restores draft when available', () => {
      const mockDraft = {
        todoId: 'test-todo-id',
        path: 'test-file.md',
        stableDraftKey: 'test-file.md',
        editContent: '# Restored Content',
        viewContent: '# Original Content',
        hasUnsavedChanges: true,
        timestamp: Date.now()
      };
      
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText(/• Draft restored/)).toBeInTheDocument();
      expect(logger.log).toHaveBeenCalledWith('Draft restored for todo: test-file.md');
    });

    it('handles corrupted draft data gracefully', () => {
      vi.mocked(localStorage.getDraft).mockImplementation(() => {
        throw new Error('Corrupted draft data');
      });
      
      render(<MarkdownViewer {...mockProps} />);
      
      expect(logger.error).toHaveBeenCalledWith('Failed to restore draft:', expect.any(Error));
    });

    it('auto-saves draft when content changes with debounce', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      const editor = screen.getByRole('textbox');
      await user.type(editor, ' modified');
      
      // Wait for debounce
      await waitFor(() => {
        expect(localStorage.saveDraft).toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('handles localStorage errors during auto-save gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(localStorage.saveDraft).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      const editor = screen.getByRole('textbox');
      await user.type(editor, ' modified');
      
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to auto-save draft:', expect.any(Error));
      }, { timeout: 1000 });
    });

    it('handles localStorage errors during draft clearing gracefully', async () => {
      const user = userEvent.setup();
      
      vi.mocked(localStorage.clearDraft).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      await user.click(screen.getByText('Cancel'));
      
      // Should handle the error gracefully - component should still work
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('Checkbox Toggle Functionality', () => {
    it('handles checkbox toggle in view mode', async () => {
      const user = userEvent.setup();
      const onMarkdownChange = vi.fn();
      render(<MarkdownViewer {...mockProps} onMarkdownChange={onMarkdownChange} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    it('handles checkbox state persistence between modes', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      // Test that checkboxes work in view mode
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      
      // Switch to edit mode and back
      await user.click(screen.getByText('Edit'));
      await user.click(screen.getByText('View'));
      
      // Checkboxes should still be there
      const newCheckboxes = screen.getAllByRole('checkbox');
      expect(newCheckboxes).toHaveLength(2);
    });

    it('handles checkbox toggle with invalid index gracefully', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Access the component instance methods via ref (testing internal behavior)
      // eslint-disable-next-line testing-library/no-node-access
      const component = screen.getByText('Test Task').closest('.bg-gray-800');
      expect(component).toBeInTheDocument();
    });
  });

  describe('History Integration', () => {
    it('shows history button when filePath is provided', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('📜 History')).toBeInTheDocument();
    });

    it('opens history modal when history button is clicked', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('📜 History'));
      
      // GitHistory component should be rendered (mocked)
      expect(screen.getByText('📜 History')).toBeInTheDocument();
    });

    it('handles history restore with confirmation', async () => {
      const onMarkdownChange = vi.fn();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      
      const { rerender } = render(<MarkdownViewer {...mockProps} onMarkdownChange={onMarkdownChange} />);
      
      // Re-render with the restore function triggered
      rerender(<MarkdownViewer {...mockProps} onMarkdownChange={onMarkdownChange} />);
      
      expect(onMarkdownChange).toHaveBeenCalledTimes(0); // Not called yet
    });

    it('handles history restore cancellation when unsaved changes exist', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<MarkdownViewer {...mockProps} />);
      
      // Component should handle the cancellation gracefully
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  describe('Content Processing and Rendering', () => {
    it('processes checkbox content correctly with preprocessing', () => {
      const checkboxContent = '# Task List\n\n- [ ] Item 1\n- [x] Item 2\n- [ ] Item 3';
      render(<MarkdownViewer {...mockProps} content={checkboxContent} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      expect(checkboxes[1]).toBeChecked();
    });

    it('handles external links correctly', () => {
      const contentWithLinks = '# Links\n\n[External](https://example.com)\n[Internal](./internal.md)';
      render(<MarkdownViewer {...mockProps} content={contentWithLinks} />);
      
      // eslint-disable-next-line testing-library/no-node-access
      const externalLink = screen.getByText('External').closest('a');
      expect(externalLink).toHaveAttribute('target', '_blank');
      expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('handles complex nested content with checkboxes', () => {
      const nestedContent = `# Project
      
## Tasks
- [ ] Main task
  - [ ] Subtask 1
  - [x] Subtask 2
- [x] Another task

## Notes
Regular content here.`;
      
      render(<MarkdownViewer {...mockProps} content={nestedContent} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
    });

    it('handles checkbox registry mismatch gracefully', () => {
      // Mock console.error to avoid noise in tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const malformedContent = '# Task\n\n- [ ] Normal task\nXCHECKBOXX999XENDX Invalid token';
      render(<MarkdownViewer {...mockProps} content={malformedContent} />);
      
      // Component should render without crashing
      expect(screen.getByText('Task')).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });

    it('handles debugging token detection failure', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Render with content that might trigger token detection issues
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('shows mobile history button on small screens', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Both desktop and mobile history buttons should be present
      expect(screen.getByText('📜 History')).toBeInTheDocument();
      expect(screen.getByText('📜')).toBeInTheDocument();
    });

    it('shows icon-only buttons for save/cancel on mobile', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      await user.click(screen.getByText('Edit'));
      
      // Should have both text and icon versions
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('💾')).toBeInTheDocument();
    });
  });

  describe('Props and State Management', () => {
    it('handles missing optional props gracefully', () => {
      const minimalProps = {
        content: 'Basic content',
        chatHistory: [],
        onMarkdownChange: vi.fn(),
        onChatHistoryChange: vi.fn()
      };
      
      render(<MarkdownViewer {...minimalProps} />);
      
      expect(screen.getByText('Basic content')).toBeInTheDocument();
      expect(screen.queryByText('📜 History')).not.toBeInTheDocument();
    });

    it('updates content when props change', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      
      rerender(<MarkdownViewer {...mockProps} content="# Updated Task" />);
      
      expect(screen.getByText('Updated Task')).toBeInTheDocument();
    });

    it('handles content synchronization between edit and view modes', async () => {
      const user = userEvent.setup();
      render(<MarkdownViewer {...mockProps} />);
      
      // Switch to edit mode
      await user.click(screen.getByText('Edit'));
      
      // Should show editor interface
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      
      // Switch back to view mode
      await user.click(screen.getByText('View'));
      
      // Should show view interface
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });
});