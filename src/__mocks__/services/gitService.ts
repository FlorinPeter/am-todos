// Mock implementation of Git service router for testing
import { vi } from 'vitest';

export const getGitSettings = vi.fn().mockReturnValue({
  provider: 'github',
  folder: 'todos',
  pat: 'mock-pat',
  owner: 'mock-owner',
  repo: 'mock-repo'
});

export const ensureDirectory = vi.fn().mockResolvedValue(undefined);

export const getTodos = vi.fn().mockResolvedValue([
  { name: 'mock-todo.md', path: 'todos/mock-todo.md', sha: 'mock-sha' }
]);

export const getFileContent = vi.fn().mockResolvedValue('# Mock Todo\n\n- [ ] Mock task');

export const moveTaskToArchive = vi.fn().mockResolvedValue('todos/archive/mock-todo.md');

export const moveTaskFromArchive = vi.fn().mockResolvedValue('todos/mock-todo.md');

export const deleteFile = vi.fn().mockResolvedValue({ message: 'File deleted successfully' });

export const getFileHistory = vi.fn().mockResolvedValue([
  {
    sha: 'commit-sha',
    message: 'Mock commit message',
    author: 'Mock Author',
    date: '2023-01-01T00:00:00Z',
    url: 'https://mock-git-provider.com/user/repo/commit/commit-sha'
  }
]);

export const getFileAtCommit = vi.fn().mockResolvedValue({
  content: '# Mock Todo at commit',
  sha: 'commit-sha'
});

export const listProjectFolders = vi.fn().mockResolvedValue(['todos', 'work-tasks', 'personal']);

export const createProjectFolder = vi.fn().mockResolvedValue(undefined);