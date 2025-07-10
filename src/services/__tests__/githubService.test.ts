import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as githubService from '../githubService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for environment detection
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock console methods to avoid test output pollution
const originalConsole = console;
beforeEach(() => {
  console.log = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
});

// Helper to create mock fetch response
const mockResponse = (data: any, ok = true, status = 200, statusText = 'OK') => ({
  ok,
  status,
  statusText,
  json: vi.fn().mockResolvedValue(data),
  text: vi.fn().mockResolvedValue(typeof data === 'string' ? data : JSON.stringify(data)),
  headers: new Headers(),
});

describe('GitHub Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('createOrUpdateTodo', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';
    const mockContent = '# Test Content\n\n- [ ] Test task';
    const mockCommitMessage = 'feat: Add test todo';

    it('should create a new todo when no SHA is provided', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: mockPath },
        commit: { message: mockCommitMessage }
      }, true, 201));

      const result = await githubService.createOrUpdateTodo(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockContent,
        mockCommitMessage
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/github',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(mockPath)
        })
      );

      expect(result).toBeDefined();
    });

    it('should update existing todo when SHA is provided', async () => {
      const mockSha = 'abc123';
      
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: mockPath, sha: mockSha },
        commit: { message: mockCommitMessage }
      }));

      const result = await githubService.createOrUpdateTodo(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockContent,
        mockCommitMessage,
        mockSha
      );

      expect(result).toBeDefined();
    });

    it('should handle Unicode content correctly', async () => {
      const unicodeContent = '# 测试 Content 🚀\n\n- [ ] émoji task ñ';
      
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: mockPath }
      }, true, 201));

      await githubService.createOrUpdateTodo(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        unicodeContent,
        mockCommitMessage
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Invalid request', 
        false, 
        422, 
        'Unprocessable Entity'
      ));

      await expect(
        githubService.createOrUpdateTodo(
          mockToken,
          mockOwner,
          mockRepo,
          mockPath,
          mockContent,
          mockCommitMessage
        )
      ).rejects.toThrow();
    });

    it('should check for existing file when no SHA provided', async () => {
      // Mock getFileMetadata call
      mockFetch.mockResolvedValueOnce(mockResponse({
        sha: 'existing-sha',
        content: btoa(mockContent),
        path: mockPath,
        name: 'test.md'
      }));

      // Mock update request
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: mockPath },
        commit: { message: mockCommitMessage }
      }));

      await githubService.createOrUpdateTodo(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockContent,
        mockCommitMessage
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('ensureDirectory', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockFolder = 'todos';

    it('should not create directory if it already exists', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]));

      await githubService.ensureDirectory(mockToken, mockOwner, mockRepo, mockFolder);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should create directory with .gitkeep if it does not exist', async () => {
      // First call - check directory (fails)
      mockFetch.mockRejectedValueOnce(new Error('Not found'));

      // Second call - create .gitkeep file
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: `${mockFolder}/.gitkeep` }
      }, true, 201));

      await githubService.ensureDirectory(mockToken, mockOwner, mockRepo, mockFolder);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should use custom commit message when provided', async () => {
      const customMessage = 'chore: Create custom folder';
      
      mockFetch.mockRejectedValueOnce(new Error('Not found'));
      mockFetch.mockResolvedValueOnce(mockResponse({
        content: { path: `${mockFolder}/.gitkeep` }
      }, true, 201));

      await githubService.ensureDirectory(
        mockToken,
        mockOwner,
        mockRepo,
        mockFolder,
        customMessage
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if directory creation fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Not found'));
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Failed to create',
        false,
        422,
        'Unprocessable Entity'
      ));

      await expect(
        githubService.ensureDirectory(mockToken, mockOwner, mockRepo, mockFolder)
      ).rejects.toThrow();
    });
  });

  describe('ensureTodosDirectory', () => {
    it('should call ensureDirectory with todos folder', async () => {
      const ensureDirectorySpy = vi.spyOn(githubService, 'ensureDirectory').mockResolvedValue();
      
      const mockToken = 'test-token';
      const mockOwner = 'test-owner';
      const mockRepo = 'test-repo';

      await githubService.ensureTodosDirectory(mockToken, mockOwner, mockRepo);

      expect(ensureDirectorySpy).toHaveBeenCalledWith(
        mockToken,
        mockOwner,
        mockRepo,
        'todos',
        undefined
      );

      ensureDirectorySpy.mockRestore();
    });
  });

  describe('getTodos', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockFolder = 'todos';

    it('should return filtered markdown files from active folder', async () => {
      const mockFiles = [
        { name: 'test1.md', path: 'todos/test1.md', sha: 'sha1', type: 'file' },
        { name: 'test2.md', path: 'todos/test2.md', sha: 'sha2', type: 'file' },
        { name: '.gitkeep', path: 'todos/.gitkeep', sha: 'sha3', type: 'file' },
        { name: 'readme.txt', path: 'todos/readme.txt', sha: 'sha4', type: 'file' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockFiles));

      const result = await githubService.getTodos(mockToken, mockOwner, mockRepo, mockFolder);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1.md');
      expect(result[1].name).toBe('test2.md');
    });

    it('should return files from archive folder when includeArchived is true', async () => {
      const mockFiles = [
        { name: 'archived1.md', path: 'todos/archive/archived1.md', sha: 'sha1', type: 'file' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockFiles));

      const result = await githubService.getTodos(
        mockToken,
        mockOwner,
        mockRepo,
        mockFolder,
        true
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty array if directory does not exist (404)', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse('', false, 404, 'Not Found'));

      const result = await githubService.getTodos(mockToken, mockOwner, mockRepo, mockFolder);

      expect(result).toEqual([]);
    });

    it('should retry on network error', async () => {
      // First call fails with network error
      mockFetch.mockRejectedValueOnce(new TypeError('Load failed'));
      
      // Retry succeeds
      mockFetch.mockResolvedValueOnce(mockResponse([
        { name: 'test.md', path: 'todos/test.md', sha: 'sha1', type: 'file' }
      ]));

      const result = await githubService.getTodos(mockToken, mockOwner, mockRepo, mockFolder);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
    });

    it('should return empty array if retry also fails', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Load failed'));
      mockFetch.mockRejectedValueOnce(new TypeError('Load failed again'));

      const result = await githubService.getTodos(mockToken, mockOwner, mockRepo, mockFolder);

      expect(result).toEqual([]);
    });

    it('should throw error for non-404 HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Access denied',
        false,
        403,
        'Forbidden'
      ));

      await expect(
        githubService.getTodos(mockToken, mockOwner, mockRepo, mockFolder)
      ).rejects.toThrow();
    });
  });

  describe('getFileContent', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';

    it('should return file content as text', async () => {
      const mockContent = '# Test Content\n\n- [ ] Test task';
      
      mockFetch.mockResolvedValueOnce(mockResponse(mockContent));

      const result = await githubService.getFileContent(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath
      );

      expect(result).toBe(mockContent);
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse('', false, 404, 'Not Found'));

      await expect(
        githubService.getFileContent(mockToken, mockOwner, mockRepo, mockPath)
      ).rejects.toThrow();
    });
  });

  describe('getFileMetadata', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';

    it('should return decoded file metadata', async () => {
      const mockContent = '# Test Content';
      const mockMetadata = {
        sha: 'abc123',
        content: btoa(mockContent),
        path: mockPath,
        name: 'test.md'
      };

      mockFetch.mockResolvedValueOnce(mockResponse(mockMetadata));

      const result = await githubService.getFileMetadata(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath
      );

      expect(result).toEqual({
        sha: 'abc123',
        content: mockContent,
        path: mockPath,
        name: 'test.md'
      });
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse('', false, 404, 'Not Found'));

      await expect(
        githubService.getFileMetadata(mockToken, mockOwner, mockRepo, mockPath)
      ).rejects.toThrow();
    });
  });

  describe('deleteFile', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';
    const mockSha = 'file-sha';
    const mockCommitMessage = 'Delete test file';

    it('should delete file successfully', async () => {
      const mockResult = { message: 'File deleted' };
      
      mockFetch.mockResolvedValueOnce(mockResponse(mockResult));

      const result = await githubService.deleteFile(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockSha,
        mockCommitMessage
      );

      expect(result).toBe(mockResult);
    });

    it('should throw error on failed deletion', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'File not found',
        false,
        404,
        'Not Found'
      ));

      await expect(
        githubService.deleteFile(
          mockToken,
          mockOwner,
          mockRepo,
          mockPath,
          mockSha,
          mockCommitMessage
        )
      ).rejects.toThrow();
    });
  });

  describe('getFileHistory', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';

    it('should return file history commits', async () => {
      const mockCommits = [
        { sha: 'commit1', message: 'Initial commit' },
        { sha: 'commit2', message: 'Update file' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse({ commits: mockCommits }));

      const result = await githubService.getFileHistory(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath
      );

      expect(result).toEqual(mockCommits);
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'History not found',
        false,
        404,
        'Not Found'
      ));

      await expect(
        githubService.getFileHistory(mockToken, mockOwner, mockRepo, mockPath)
      ).rejects.toThrow();
    });
  });

  describe('listProjectFolders', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';

    it('should return filtered project folders', async () => {
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'work-tasks', type: 'dir' },
        { name: 'personal', type: 'dir' },
        { name: 'invalid@name', type: 'dir' },
        { name: 'README.md', type: 'file' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockContents));

      const result = await githubService.listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal');
      expect(result).not.toContain('invalid@name');
      expect(result).not.toContain('README.md');
    });

    it('should return default todos folder on error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse('', false, 403, 'Forbidden'));

      const result = await githubService.listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toEqual(['todos']);
    });

    it('should include todos folder even if not in results', async () => {
      const mockContents = [
        { name: 'work', type: 'dir' },
        { name: 'personal', type: 'dir' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockContents));

      const result = await githubService.listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toContain('todos');
      expect(result[0]).toBe('todos'); // Should be first
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await githubService.listProjectFolders(mockToken, mockOwner, mockRepo);

      expect(result).toEqual(['todos']);
    });
  });

  describe('createProjectFolder', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockFolderName = 'new-project';

    it('should create project folder with .gitkeep files', async () => {
      const createUpdateSpy = vi.spyOn(githubService, 'createOrUpdateTodo').mockResolvedValue({});

      await githubService.createProjectFolder(mockToken, mockOwner, mockRepo, mockFolderName);

      expect(createUpdateSpy).toHaveBeenCalledTimes(2);
      expect(createUpdateSpy).toHaveBeenNthCalledWith(
        1,
        mockToken,
        mockOwner,
        mockRepo,
        'new-project/.gitkeep',
        expect.stringContaining('new-project Project'),
        'feat: Create new-project project folder'
      );

      createUpdateSpy.mockRestore();
    });

    it('should validate folder name', async () => {
      await expect(
        githubService.createProjectFolder(mockToken, mockOwner, mockRepo, 'invalid@name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        githubService.createProjectFolder(mockToken, mockOwner, mockRepo, '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        githubService.createProjectFolder(mockToken, mockOwner, mockRepo, '123invalid')
      ).rejects.toThrow('Invalid folder name');
    });
  });

  describe('getFileAtCommit', () => {
    const mockToken = 'test-token';
    const mockOwner = 'test-owner';
    const mockRepo = 'test-repo';
    const mockPath = 'todos/test.md';
    const mockSha = 'commit-sha';

    it('should return file content at specific commit', async () => {
      const mockData = { content: '# Old version', sha: mockSha };

      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await githubService.getFileAtCommit(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockSha
      );

      expect(result).toBe(mockData);
    });

    it('should throw error on failed request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Commit not found',
        false,
        404,
        'Not Found'
      ));

      await expect(
        githubService.getFileAtCommit(mockToken, mockOwner, mockRepo, mockPath, mockSha)
      ).rejects.toThrow();
    });
  });

  describe('Archive operations', () => {
    it('should move task to archive', async () => {
      const mockToken = 'test-token';
      const mockOwner = 'test-owner';
      const mockRepo = 'test-repo';
      const mockPath = 'todos/test.md';
      const mockContent = '# Test';
      const mockCommitMessage = 'Archive test task';

      const ensureArchiveSpy = vi.spyOn(githubService, 'ensureArchiveDirectory').mockResolvedValue();
      const getMetadataSpy = vi.spyOn(githubService, 'getFileMetadata').mockResolvedValue({
        sha: 'file-sha',
        content: mockContent,
        path: mockPath,
        name: 'test.md'
      });
      const createUpdateSpy = vi.spyOn(githubService, 'createOrUpdateTodo').mockResolvedValue({});
      const deleteSpy = vi.spyOn(githubService, 'deleteFile').mockResolvedValue({});

      const result = await githubService.moveTaskToArchive(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockContent,
        mockCommitMessage
      );

      expect(result).toBe('todos/archive/test.md');

      ensureArchiveSpy.mockRestore();
      getMetadataSpy.mockRestore();
      createUpdateSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    it('should move task from archive', async () => {
      const mockToken = 'test-token';
      const mockOwner = 'test-owner';
      const mockRepo = 'test-repo';
      const mockPath = 'todos/archive/test.md';
      const mockContent = '# Test';
      const mockCommitMessage = 'Unarchive test task';

      const getMetadataSpy = vi.spyOn(githubService, 'getFileMetadata').mockResolvedValue({
        sha: 'file-sha',
        content: mockContent,
        path: mockPath,
        name: 'test.md'
      });
      const createUpdateSpy = vi.spyOn(githubService, 'createOrUpdateTodo').mockResolvedValue({});
      const deleteSpy = vi.spyOn(githubService, 'deleteFile').mockResolvedValue({});

      const result = await githubService.moveTaskFromArchive(
        mockToken,
        mockOwner,
        mockRepo,
        mockPath,
        mockContent,
        mockCommitMessage
      );

      expect(result).toBe('todos/test.md');

      getMetadataSpy.mockRestore();
      createUpdateSpy.mockRestore();
      deleteSpy.mockRestore();
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      expect(mockLocation.hostname).toBe('localhost');
      expect(mockLocation.port).toBe('3000');
    });
  });
});