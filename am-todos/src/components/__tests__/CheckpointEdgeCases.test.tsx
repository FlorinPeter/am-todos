import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AIChat from '../AIChat';
import * as localStorage from '../../utils/localStorage';

// Mock localStorage functions
vi.mock('../../utils/localStorage', () => ({
  saveCheckpoint: vi.fn(),
  getCheckpoints: vi.fn(() => []),
  clearCheckpoints: vi.fn(),
  generateCheckpointId: vi.fn(() => 'test-checkpoint-id'),
  saveSettings: vi.fn(),
  loadSettings: vi.fn(),
  encodeSettingsToUrl: vi.fn(),
  decodeSettingsFromUrl: vi.fn(),
  getUrlConfig: vi.fn()
}));

// Mock scrollIntoView
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

describe('Checkpoint System Edge Cases', () => {
  const mockProps = {
    currentContent: '# Test Todo\n\n- [ ] Task 1\n- [ ] Task 2',
    onContentUpdate: vi.fn(),
    onChatMessage: vi.fn().mockResolvedValue('Updated content'),
    taskId: 'test-task-id',
    onCheckpointRestore: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getCheckpoints).mockReturnValue([]);
    vi.mocked(localStorage.generateCheckpointId).mockReturnValue('test-checkpoint-id');
  });

  describe('Basic Functionality', () => {
    it('renders without crashing', () => {
      render(<AIChat {...mockProps} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('handles missing taskId gracefully', () => {
      render(<AIChat {...mockProps} taskId={undefined} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('handles missing onCheckpointRestore callback', () => {
      render(<AIChat {...mockProps} onCheckpointRestore={undefined} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('handles empty taskId gracefully', () => {
      render(<AIChat {...mockProps} taskId="" />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });

    it('handles corrupted checkpoint data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(localStorage.getCheckpoints).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      render(<AIChat {...mockProps} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('handles taskId changes', () => {
      const { rerender } = render(<AIChat {...mockProps} taskId="task-1" />);
      
      rerender(<AIChat {...mockProps} taskId="task-2" />);

      expect(localStorage.getCheckpoints).toHaveBeenCalledWith('task-2');
    });

    it('handles component unmounting', () => {
      const { unmount } = render(<AIChat {...mockProps} />);
      
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      unmount();
      // Should not throw errors
    });

    it('handles content prop changes', () => {
      const { rerender } = render(<AIChat {...mockProps} />);
      
      rerender(<AIChat {...mockProps} currentContent="# Changed content" />);
      
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage save errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(localStorage.saveCheckpoint).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      render(<AIChat {...mockProps} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('handles checkpoint restore errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockProps.onCheckpointRestore.mockImplementation(() => {
        throw new Error('Restore failed');
      });

      render(<AIChat {...mockProps} />);
      expect(screen.getByText(/AI Chat Assistant/i)).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });
});