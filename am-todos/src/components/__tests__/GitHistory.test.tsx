import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GitHistory from '../GitHistory';

// Mock the GitHub service
vi.mock('../../services/githubService');

const mockProps = {
  token: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  filePath: 'todos/test-file.md',
  onRestore: vi.fn(),
  onClose: vi.fn()
};

const mockCommits = [
  {
    sha: 'abc123',
    commit: {
      message: 'feat: Add new todo task',
      author: {
        name: 'Test User',
        date: '2025-01-01T00:00:00Z'
      }
    }
  },
  {
    sha: 'def456',
    commit: {
      message: 'fix: Update task priority',
      author: {
        name: 'Test User',
        date: '2025-01-02T00:00:00Z'
      }
    }
  }
];

describe('GitHistory - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for GitHub API calls
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCommits)
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          content: btoa('# Previous Version\n\n- [ ] Old task')
        })
      });
  });

  describe('Feature 9: Git History & Version Control', () => {
    it('renders git history modal', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/git history/i) || screen.getByText(/version history/i)).toBeInTheDocument();
      });
    });

    it('shows close button', () => {
      render(<GitHistory {...mockProps} />);
      
      const closeButton = screen.getByText(/close/i) || 
                         screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
      render(<GitHistory {...mockProps} />);
      
      const closeButton = screen.getByText(/close/i) || 
                         screen.getByRole('button', { name: /close/i });
      await userEvent.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('loads and displays commit history', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('feat: Add new todo task')).toBeInTheDocument();
        expect(screen.getByText('fix: Update task priority')).toBeInTheDocument();
      });
    });

    it('shows commit metadata (author, date)', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText(/2025/)).toBeInTheDocument();
      });
    });

    it('shows commit SHA (short format)', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/abc123/i) || screen.getByText(/abc/i)).toBeInTheDocument();
      });
    });

    it('loads file content when commit selected', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        expect(commitItem).toBeInTheDocument();
      });
      
      const commitButton = screen.getByText('feat: Add new todo task');
      await userEvent.click(commitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Previous Version/i) || screen.getByText(/Old task/i)).toBeInTheDocument();
      });
    });

    it('shows restore button for selected commit', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        await userEvent.click(commitItem);
      });
      
      await waitFor(() => {
        const restoreButton = screen.getByText(/restore/i);
        expect(restoreButton).toBeInTheDocument();
      });
    });

    it('calls onRestore when restore button clicked', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        await userEvent.click(commitItem);
      });
      
      await waitFor(() => {
        const restoreButton = screen.getByText(/restore/i);
        await userEvent.click(restoreButton);
      });
      
      expect(mockProps.onRestore).toHaveBeenCalledWith(
        '# Previous Version\n\n- [ ] Old task',
        'abc123'
      );
    });

    it('shows loading state while fetching history', () => {
      render(<GitHistory {...mockProps} />);
      
      expect(screen.getByText(/loading/i) || screen.getByText(/fetching/i)).toBeInTheDocument();
    });

    it('shows loading state while fetching file content', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        userEvent.click(commitItem);
      });
      
      // Should show loading for file content
      expect(screen.getByText(/loading/i) || screen.getByText(/fetching/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
      
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i) || screen.getByText(/failed/i)).toBeInTheDocument();
      });
    });

    it('handles empty commit history', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });
      
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/no history/i) || screen.getByText(/no commits/i)).toBeInTheDocument();
      });
    });

    it('handles file not found in commit', async () => {
      (fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCommits)
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404
        });
      
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        userEvent.click(commitItem);
      });
      
      await waitFor(() => {
        expect(screen.getByText(/not found/i) || screen.getByText(/unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('UI and UX', () => {
    it('displays commits in chronological order', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commits = screen.getAllByText(/feat:|fix:/);
        expect(commits).toHaveLength(2);
        
        // Most recent first
        expect(commits[0]).toHaveTextContent('fix: Update task priority');
        expect(commits[1]).toHaveTextContent('feat: Add new todo task');
      });
    });

    it('highlights selected commit', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        userEvent.click(commitItem);
      });
      
      const selectedCommit = screen.getByText('feat: Add new todo task').closest('div');
      expect(selectedCommit).toHaveClass('bg-blue-600');
    });

    it('shows file diff or content preview', async () => {
      render(<GitHistory {...mockProps} />);
      
      await waitFor(() => {
        const commitItem = screen.getByText('feat: Add new todo task');
        userEvent.click(commitItem);
      });
      
      await waitFor(() => {
        // Should show content preview area
        const preview = document.querySelector('.preview') || 
                       document.querySelector('.content');
        expect(preview).toBeInTheDocument();
      });
    });

    it('handles modal keyboard navigation', async () => {
      render(<GitHistory {...mockProps} />);
      
      // Test Escape key closes modal
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });
});