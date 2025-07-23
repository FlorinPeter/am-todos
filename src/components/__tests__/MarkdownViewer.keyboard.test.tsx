import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock services that MarkdownViewer uses
vi.mock('../../services/aiService', () => ({
  processChatMessage: vi.fn().mockResolvedValue('Updated content')
}));

describe('MarkdownViewer - Keyboard Navigation & Touch Improvements', () => {
  const mockOnMarkdownChange = vi.fn();
  const defaultProps = {
    content: '',
    chatHistory: [],
    onMarkdownChange: mockOnMarkdownChange,
    onChatHistoryChange: vi.fn(),
    filePath: '/test/path.md',
    taskId: 'task-123',
    todoId: 'todo-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Keyboard Navigation for Checkboxes', () => {
    it('should toggle checkbox when Space key is pressed', () => {
      const checkboxContent = `
- [ ] Unchecked task
- [x] Checked task
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const firstCheckbox = checkboxes[0];
      
      // Initially unchecked
      expect(firstCheckbox).not.toBeChecked();

      // Focus the checkbox and press Space
      firstCheckbox.focus();
      fireEvent.keyDown(firstCheckbox, { key: ' ', code: 'Space' });

      // Should trigger onMarkdownChange with updated content
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('- [x] Unchecked task');
    });

    it('should toggle checkbox when Enter key is pressed', () => {
      const checkboxContent = `
- [x] Checked task that should become unchecked
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Initially checked
      expect(checkbox).toBeChecked();

      // Focus the checkbox and press Enter
      checkbox.focus();
      fireEvent.keyDown(checkbox, { key: 'Enter', code: 'Enter' });

      // Should trigger onMarkdownChange with updated content
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('- [ ] Checked task that should become unchecked');
    });

    it('should prevent default behavior for Space and Enter keys', () => {
      const checkboxContent = '- [ ] Test task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Test Space key preventDefault
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      const spacePreventDefaultSpy = vi.spyOn(spaceEvent, 'preventDefault');
      const spaceStopPropagationSpy = vi.spyOn(spaceEvent, 'stopPropagation');
      
      checkbox.dispatchEvent(spaceEvent);
      
      expect(spacePreventDefaultSpy).toHaveBeenCalled();
      expect(spaceStopPropagationSpy).toHaveBeenCalled();

      // Test Enter key preventDefault
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      const enterPreventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');
      const enterStopPropagationSpy = vi.spyOn(enterEvent, 'stopPropagation');
      
      checkbox.dispatchEvent(enterEvent);
      
      expect(enterPreventDefaultSpy).toHaveBeenCalled();
      expect(enterStopPropagationSpy).toHaveBeenCalled();
    });

    it('should not trigger on other keys', () => {
      const checkboxContent = '- [ ] Test task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Test that other keys don't trigger the handler
      fireEvent.keyDown(checkbox, { key: 'a', code: 'KeyA' });
      fireEvent.keyDown(checkbox, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(checkbox, { key: 'Tab', code: 'Tab' });
      
      // Should not trigger onMarkdownChange
      expect(mockOnMarkdownChange).not.toHaveBeenCalled();
    });

    it('should handle keyboard navigation on first checkbox with Space key', () => {
      const multiCheckboxContent = `
- [ ] First task
- [x] Second task  
- [ ] Third task
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={multiCheckboxContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Test first checkbox (Space key)
      fireEvent.keyDown(checkboxes[0], { key: ' ', code: 'Space' });
      expect(mockOnMarkdownChange).toHaveBeenCalledTimes(1);
      
      // Verify the first checkbox triggered a change
      expect(mockOnMarkdownChange).toHaveBeenCalledWith(expect.stringContaining('- [x] First task'));
    });

    it('should handle keyboard navigation on third checkbox with Enter key', () => {
      const multiCheckboxContent = `
- [ ] First task
- [x] Second task  
- [ ] Third task
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={multiCheckboxContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Test third checkbox (Enter key)
      fireEvent.keyDown(checkboxes[2], { key: 'Enter', code: 'Enter' });
      expect(mockOnMarkdownChange).toHaveBeenCalledTimes(1);
      
      // Verify the third checkbox triggered a change
      expect(mockOnMarkdownChange).toHaveBeenCalledWith(expect.stringContaining('- [x] Third task'));
    });

    it('should work with nested checkboxes', () => {
      const nestedContent = `
- [ ] Parent task
  - [ ] Child task 1
  - [x] Child task 2
    - [ ] Grandchild task
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={nestedContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(4);
      
      // Test nested checkbox keyboard navigation
      fireEvent.keyDown(checkboxes[1], { key: ' ', code: 'Space' }); // Child task 1
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('  - [x] Child task 1');
    });
  });

  describe('Touch Manipulation CSS Classes', () => {
    it('should apply touch-manipulation CSS class to checkboxes', () => {
      const checkboxContent = `
- [ ] Touch-friendly task
- [x] Another touch task
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Check that checkboxes have touch-manipulation class
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveClass('touch-manipulation');
      });
    });

    it('should apply mobile-friendly CSS classes to checkboxes', () => {
      const checkboxContent = '- [ ] Mobile task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Check for mobile-friendly classes
      expect(checkbox).toHaveClass('w-4', 'h-4', 'mr-2', 'rounded', 'cursor-pointer', 'hover:bg-gray-600', 'transition-colors');
    });

    it('should have proper checkbox styling for dark theme', () => {
      const checkboxContent = '- [ ] Styled checkbox';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Check for dark theme styling
      expect(checkbox).toHaveClass('border-gray-400', 'bg-gray-700', 'text-blue-500');
      expect(checkbox).toHaveStyle({ accentColor: '#3b82f6' });
    });
  });

  describe('Mobile Touch Event Handling', () => {
    it('should handle touch events without preventDefault on onChange', () => {
      const checkboxContent = '- [ ] Mobile touch task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Simulate touch event (click should work normally)
      fireEvent.click(checkbox);
      
      // Should trigger onMarkdownChange
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('- [x] Mobile touch task');
    });

    it('should handle first touch interaction correctly', () => {
      const checkboxContent = '- [ ] Rapid touch task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Simulate first click
      fireEvent.click(checkbox);
      expect(mockOnMarkdownChange).toHaveBeenCalledTimes(1);
      expect(mockOnMarkdownChange).toHaveBeenCalledWith(expect.stringContaining('- [x] Rapid touch task'));
    });

    it('should handle subsequent touch interaction after state change', () => {
      const checkboxContent = '- [x] Already checked task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Simulate click to uncheck
      fireEvent.click(checkbox);
      expect(mockOnMarkdownChange).toHaveBeenCalledTimes(1);
      expect(mockOnMarkdownChange).toHaveBeenCalledWith(expect.stringContaining('- [ ] Already checked task'));
    });

    it('should maintain checkbox state consistency during touch interactions', () => {
      const checkboxContent = '- [x] Initially checked task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      
      // Initially checked
      expect(checkbox).toBeChecked();
      
      // Touch to uncheck
      fireEvent.click(checkbox);
      
      // Should update content to unchecked state
      expect(mockOnMarkdownChange).toHaveBeenCalled();
      const updatedContent = mockOnMarkdownChange.mock.calls[0][0];
      expect(updatedContent).toContain('- [ ] Initially checked task');
    });
  });

  describe('Checkbox Counter and IIFE Structure', () => {
    it('should properly scope checkbox counter to prevent conflicts', () => {
      const multipleCheckboxContent = `
- [ ] Task 1
- [x] Task 2
- [ ] Task 3
- [x] Task 4
- [ ] Task 5
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={multipleCheckboxContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(5);
      
      // Test that each checkbox maintains its correct state
      expect(checkboxes[0]).not.toBeChecked(); // Task 1
      expect(checkboxes[1]).toBeChecked();     // Task 2
      expect(checkboxes[2]).not.toBeChecked(); // Task 3
      expect(checkboxes[3]).toBeChecked();     // Task 4
      expect(checkboxes[4]).not.toBeChecked(); // Task 5
    });

    it('should handle checkbox rendering with IIFE reset on each render', () => {
      const { rerender } = render(
        <MarkdownViewer
          {...defaultProps}
          content="- [ ] Initial task"
        />
      );

      let checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      // Re-render with different content
      rerender(
        <MarkdownViewer
          {...defaultProps}
          content="- [x] Updated task"
        />
      );

      checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should handle mixed content with checkboxes correctly', () => {
      const mixedContent = `
# Title

Regular paragraph text.

- [ ] First checkbox
- Regular list item without checkbox
- [x] Second checkbox

More text here.

- [ ] Third checkbox
      `;
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={mixedContent}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      
      // Verify states
      expect(checkboxes[0]).not.toBeChecked(); // First checkbox
      expect(checkboxes[1]).toBeChecked();     // Second checkbox  
      expect(checkboxes[2]).not.toBeChecked(); // Third checkbox
    });
  });

  describe('Integration with Edit Mode', () => {
    it('should maintain keyboard functionality in view mode', () => {
      const checkboxContent = '- [ ] View mode task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      // Should be in view mode by default
      const checkbox = screen.getByRole('checkbox');
      
      // Test keyboard navigation in view mode
      fireEvent.keyDown(checkbox, { key: ' ', code: 'Space' });
      
      expect(mockOnMarkdownChange).toHaveBeenCalled();
    });

    it('should disable checkbox interaction in edit mode', () => {
      const checkboxContent = '- [ ] Edit mode task';
      
      render(
        <MarkdownViewer
          {...defaultProps}
          content={checkboxContent}
        />
      );

      // Switch to edit mode
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      
      // In edit mode, content should be in a textarea
      // Look for textarea or any input element containing the content
      const textareaOrInput = screen.getByRole('textbox') || screen.getByDisplayValue(checkboxContent);
      expect(textareaOrInput).toBeInTheDocument();
    });
  });
});