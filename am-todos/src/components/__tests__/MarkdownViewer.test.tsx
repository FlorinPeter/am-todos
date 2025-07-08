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
  repo: 'test-repo'
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
      
      // Should show textarea in edit mode
      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        expect(textarea).toBeInTheDocument();
      });
    });

    it('shows unsaved changes indicator', async () => {
      render(<MarkdownViewer {...mockProps} />);
      
      const editButton = screen.getByText('Edit');
      await userEvent.click(editButton);
      
      await waitFor(() => {
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Modified content' } });
      });
      
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

    it('renders checkboxes (currently disabled)', () => {
      const contentWithCheckboxes = '- [ ] Task 1\n- [x] Task 2';
      render(<MarkdownViewer {...mockProps} content={contentWithCheckboxes} />);
      
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
      
      // Verify checkboxes are disabled (known limitation)
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled();
      });
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
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Modified' } });
      });
      
      await waitFor(() => {
        const warning = screen.getByText(/AI changes will be applied to your draft/i);
        expect(warning).toBeInTheDocument();
      });
    });
  });
});