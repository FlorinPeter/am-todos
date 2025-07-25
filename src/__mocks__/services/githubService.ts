// Mock implementation of GitHub service for testing
import { vi } from 'vitest';

export const getTodos = vi.fn().mockResolvedValue([]);

export const createOrUpdateTodo = vi.fn().mockResolvedValue({
  content: { sha: 'mock-sha', path: 'mock-path' },
  commit: { sha: 'mock-commit-sha' }
});

export const ensureTodosDirectory = vi.fn().mockResolvedValue(undefined);

export const getFileContent = vi.fn().mockResolvedValue({
  content: '# Mock Content',
  sha: 'mock-sha'
});

export const ensureArchiveDirectory = vi.fn().mockResolvedValue(undefined);

export const moveTaskToArchive = vi.fn().mockResolvedValue(undefined);

export const moveTaskFromArchive = vi.fn().mockResolvedValue(undefined);

export const getFileHistory = vi.fn().mockResolvedValue([]);

export const getFileAtCommit = vi.fn().mockResolvedValue('# Mock Historical Content');