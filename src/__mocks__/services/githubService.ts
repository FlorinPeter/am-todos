// Mock implementation of GitHub service for testing

export const getTodos = jest.fn().mockResolvedValue([]);

export const createOrUpdateTodo = jest.fn().mockResolvedValue({
  content: { sha: 'mock-sha', path: 'mock-path' },
  commit: { sha: 'mock-commit-sha' }
});

export const ensureTodosDirectory = jest.fn().mockResolvedValue(undefined);

export const getFileContent = jest.fn().mockResolvedValue({
  content: '# Mock Content',
  sha: 'mock-sha'
});

export const ensureArchiveDirectory = jest.fn().mockResolvedValue(undefined);

export const moveTaskToArchive = jest.fn().mockResolvedValue(undefined);

export const moveTaskFromArchive = jest.fn().mockResolvedValue(undefined);

export const getFileHistory = jest.fn().mockResolvedValue([]);

export const getFileAtCommit = jest.fn().mockResolvedValue('# Mock Historical Content');