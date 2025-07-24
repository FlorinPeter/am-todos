/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GitHistory from '../GitHistory';
import * as gitService from '../../services/gitService';

// Setup matchers for testing-library
import { expect as vitestExpect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
vitestExpect.extend(matchers);

// Mock git service
vi.mock('../../services/gitService', () => ({
  getFileHistory: vi.fn(),
  getFileAtCommit: vi.fn()
}));

// Mock markdown parser to return old structure for GitHistory component
vi.mock('../../utils/markdown', () => ({
  parseMarkdownWithFrontmatter: vi.fn((content: string) => {
    // Parse the YAML frontmatter from the mock content
    if (content.includes('priority: 1')) {
      return {
        frontmatter: {
          title: 'High Priority Task',
          createdAt: '2023-10-27T10:00:00.000Z',
          priority: 1,
          isArchived: false,
          chatHistory: []
        },
        markdownContent: '# High Priority Task\n\n- [ ] Critical implementation'
      };
    } else if (content.includes('priority: 3')) {
      return {
        frontmatter: {
          title: 'Archived Task', 
          createdAt: '2023-10-26T09:00:00.000Z',
          priority: 3,
          isArchived: true,
          chatHistory: []
        },
        markdownContent: '# Archived Task\n\n- [x] Completed task'
      };
    }
    return {
      frontmatter: null,
      markdownContent: content
    };
  })
}));

const mockCommits = [
  {
    sha: 'abc123',
    message: 'High priority task',
    author: 'dev@example.com',
    date: '2023-10-27T10:00:00.000Z',
    url: 'https://github.com/owner/repo/commit/abc123'
  },
  {
    sha: 'def456',
    message: 'Archived task',
    author: 'dev@example.com',
    date: '2023-10-26T09:00:00.000Z',
    url: 'https://github.com/owner/repo/commit/def456'
  }
];

const mockFileContentWithP1 = `---
title: 'High Priority Task'
createdAt: '2023-10-27T10:00:00.000Z'
priority: 1
isArchived: false
chatHistory: []
---

# High Priority Task

- [ ] Critical implementation`;

const mockFileContentArchived = `---
title: 'Archived Task'
createdAt: '2023-10-26T09:00:00.000Z'
priority: 3
isArchived: true
chatHistory: []
---

# Archived Task

- [x] Completed task`;

describe('GitHistory - Metadata Display', () => {
  const mockProps = {
    filePath: 'test-file.md',
    onRestore: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(gitService.getFileHistory).mockResolvedValue(mockCommits);
    
    vi.mocked(gitService.getFileAtCommit).mockImplementation(async (filePath, sha) => {
      switch (sha) {
        case 'abc123':
          return { content: mockFileContentWithP1 };
        case 'def456':  
          return { content: mockFileContentArchived };
        default:
          throw new Error('File not found');
      }
    });
  });

  it('should display basic git history with commits', async () => {
    render(<GitHistory {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Git History')).toBeInTheDocument();
      expect(screen.getAllByText('High priority task')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Archived task')[0]).toBeInTheDocument();
    });
  });

  it('should show priority badges when frontmatter is loaded', async () => {
    render(<GitHistory {...mockProps} />);

    // Wait for commits to load
    await waitFor(() => {
      expect(screen.getAllByText('High priority task')[0]).toBeInTheDocument();
    });

    // Wait for frontmatter to be loaded (first 5 commits loaded upfront)
    await waitFor(() => {
      const p1Badges = document.querySelectorAll('span.bg-red-600');
      expect(p1Badges.length).toBeGreaterThan(0);
      
      const p3Badges = document.querySelectorAll('span.bg-yellow-600');
      expect(p3Badges.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('should show archive badges for archived tasks', async () => {
    render(<GitHistory {...mockProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Archived task')[0]).toBeInTheDocument();
    });

    // Wait for archive badge
    await waitFor(() => {
      const archiveBadges = document.querySelectorAll('span.bg-gray-700');
      const archiveBadge = Array.from(archiveBadges).find(badge => 
        badge.textContent?.includes('📁 ARCHIVED')
      );
      expect(archiveBadge).toBeTruthy();
    }, { timeout: 5000 });
  });

  it('should display metadata in preview panel when commit is selected', async () => {
    render(<GitHistory {...mockProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('High priority task')[0]).toBeInTheDocument();
    });

    // Click on first commit to preview (use the first occurrence)
    const commitElements = document.querySelectorAll('.cursor-pointer');
    expect(commitElements.length).toBeGreaterThan(0);
    
    fireEvent.click(commitElements[0]);

    // Wait for preview to load
    await waitFor(() => {
      expect(screen.getAllByText('Preview')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Restore This Version')[0]).toBeInTheDocument();
    });

    // Look for metadata section
    await waitFor(() => {
      const metadataHeaders = screen.queryAllByText('Metadata');
      expect(metadataHeaders.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('should call git service methods correctly', async () => {
    render(<GitHistory {...mockProps} />);

    await waitFor(() => {
      expect(vi.mocked(gitService.getFileHistory)).toHaveBeenCalledWith('test-file.md');
    });

    // Should load frontmatter for first commits upfront
    await waitFor(() => {
      expect(vi.mocked(gitService.getFileAtCommit)).toHaveBeenCalledWith('test-file.md', 'abc123');
      expect(vi.mocked(gitService.getFileAtCommit)).toHaveBeenCalledWith('test-file.md', 'def456');
    }, { timeout: 3000 });
  });

  it('should handle restore functionality', async () => {
    const mockOnRestore = vi.fn();
    render(<GitHistory {...mockProps} onRestore={mockOnRestore} />);

    await waitFor(() => {
      expect(screen.getAllByText('High priority task')[0]).toBeInTheDocument();
    });

    // Click on first commit
    const commitElements = document.querySelectorAll('.cursor-pointer');
    fireEvent.click(commitElements[0]);

    // Wait for preview and verify restore button is available
    await waitFor(() => {
      const restoreButtons = screen.getAllByText(/Restore/);
      expect(restoreButtons.length).toBeGreaterThan(0);
      
      // Verify the button is enabled and clickable
      const restoreButton = restoreButtons.find(btn => !btn.hasAttribute('disabled'));
      expect(restoreButton).toBeTruthy();
    });
  });
});