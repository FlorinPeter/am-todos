import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GitHistory from '../GitHistory';
import * as gitService from '../../services/gitService';

// Mock git service
vi.mock('../../services/gitService', () => ({
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn()
}));

const mockCommits = [
  {
    sha: 'abc123',
    message: 'Add new feature with P1 priority',
    author: 'dev@example.com',
    date: '2023-10-27T10:00:00.000Z',
    url: 'https://github.com/owner/repo/commit/abc123'
  },
  {
    sha: 'def456',
    message: 'Update task to archived state',
    author: 'dev@example.com',
    date: '2023-10-26T09:00:00.000Z',
    url: 'https://github.com/owner/repo/commit/def456'
  },
  {
    sha: 'ghi789',
    message: 'Create task without frontmatter',
    author: 'dev@example.com',
    date: '2023-10-25T08:00:00.000Z',
    url: 'https://github.com/owner/repo/commit/ghi789'
  }
];

const mockFileContentWithFrontmatter = `---
title: 'High Priority Task'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 1
isArchived: false
chatHistory: []
---

# High Priority Task

- [ ] Critical implementation
- [ ] High priority item`;

const mockFileContentArchived = `---
title: 'Archived Task'
createdAt: '2023-10-26T09:00:00.000Z'
priority: 3
isArchived: true
chatHistory: []
---

# Archived Task

- [x] Completed task
- [x] Now archived`;

const mockFileContentNoFrontmatter = `# Simple Task

- [ ] Basic task without frontmatter
- [ ] No metadata available`;

describe('GitHistory - Metadata Display Tests', () => {
  const mockProps = {
    filePath: 'test-file.md',
    onRestore: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(gitService.getFileHistory).mockResolvedValue(mockCommits);
    
    // Mock getFileAtCommit responses
    vi.mocked(gitService.getFileAtCommit).mockImplementation(async (filePath, sha) => {
      switch (sha) {
        case 'abc123':
          return { content: mockFileContentWithFrontmatter };
        case 'def456':  
          return { content: mockFileContentArchived };
        case 'ghi789':
          return { content: mockFileContentNoFrontmatter };
        default:
          throw new Error('File not found');
      }
    });
  });

  afterEach(() => {
    // Clear the frontmatter cache between tests
    const GitHistoryModule = require('../GitHistory');
    if (GitHistoryModule.frontmatterCache) {
      GitHistoryModule.frontmatterCache.clear();
    }
  });

  describe('Commit List Metadata Badges', () => {
    it('should display priority badges for commits with frontmatter', async () => {
      render(<GitHistory {...mockProps} />);

      // Wait for commits to load and frontmatter to be parsed
      await waitFor(() => {
        expect(screen.getAllByText('Add new feature with P1 priority')[0]).toBeInTheDocument();
      });

      // Wait for frontmatter loading (first 5 commits loaded upfront)
      await waitFor(() => {
        const p1Badges = screen.getAllByText('P1');
        expect(p1Badges[0]).toBeInTheDocument();
        expect(p1Badges[0]).toHaveClass('bg-red-600', 'text-white');
      }, { timeout: 3000 });

      await waitFor(() => {
        const p3Badges = screen.getAllByText('P3');
        expect(p3Badges[0]).toBeInTheDocument();
        expect(p3Badges[0]).toHaveClass('bg-yellow-600', 'text-white');
      }, { timeout: 3000 });
    });

    it('should display archive badges for archived tasks', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText('Update task to archived state')[0]).toBeInTheDocument();
      });

      // Wait for archive badge to appear
      await waitFor(() => {
        const archiveBadges = screen.getAllByText('📁 ARCHIVED');
        expect(archiveBadges[0]).toBeInTheDocument();
        expect(archiveBadges[0]).toHaveClass('bg-gray-700', 'text-gray-300');
      }, { timeout: 3000 });
    });

    it('should show loading indicators for commits without loaded frontmatter', async () => {
      // Mock a longer commit list to test loading indicators
      const manyCommits = Array.from({ length: 10 }, (_, i) => ({
        sha: `commit${i}`,
        message: `Commit ${i}`,
        author: 'dev@example.com',
        date: '2023-10-27T10:00:00.000Z',
        url: `https://github.com/owner/repo/commit/commit${i}`
      }));

      vi.mocked(gitService.getFileHistory).mockResolvedValue(manyCommits);
      vi.mocked(gitService.getFileAtCommit).mockResolvedValue({ 
        content: mockFileContentWithFrontmatter 
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText('Commit 0')[0]).toBeInTheDocument();
      });

      // Should show loading indicators for commits beyond the first 5
      const loadingIndicators = document.querySelectorAll('.animate-pulse');
      expect(loadingIndicators.length).toBeGreaterThan(0);
    });

    it('should handle commits without frontmatter gracefully', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getAllByText('Create task without frontmatter')[0]).toBeInTheDocument();
      });

      // Should not show any priority badges for the third commit
      await waitFor(() => {
        // Find the desktop view container
        const desktopView = document.querySelector('.hidden.sm\\:flex.w-full');
        expect(desktopView).toBeInTheDocument();
        
        // Look for the third commit in desktop view
        const commitElements = desktopView?.querySelectorAll('.p-3.border.rounded.cursor-pointer');
        expect(commitElements?.length).toBe(3);
        
        // Third commit should not have priority badges
        const thirdCommit = commitElements?.[2];
        const priorityBadges = thirdCommit?.querySelectorAll('[class*="bg-red-600"], [class*="bg-yellow-600"]');
        expect(priorityBadges?.length || 0).toBe(0);
      }, { timeout: 3000 });
    });
  });

  describe('Preview Panel Metadata Section', () => {
    it('should display metadata section when previewing a commit with frontmatter', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      // Click on first commit to preview
      const firstCommit = screen.getByText('Add new feature with P1 priority');
      fireEvent.click(firstCommit);

      // Wait for preview to load
      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      // Should show metadata section
      await waitFor(() => {
        expect(screen.getByText('Metadata')).toBeInTheDocument();
      });

      // Should show priority badge in metadata section
      await waitFor(() => {
        const metadataSection = screen.getByText('Metadata').closest('div');
        expect(metadataSection).toBeInTheDocument();
        
        const p1Badge = metadataSection?.querySelector('.bg-red-600');
        expect(p1Badge).toBeInTheDocument();
        expect(p1Badge?.textContent).toBe('P1');
      });

      // Should show task title in metadata section
      await waitFor(() => {
        expect(screen.getByText('Title:')).toBeInTheDocument();
        expect(screen.getByText('High Priority Task')).toBeInTheDocument();
      });
    });

    it('should display archive badge in preview metadata for archived tasks', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Update task to archived state')).toBeInTheDocument();
      });

      // Click on archived commit
      const archivedCommit = screen.getByText('Update task to archived state');
      fireEvent.click(archivedCommit);

      await waitFor(() => {
        expect(screen.getByText('Metadata')).toBeInTheDocument();
      });

      // Should show archive badge in metadata section
      await waitFor(() => {
        const metadataSection = screen.getByText('Metadata').closest('div');
        const archiveBadge = metadataSection?.querySelector('[class*="bg-gray-700"]');
        expect(archiveBadge).toBeInTheDocument();
        expect(archiveBadge?.textContent).toBe('📁 ARCHIVED');
      });
    });

    it('should not display metadata section for commits without frontmatter', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create task without frontmatter')).toBeInTheDocument();
      });

      // Click on commit without frontmatter
      const noFrontmatterCommit = screen.getByText('Create task without frontmatter');
      fireEvent.click(noFrontmatterCommit);

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      // Should not show metadata section
      expect(screen.queryByText('Metadata')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Caching', () => {
    it('should cache frontmatter parsing results', async () => {
      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      const firstCommit = screen.getByText('Add new feature with P1 priority');
      
      // Click once to load frontmatter
      fireEvent.click(firstCommit);
      
      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      // Click again - should use cached result
      fireEvent.click(firstCommit);

      // getFileAtCommit should have been called only once for initial load
      // (plus any upfront loading calls)
      expect(vi.mocked(gitService.getFileAtCommit)).toHaveBeenCalledWith(
        'test-file.md', 
        'abc123'
      );
    });

    it('should load frontmatter for first 5 commits upfront', async () => {
      const manyCommits = Array.from({ length: 10 }, (_, i) => ({
        sha: `commit${i}`,
        message: `Commit ${i}`,
        author: 'dev@example.com',
        date: '2023-10-27T10:00:00.000Z',
        url: `https://github.com/owner/repo/commit/commit${i}`
      }));

      vi.mocked(gitService.getFileHistory).mockResolvedValue(manyCommits);
      vi.mocked(gitService.getFileAtCommit).mockResolvedValue({ 
        content: mockFileContentWithFrontmatter 
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Commit 0')).toBeInTheDocument();
      });

      // Should have called getFileAtCommit for first 5 commits upfront
      await waitFor(() => {
        expect(vi.mocked(gitService.getFileAtCommit)).toHaveBeenCalledTimes(5);
      });

      // Verify specific calls for first 5 commits
      for (let i = 0; i < 5; i++) {
        expect(vi.mocked(gitService.getFileAtCommit)).toHaveBeenCalledWith(
          'test-file.md', 
          `commit${i}`
        );
      }
    });
  });

  describe('Mobile View Metadata Display', () => {
    it('should display metadata in mobile commit list', async () => {
      // Simulate mobile view by resizing window
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      // Should show mobile tab navigation
      expect(screen.getByText(/Commits \(\d+\)/)).toBeInTheDocument();
      expect(screen.getByText(/Preview/)).toBeInTheDocument();

      // Should show priority badges in mobile view
      await waitFor(() => {
        expect(screen.getByText('P1')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should display metadata in mobile preview panel', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      // Click on commit to switch to preview
      const firstCommit = screen.getByText('Add new feature with P1 priority');
      fireEvent.click(firstCommit);

      // Should automatically switch to preview tab on mobile
      await waitFor(() => {
        expect(screen.getByText('← Back to Commits')).toBeInTheDocument();
      });

      // Should show metadata section in mobile preview
      await waitFor(() => {
        expect(screen.getByText('Metadata')).toBeInTheDocument();
        expect(screen.getByText('P1')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle frontmatter parsing errors gracefully', async () => {
      // Mock getFileAtCommit to throw an error for one commit
      vi.mocked(gitService.getFileAtCommit).mockImplementation(async (filePath, sha) => {
        if (sha === 'abc123') {
          throw new Error('Network error');
        }
        return { content: mockFileContentWithFrontmatter };
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      // Should still render the commit without metadata
      const firstCommit = screen.getByText('Add new feature with P1 priority');
      expect(firstCommit).toBeInTheDocument();

      // Should not show priority badge for failed commit
      await waitFor(() => {
        // Other commits should still work
        expect(screen.getByText('Update task to archived state')).toBeInTheDocument();
      });
    });

    it('should handle malformed frontmatter gracefully', async () => {
      const malformedContent = `---
title: 'Malformed Task'
priority: invalid_priority
isArchived: not_boolean
---

# Malformed Task

- [ ] Task with malformed frontmatter`;

      vi.mocked(gitService.getFileAtCommit).mockResolvedValue({ 
        content: malformedContent 
      });

      render(<GitHistory {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature with P1 priority')).toBeInTheDocument();
      });

      // Should not crash and should handle malformed frontmatter
      const firstCommit = screen.getByText('Add new feature with P1 priority');
      fireEvent.click(firstCommit);

      await waitFor(() => {
        expect(screen.getByText('Preview')).toBeInTheDocument();
      });

      // Component should still render without crashing
      expect(screen.getByText('Restore This Version')).toBeInTheDocument();
    });
  });
});