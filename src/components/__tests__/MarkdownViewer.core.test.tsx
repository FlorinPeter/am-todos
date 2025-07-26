/**
 * MarkdownViewer Core Tests - Main Rendering and Basic Functionality
 * Consolidated from 10 redundant test files to eliminate massive duplication
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';

// Shared mock setup (consolidated from multiple files)
vi.mock('../../services/aiService', () => ({
  processChatMessage: vi.fn().mockResolvedValue('AI response content')
}));

vi.mock('../../utils/localStorage', () => ({
  saveDraft: vi.fn(),
  getDraft: vi.fn(() => null),
  clearDraft: vi.fn(),
  generateCheckpointId: vi.fn(() => 'test-checkpoint-id'),
  saveCheckpoint: vi.fn(),
  getCheckpoints: vi.fn(() => []),
  clearCheckpoints: vi.fn(),
  saveChatSession: vi.fn(),
  getChatSession: vi.fn(() => null),
  clearChatSession: vi.fn(),
}));

vi.mock('../../utils/markdown', () => ({
  parseMarkdownWithFrontmatter: vi.fn().mockReturnValue({
    frontmatter: { title: 'Test Task' },
    content: 'Test content'
  })
}));

vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Shared mockProps (consolidated from multiple files)
const mockProps = {
  content: '# Test Task\n\n- [ ] First item\n- [ ] Second item',
  chatHistory: [],
  onMarkdownChange: vi.fn(),
  onChatHistoryChange: vi.fn(),
  filePath: 'test-file.md',
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  taskId: 'test-task-id',
  todoId: 'todo-123'
};

describe('MarkdownViewer - Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock scrollIntoView for all tests
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(),
      writable: true
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Basic Rendering and Display', () => {
    it('renders markdown content in view mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('renders interactive checkboxes correctly', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).not.toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it('renders completed checkboxes correctly', () => {
      const completedProps = {
        ...mockProps,
        content: '# Test Task\n\n- [x] Completed item\n- [ ] Pending item'
      };
      
      render(<MarkdownViewer {...completedProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });

    it('handles empty content gracefully', () => {
      const emptyProps = { ...mockProps, content: '' };
      
      render(<MarkdownViewer {...emptyProps} />);
      
      // Should render without errors - check for the main container
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders code blocks correctly', () => {
      const codeProps = {
        ...mockProps,
        content: '# Test\n\n```javascript\nconst test = "code";\n```\n\n`inline code`'
      };
      
      render(<MarkdownViewer {...codeProps} />);
      
      // Check for code block existence (syntax highlighted)
      expect(screen.getByText('const')).toBeInTheDocument();
      // Check for inline code  
      expect(screen.getByText('inline code')).toBeInTheDocument();
      // Check that code block is rendered (multiple code elements expected)
      const codeBlocks = screen.getAllByRole('code');
      expect(codeBlocks.length).toBeGreaterThan(0);
      // Also verify pre element exists for block code
      expect(document.querySelector('pre')).toBeTruthy();
    });
  });

  describe('Edit Mode Functionality', () => {
    it('toggles between edit and view modes', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      // Should show CodeMirror editor in edit mode
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Should show Save/Cancel buttons
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows unsaved changes indicator', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      // Wait for editor to be present
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Simulate actual content modification in CodeMirror
      const editor = document.querySelector('.cm-content');
      if (editor) {
        // Clear current content and add new content
        editor.textContent = 'Modified content';
        // Trigger both input and change events
        fireEvent.input(editor);
        fireEvent(editor, new Event('input', { bubbles: true }));
      }
      
      // Look for unsaved changes indicator (may be in different formats)
      await waitFor(() => {
        const unsavedIndicator = document.querySelector('[data-testid="unsaved-changes"]') || 
                                 screen.queryByText(/unsaved/i) || 
                                 screen.queryByText(/modified/i) || 
                                 screen.queryByText(/changes/i);
        expect(unsavedIndicator).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('saves changes when Save button is clicked', async () => {
      const onMarkdownChangeSpy = vi.fn();
      const propsWithSpy = { ...mockProps, onMarkdownChange: onMarkdownChangeSpy };
      
      render(<MarkdownViewer {...propsWithSpy} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      // Wait for edit mode
      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      
      // Simulate content modification
      const editor = document.querySelector('.cm-content');
      if (editor) {
        fireEvent.input(editor, { target: { textContent: 'Modified content' } });
      }
      
      // Save changes
      const saveButton = screen.getByText('Save');
      await userEvent.click(saveButton);
      
      expect(onMarkdownChangeSpy).toHaveBeenCalled();
    });

    it('cancels changes when Cancel button is clicked', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      const cancelButton = screen.getByText('Cancel');
      await userEvent.click(cancelButton);
      
      // Should return to view mode without saving
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(mockProps.onMarkdownChange).not.toHaveBeenCalled();
    });
  });

  describe('Interactive Checkbox Functionality', () => {
    it('toggles checkbox state when clicked', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      await userEvent.click(checkboxes[0]);
      
      expect(mockProps.onMarkdownChange).toHaveBeenCalled();
      
      // Check that the content was updated with checked state
      const callArgs = mockProps.onMarkdownChange.mock.calls[0][0];
      expect(callArgs).toContain('- [x] First item');
    });

    it('unchecks completed checkboxes when clicked', async () => {
      const completedProps = {
        ...mockProps,
        content: '# Test Task\n\n- [x] Completed item'
      };
      
      render(<MarkdownViewer {...completedProps} />);
      
      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);
      
      expect(mockProps.onMarkdownChange).toHaveBeenCalled();
      
      // Check that the content was updated with unchecked state
      const callArgs = mockProps.onMarkdownChange.mock.calls[0][0];
      expect(callArgs).toContain('- [ ] Completed item');
    });

    it('handles multiple checkbox interactions', async () => {
      const onMarkdownChangeSpy = vi.fn();
      const propsWithSpy = { ...mockProps, onMarkdownChange: onMarkdownChangeSpy };
      
      render(<MarkdownViewer {...propsWithSpy} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
      
      // Click first checkbox and verify it works
      await userEvent.click(checkboxes[0]);
      await waitFor(() => {
        expect(onMarkdownChangeSpy).toHaveBeenCalled();
      });
      
      // Re-render component to get fresh checkboxes after state change
      const { rerender } = render(<MarkdownViewer {...propsWithSpy} />);
      
      // Get fresh checkboxes and click the second one
      const freshCheckboxes = screen.getAllByRole('checkbox');
      if (freshCheckboxes.length >= 2) {
        onMarkdownChangeSpy.mockClear(); // Clear previous calls
        await userEvent.click(freshCheckboxes[1]);
        
        await waitFor(() => {
          expect(onMarkdownChangeSpy).toHaveBeenCalled();
        });
      } else {
        // If only one checkbox available, verify it can be clicked again
        onMarkdownChangeSpy.mockClear();
        await userEvent.click(freshCheckboxes[0]);
        await waitFor(() => {
          expect(onMarkdownChangeSpy).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Component State Management', () => {
    it('maintains component state during re-renders', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      // Re-render with updated props
      const updatedProps = {
        ...mockProps,
        content: '# Updated Task\n\n- [ ] New item'
      };
      
      rerender(<MarkdownViewer {...updatedProps} />);
      
      expect(screen.getByText('Updated Task')).toBeInTheDocument();
      expect(screen.getByText('New item')).toBeInTheDocument();
    });

    it('handles prop changes gracefully', () => {
      const { rerender } = render(<MarkdownViewer {...mockProps} />);
      
      // Update multiple props
      const newProps = {
        ...mockProps,
        content: '# Different Content',
        filePath: 'different-file.md',
        taskId: 'different-task-id'
      };
      
      rerender(<MarkdownViewer {...newProps} />);
      
      expect(screen.getByText('Different Content')).toBeInTheDocument();
    });
  });

  describe('Basic UI Elements', () => {
    it('displays edit button in view mode', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('displays AI Chat toggle button', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const chatButton = screen.getByText(/AI Chat/i);
      expect(chatButton).toBeInTheDocument();
    });

    it('renders markdown with proper styling classes', () => {
      render(<MarkdownViewer {...mockProps} />);
      
      // Check for markdown content wrapper
      const content = document.querySelector('.markdown-content');
      expect(content).toBeInTheDocument();
    });
  });

  describe('Content Processing', () => {
    it('processes markdown headers correctly', () => {
      const headerContent = '# H1 Header\n## H2 Header\n### H3 Header';
      const headerProps = { ...mockProps, content: headerContent };
      
      render(<MarkdownViewer {...headerProps} />);
      
      expect(screen.getByText('H1 Header')).toBeInTheDocument();
      expect(screen.getByText('H2 Header')).toBeInTheDocument();
      expect(screen.getByText('H3 Header')).toBeInTheDocument();
    });

    it('processes markdown lists correctly', () => {
      const listContent = '# Test\n\n- Item 1\n- Item 2\n  - Nested item\n\n1. Ordered item\n2. Another ordered item';
      const listProps = { ...mockProps, content: listContent };
      
      render(<MarkdownViewer {...listProps} />);
      
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Nested item')).toBeInTheDocument();
      expect(screen.getByText('Ordered item')).toBeInTheDocument();
    });

    it('handles special characters in content', () => {
      const specialContent = '# Test\n\n- Item with *emphasis*\n- Item with **bold**\n- Item with `code`';
      const specialProps = { ...mockProps, content: specialContent };
      
      render(<MarkdownViewer {...specialProps} />);
      
      expect(screen.getByText('emphasis')).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
    });
  });
});