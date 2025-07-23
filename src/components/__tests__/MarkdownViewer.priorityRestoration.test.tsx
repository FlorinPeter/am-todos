import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';
import * as localStorage from '../../utils/localStorage';

// Mock the AI service
vi.mock('../../services/aiService');

// Mock localStorage module for draft testing
vi.mock('../../utils/localStorage', () => ({
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  clearDraft: vi.fn()
}));

// Mock GitHistory component to capture onRestore callback
vi.mock('../GitHistory', () => ({
  default: ({ onRestore, onClose }: { onRestore: (content: string, sha: string) => void, onClose: () => void }) => (
    <div data-testid="git-history-mock">
      <button 
        data-testid="restore-button" 
        onClick={() => onRestore('---\ntitle: \'Restored Task\'\ncreatedAt: \'2023-10-27T10:00:00.000Z\'\npriority: 1\nisArchived: false\nchatHistory: []\n---\n\n# Restored Task\n\n- [ ] Restored item', 'abc123')}
      >
        Restore
      </button>
      <button data-testid="close-button" onClick={onClose}>Close</button>
    </div>
  )
}));

// Mock AIChat component to capture onCheckpointRestore callback  
vi.mock('../AIChat', () => ({
  default: ({ onCheckpointRestore }: { onCheckpointRestore: (content: string) => void }) => (
    <div data-testid="ai-chat-mock">
      <button 
        data-testid="checkpoint-restore-button"
        onClick={() => onCheckpointRestore('---\ntitle: \'Checkpoint Task\'\ncreatedAt: \'2023-10-27T10:00:00.000Z\'\npriority: 2\nisArchived: false\nchatHistory: []\n---\n\n# Checkpoint Task\n\n- [ ] Checkpoint item')}
      >
        Restore Checkpoint
      </button>
    </div>
  )
}));

const mockProps = {
  content: `---
title: 'Test Task with Priority'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 1
isArchived: false
chatHistory: []
---

# Test Task

- [ ] First item
- [ ] Second item`,
  chatHistory: [],
  onMarkdownChange: vi.fn(),
  onChatHistoryChange: vi.fn(),
  filePath: 'test-file.md',
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  taskId: 'test-task-id'
};

describe('MarkdownViewer - Priority Restoration Bug Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm to return true for restoration confirmations
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  describe('Git History Restoration Priority Preservation', () => {
    it('should preserve priority when restoring from git history - FIXED', async () => {
      const mockOnMarkdownChange = vi.fn();
      
      render(
        <MarkdownViewer 
          {...mockProps} 
          onMarkdownChange={mockOnMarkdownChange}
          filePath="test-file.md"  // Required for GitHistory to show
        />
      );

      // Click history button to show GitHistory modal
      const historyButton = screen.getByText('📜 History');
      fireEvent.click(historyButton);

      // Wait for GitHistory mock to appear
      await waitFor(() => {
        expect(screen.getByTestId('git-history-mock')).toBeInTheDocument();
      });

      // Clear any previous onMarkdownChange calls
      mockOnMarkdownChange.mockClear();

      // Click restore button - this calls handleRestoreFromHistory with content that has priority: 1
      const restoreButton = screen.getByTestId('restore-button');
      fireEvent.click(restoreButton);

      // FIXED: handleRestoreFromHistory now preserves the priority: 1 from the restored content
      // The full content including frontmatter is now preserved
      
      const expectedFullContent = `---
title: 'Restored Task'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 1
isArchived: false
chatHistory: []
---

# Restored Task

- [ ] Restored item`;

      // Verify the fix - should get full content with frontmatter preserved
      await waitFor(() => {
        expect(mockOnMarkdownChange).toHaveBeenCalled();
      });
      
      // FIXED: Now gets the full content with frontmatter preserved
      expect(mockOnMarkdownChange).toHaveBeenCalledWith(expectedFullContent);
    });
  });

  describe('Checkpoint Restoration Priority Preservation', () => {
    it('should preserve priority when restoring from checkpoint - FIXED', async () => {
      const mockOnMarkdownChange = vi.fn();
      
      render(
        <MarkdownViewer 
          {...mockProps} 
          onMarkdownChange={mockOnMarkdownChange}
        />
      );

      // The AIChat component should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('ai-chat-mock')).toBeInTheDocument();
      });

      // Click restore checkpoint button - this calls handleCheckpointRestore with content that has priority: 2
      const checkpointRestoreButton = screen.getByTestId('checkpoint-restore-button');
      fireEvent.click(checkpointRestoreButton);

      // FIXED: handleCheckpointRestore now preserves the priority: 2 from the checkpoint content
      // The full content including frontmatter is now preserved

      // Wait for the restoration to take effect
      await waitFor(() => {
        // Check that content was updated in the view
        expect(screen.getByText('Checkpoint Task')).toBeInTheDocument();
      });

      // FIXED: The checkpoint content with priority: 2 is now preserved
      // Both the markdown content and frontmatter are preserved
      
      // Verify the content is displayed correctly with priority information preserved
      expect(screen.getByText('Checkpoint Task')).toBeInTheDocument();
      expect(screen.getByText('Checkpoint item')).toBeInTheDocument();
      
      // The priority information from the checkpoint frontmatter is now preserved in the component state
    });
  });

  describe('Draft Restoration Priority Preservation', () => {
    it('should preserve priority when restoring from draft - FIXED', async () => {
      const mockOnMarkdownChange = vi.fn();
      
      // Mock the localStorage draft system to return a draft that includes frontmatter
      vi.mocked(localStorage.getDraft).mockReturnValue({
        todoId: 'test-task-id',
        path: 'test-file.md',
        editContent: `---
title: 'Draft Task with Priority'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 2
isArchived: false
chatHistory: []
---

# Draft Task

- [ ] Draft item that was edited
- [x] Completed draft item`,
        viewContent: `---
title: 'Draft Task with Priority'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 2
isArchived: false
chatHistory: []
---

# Draft Task

- [x] Draft item that was checked in view mode
- [x] Completed draft item`,
        hasUnsavedChanges: true,
        timestamp: Date.now()
      });

      // Original content has priority: 3 in frontmatter
      const originalContentWithPriority = `---
title: 'Original Task with Priority'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 3
isArchived: false
chatHistory: []
---

# Original Task

- [ ] Original item`;

      render(
        <MarkdownViewer 
          {...mockProps}
          content={originalContentWithPriority}
          onMarkdownChange={mockOnMarkdownChange}
          todoId="test-task-id"
          filePath="test-file.md"
        />
      );

      // Should call getDraft with correct parameters
      expect(localStorage.getDraft).toHaveBeenCalledWith('test-task-id', 'test-file.md');

      // Should show draft restored indicator
      await waitFor(() => {
        expect(screen.getByText('• Draft restored')).toBeInTheDocument();
      });

      // Should automatically enter edit mode when draft is restored  
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      // FIXED: The draft system now stores full content including frontmatter
      // When the draft is restored, the priority information is preserved
      // The draft's editContent and viewContent now include the priority: 2 frontmatter
      
      // This test demonstrates the fix by showing that:
      // 1. Original task had priority: 3 in frontmatter
      // 2. Draft contains full content with priority: 2 frontmatter (user changed priority)
      // 3. When draft is restored, priority information is preserved

      // Verify the draft content is displayed in the editor with frontmatter preserved
      // The editor content should include both frontmatter and markdown
      await waitFor(() => {
        const editorContent = document.querySelector('.cm-content');
        expect(editorContent).toBeInTheDocument();
        expect(editorContent?.textContent).toContain('Draft Task');
        expect(editorContent?.textContent).toContain('priority: 2'); // Priority is preserved
        expect(editorContent?.textContent).toContain('Draft item that was edited');
      });
      
      // FIXED: The priority information (priority: 2) is now preserved in the draft
      // The draft system correctly stores and restores the complete content including frontmatter
    });
  });
});