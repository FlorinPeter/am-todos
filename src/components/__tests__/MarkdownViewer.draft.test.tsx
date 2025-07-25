import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkdownViewer from '../MarkdownViewer';
import * as localStorage from '../../utils/localStorage';

// Mock the localStorage module
vi.mock('../../utils/localStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/localStorage')>();
  return {
    ...actual,
    saveDraft: vi.fn(),
    getDraft: vi.fn(),
    clearDraft: vi.fn(),
  };
});

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock AI service
vi.mock('../../services/aiService', () => ({
  processChatMessage: vi.fn().mockResolvedValue('Updated content from AI'),
}));

describe('MarkdownViewer Draft Integration', () => {
  const mockProps = {
    content: '# Original Task\n\n- [ ] Original item',
    chatHistory: [],
    onMarkdownChange: vi.fn(),
    onChatHistoryChange: vi.fn(),
    filePath: '/todos/2025-01-05-test-task.md',
    taskId: 'task-123',
    todoId: 'sha-123456',
  };

  const mockDraft = {
    todoId: 'sha-123456',
    path: '/todos/2025-01-05-test-task.md',
    editContent: '# Draft Task\n\n- [ ] Draft item\n- [x] Completed draft item',
    viewContent: '# Draft Task\n\n- [x] Draft item\n- [x] Completed draft item',
    hasUnsavedChanges: true,
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Draft restoration on mount', () => {
    it('should restore draft if it exists for the current todo', () => {
      // Mock getDraft to return a saved draft
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);

      render(<MarkdownViewer {...mockProps} />);

      // Should call getDraft with correct parameters
      expect(localStorage.getDraft).toHaveBeenCalledWith(
        mockProps.todoId,
        mockProps.filePath
      );

      // Should show draft restored indicator
      expect(screen.getByText('• Draft restored')).toBeInTheDocument();
      
      // Should automatically enter edit mode when draft is restored
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should use original content when no draft exists', () => {
      // Mock getDraft to return null (no draft)
      vi.mocked(localStorage.getDraft).mockReturnValue(null);

      render(<MarkdownViewer {...mockProps} />);

      expect(localStorage.getDraft).toHaveBeenCalledWith(
        mockProps.todoId,
        mockProps.filePath
      );

      // Should not show draft restored indicator
      expect(screen.queryByText('• Draft restored')).not.toBeInTheDocument();
    });

    it('should handle missing todoId gracefully', () => {
      const propsWithoutTodoId = { ...mockProps, todoId: undefined };
      vi.mocked(localStorage.getDraft).mockReturnValue(null);

      render(<MarkdownViewer {...propsWithoutTodoId} />);

      // Should not call getDraft if todoId is missing
      expect(localStorage.getDraft).not.toHaveBeenCalled();
    });

    it('should handle missing filePath gracefully', () => {
      const propsWithoutFilePath = { ...mockProps, filePath: undefined };
      vi.mocked(localStorage.getDraft).mockReturnValue(null);

      render(<MarkdownViewer {...propsWithoutFilePath} />);

      // Should not call getDraft if filePath is missing
      expect(localStorage.getDraft).not.toHaveBeenCalled();
    });
  });

  describe('Draft user interactions', () => {
    it('should not save draft when no unsaved changes', () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(null);
      
      render(<MarkdownViewer {...mockProps} />);

      // Should not save draft when no changes
      expect(localStorage.saveDraft).not.toHaveBeenCalled();
    });
  });

  describe('Draft clearing on save/cancel', () => {
    it('should clear draft when saving changes', async () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);

      // Click save button (should be visible due to hasUnsavedChanges from draft)
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(localStorage.clearDraft).toHaveBeenCalled();
      expect(mockProps.onMarkdownChange).toHaveBeenCalledWith(mockDraft.editContent);
    });

    it('should clear draft when canceling changes', async () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);

      // Mock window.confirm to return true
      window.confirm = vi.fn().mockReturnValue(true);

      // Click cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(localStorage.clearDraft).toHaveBeenCalled();
    });

    it('should not clear draft when cancel is aborted', async () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);

      // Mock window.confirm to return false (user cancels the cancel)
      window.confirm = vi.fn().mockReturnValue(false);

      // Click cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(localStorage.clearDraft).not.toHaveBeenCalled();
    });
  });

  describe('Draft state indicators', () => {
    it('should show "Draft restored" when draft was loaded', () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);

      expect(screen.getByText('• Draft restored')).toBeInTheDocument();
    });

    it('should show "Unsaved" when user makes new changes', async () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(null);
      
      render(<MarkdownViewer {...mockProps} />);

      // Switch to edit mode and make changes
      fireEvent.click(screen.getByText('Edit'));
      
      await waitFor(() => {
        const editor = document.querySelector('.cm-editor');
        expect(editor).toBeInTheDocument();
      });
      
      // Simulate typing in CodeMirror editor
      const contentArea = document.querySelector('.cm-content');
      if (contentArea) {
        contentArea.focus();
        await userEvent.type(contentArea, ' Modified content');
      }

      await waitFor(() => {
        expect(screen.getByText('• Unsaved')).toBeInTheDocument();
      });
    });

    it('should show save and cancel buttons when draft is restored', () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      render(<MarkdownViewer {...mockProps} />);

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle corrupted draft data gracefully', () => {
      // Mock getDraft to throw an error
      vi.mocked(localStorage.getDraft).mockImplementation(() => {
        throw new Error('Corrupted draft data');
      });

      // Should not crash
      expect(() => render(<MarkdownViewer {...mockProps} />)).not.toThrow();
    });

    it('should handle todo change while draft exists', () => {
      vi.mocked(localStorage.getDraft).mockReturnValue(mockDraft);
      
      const { rerender } = render(<MarkdownViewer {...mockProps} />);

      // Change to different todo
      const newProps = { 
        ...mockProps, 
        todoId: 'different-todo-id',
        filePath: '/todos/different-task.md',
        content: '# Different task'
      };

      vi.mocked(localStorage.getDraft).mockReturnValue(null); // No draft for new todo
      rerender(<MarkdownViewer {...newProps} />);

      expect(localStorage.getDraft).toHaveBeenCalledWith(
        'different-todo-id',
        '/todos/different-task.md'
      );
    });

    it('should handle missing localStorage gracefully', () => {
      // Mock localStorage methods to throw errors
      vi.mocked(localStorage.getDraft).mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      vi.mocked(localStorage.saveDraft).mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      expect(() => render(<MarkdownViewer {...mockProps} />)).not.toThrow();
    });
  });
});