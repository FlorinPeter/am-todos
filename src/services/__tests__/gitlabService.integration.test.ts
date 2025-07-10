import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as gitlabService from '../gitlabService';

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

describe('GitLab Service Integration Tests', () => {
  const mockSettings = {
    instanceUrl: 'https://gitlab.example.com',
    projectId: '12345',
    token: 'test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('createOrUpdateTodo', () => {
    it('should create a new todo', async () => {
      const mockResult = { file_path: 'todos/test.md', branch: 'main' };
      mockFetch.mockResolvedValueOnce(mockResponse(mockResult));

      const result = await gitlabService.createOrUpdateTodo(
        mockSettings,
        'todos/test.md',
        '# Test Content',
        'feat: Add test todo'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createOrUpdateFile',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md',
            content: '# Test Content',
            commitMessage: 'feat: Add test todo'
          })
        }
      );

      expect(result).toEqual(mockResult);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Permission denied',
        false,
        403,
        'Forbidden'
      ));

      await expect(
        gitlabService.createOrUpdateTodo(
          mockSettings,
          'todos/test.md',
          '# Test',
          'feat: Add test'
        )
      ).rejects.toThrow('GitLab API proxy error: Forbidden');
    });
  });

  describe('ensureDirectory', () => {
    it('should not create directory if it already exists', async () => {
      // Mock getTodos succeeding (directory exists)
      const getTodosSpy = vi.spyOn(gitlabService, 'getTodos').mockResolvedValue([
        { name: 'existing.md', path: 'todos/existing.md', sha: 'sha1' }
      ]);

      await gitlabService.ensureDirectory(mockSettings, 'todos');

      expect(getTodosSpy).toHaveBeenCalledWith(mockSettings, 'todos');
      getTodosSpy.mockRestore();
    });

    it('should create directory if it does not exist', async () => {
      // Mock getTodos failing (directory doesn't exist)
      const getTodosSpy = vi.spyOn(gitlabService, 'getTodos').mockRejectedValue(new Error('Not found'));
      const createUpdateSpy = vi.spyOn(gitlabService, 'createOrUpdateTodo').mockResolvedValue({});

      await gitlabService.ensureDirectory(mockSettings, 'todos');

      expect(getTodosSpy).toHaveBeenCalledWith(mockSettings, 'todos');
      expect(createUpdateSpy).toHaveBeenCalledWith(
        mockSettings,
        'todos/.gitkeep',
        '# This file ensures the todos directory exists\n',
        'feat: Create todos directory'
      );

      getTodosSpy.mockRestore();
      createUpdateSpy.mockRestore();
    });

    it('should use custom commit message', async () => {
      const getTodosSpy = vi.spyOn(gitlabService, 'getTodos').mockRejectedValue(new Error('Not found'));
      const createUpdateSpy = vi.spyOn(gitlabService, 'createOrUpdateTodo').mockResolvedValue({});

      await gitlabService.ensureDirectory(mockSettings, 'work', 'chore: Setup work folder');

      expect(createUpdateSpy).toHaveBeenCalledWith(
        mockSettings,
        'work/.gitkeep',
        '# This file ensures the work directory exists\n',
        'chore: Setup work folder'
      );

      getTodosSpy.mockRestore();
      createUpdateSpy.mockRestore();
    });
  });

  describe('getTodos', () => {
    it('should return filtered markdown files from active folder', async () => {
      const mockFiles = [
        { name: 'test1.md', path: 'todos/test1.md', sha: 'sha1', type: 'blob' },
        { name: 'test2.md', path: 'todos/test2.md', sha: 'sha2', type: 'blob' },
        { name: '.gitkeep', path: 'todos/.gitkeep', sha: 'sha3', type: 'blob' },
        { name: 'readme.txt', path: 'todos/readme.txt', sha: 'sha4', type: 'blob' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockFiles));

      const result = await gitlabService.getTodos(mockSettings, 'todos');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            path: 'todos'
          })
        }
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1.md');
      expect(result[1].name).toBe('test2.md');
    });

    it('should return files from archive folder when includeArchived is true', async () => {
      const mockFiles = [
        { name: 'archived1.md', path: 'todos/archive/archived1.md', sha: 'sha1', type: 'blob' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockFiles));

      const result = await gitlabService.getTodos(mockSettings, 'todos', true);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"path":"todos/archive"')
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('archived1.md');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Project not found',
        false,
        404,
        'Not Found'
      ));

      await expect(
        gitlabService.getTodos(mockSettings, 'todos')
      ).rejects.toThrow('GitLab API proxy error: Not Found');
    });
  });

  describe('getFileContent', () => {
    it('should return file content as text', async () => {
      const mockContent = '# Test Content\n\n- [ ] Test task';
      mockFetch.mockResolvedValueOnce(mockResponse({ content: mockContent }));

      const result = await gitlabService.getFileContent(
        mockSettings,
        'todos/test.md'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getFileContent',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md'
          })
        }
      );

      expect(result).toBe(mockContent);
    });

    it('should handle file not found', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'File not found',
        false,
        404,
        'Not Found'
      ));

      await expect(
        gitlabService.getFileContent(mockSettings, 'todos/nonexistent.md')
      ).rejects.toThrow('GitLab API proxy error: Not Found');
    });
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const mockMetadata = {
        sha: 'abc123',
        content: '# Test Content',
        path: 'todos/test.md',
        name: 'test.md'
      };

      mockFetch.mockResolvedValueOnce(mockResponse(mockMetadata));

      const result = await gitlabService.getFileMetadata(
        mockSettings,
        'todos/test.md'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getFileMetadata',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md'
          })
        }
      );

      expect(result).toEqual(mockMetadata);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockResult = { message: 'File deleted' };
      mockFetch.mockResolvedValueOnce(mockResponse(mockResult));

      const result = await gitlabService.deleteFile(
        mockSettings,
        'todos/test.md',
        'feat: Delete test file'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'deleteFile',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md',
            commitMessage: 'feat: Delete test file'
          })
        }
      );

      expect(result).toEqual(mockResult);
    });

    it('should handle deletion errors', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Cannot delete file',
        false,
        422,
        'Unprocessable Entity'
      ));

      await expect(
        gitlabService.deleteFile(mockSettings, 'todos/test.md', 'Delete test')
      ).rejects.toThrow('GitLab API proxy error: Unprocessable Entity');
    });
  });

  describe('Archive operations', () => {
    it('should move task to archive', async () => {
      const ensureArchiveSpy = vi.spyOn(gitlabService, 'ensureArchiveDirectory').mockResolvedValue();
      const getMetadataSpy = vi.spyOn(gitlabService, 'getFileMetadata').mockResolvedValue({
        sha: 'file-sha',
        content: '# Test',
        path: 'todos/test.md',
        name: 'test.md'
      });
      const createUpdateSpy = vi.spyOn(gitlabService, 'createOrUpdateTodo').mockResolvedValue({});
      const deleteSpy = vi.spyOn(gitlabService, 'deleteFile').mockResolvedValue({});

      const result = await gitlabService.moveTaskToArchive(
        mockSettings,
        'todos/test.md',
        '# Test',
        'Archive test task'
      );

      expect(ensureArchiveSpy).toHaveBeenCalledWith(mockSettings, 'todos');
      expect(createUpdateSpy).toHaveBeenCalledWith(
        mockSettings,
        'todos/archive/test.md',
        '# Test',
        'Archive test task'
      );
      expect(deleteSpy).toHaveBeenCalledWith(
        mockSettings,
        'todos/test.md',
        'Archive: Remove test.md from active todos'
      );
      expect(result).toBe('todos/archive/test.md');

      ensureArchiveSpy.mockRestore();
      getMetadataSpy.mockRestore();
      createUpdateSpy.mockRestore();
      deleteSpy.mockRestore();
    });

    it('should move task from archive', async () => {
      const getMetadataSpy = vi.spyOn(gitlabService, 'getFileMetadata').mockResolvedValue({
        sha: 'file-sha',
        content: '# Test',
        path: 'todos/archive/test.md',
        name: 'test.md'
      });
      const createUpdateSpy = vi.spyOn(gitlabService, 'createOrUpdateTodo').mockResolvedValue({});
      const deleteSpy = vi.spyOn(gitlabService, 'deleteFile').mockResolvedValue({});

      const result = await gitlabService.moveTaskFromArchive(
        mockSettings,
        'todos/archive/test.md',
        '# Test',
        'Unarchive test task'
      );

      expect(createUpdateSpy).toHaveBeenCalledWith(
        mockSettings,
        'todos/test.md',
        '# Test',
        'Unarchive test task'
      );
      expect(deleteSpy).toHaveBeenCalledWith(
        mockSettings,
        'todos/archive/test.md',
        'Unarchive: Remove test.md from todos/archive'
      );
      expect(result).toBe('todos/test.md');

      getMetadataSpy.mockRestore();
      createUpdateSpy.mockRestore();
      deleteSpy.mockRestore();
    });
  });

  describe('Project folder operations', () => {
    it('should list project folders', async () => {
      const mockContents = [
        { name: 'todos', type: 'tree' },
        { name: 'work-tasks', type: 'tree' },
        { name: 'personal', type: 'tree' },
        { name: 'invalid@name', type: 'tree' },
        { name: 'README.md', type: 'blob' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse(mockContents));

      const result = await gitlabService.listProjectFolders(mockSettings);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'listRootContents',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main'
          })
        }
      );

      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal');
      expect(result).not.toContain('invalid@name');
      expect(result).not.toContain('README.md');
    });

    it('should return default folder on error', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        'Access denied',
        false,
        403,
        'Forbidden'
      ));

      const result = await gitlabService.listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });

    it('should create project folder', async () => {
      const createUpdateSpy = vi.spyOn(gitlabService, 'createOrUpdateTodo').mockResolvedValue({});

      await gitlabService.createProjectFolder(mockSettings, 'new-project');

      expect(createUpdateSpy).toHaveBeenCalledTimes(2);
      expect(createUpdateSpy).toHaveBeenNthCalledWith(
        1,
        mockSettings,
        'new-project/.gitkeep',
        expect.stringContaining('new-project Project'),
        'feat: Create new-project project folder'
      );
      expect(createUpdateSpy).toHaveBeenNthCalledWith(
        2,
        mockSettings,
        'new-project/archive/.gitkeep',
        expect.stringContaining('new-project/archive'),
        'feat: Create new-project/archive directory'
      );

      createUpdateSpy.mockRestore();
    });

    it('should validate folder name', async () => {
      await expect(
        gitlabService.createProjectFolder(mockSettings, 'invalid@name!')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        gitlabService.createProjectFolder(mockSettings, '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        gitlabService.createProjectFolder(mockSettings, '123invalid')
      ).rejects.toThrow('Invalid folder name');
    });
  });

  describe('Git history operations', () => {
    it('should get file history', async () => {
      const mockCommits = [
        { sha: 'commit1', message: 'Initial commit' },
        { sha: 'commit2', message: 'Update file' },
      ];

      mockFetch.mockResolvedValueOnce(mockResponse({ commits: mockCommits }));

      const result = await gitlabService.getFileHistory(
        mockSettings,
        'todos/test.md'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getFileHistory',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md'
          })
        }
      );

      expect(result).toEqual(mockCommits);
    });

    it('should get file at specific commit', async () => {
      const mockData = { content: '# Old version', sha: 'commit-sha' };

      mockFetch.mockResolvedValueOnce(mockResponse(mockData));

      const result = await gitlabService.getFileAtCommit(
        mockSettings,
        'todos/test.md',
        'commit-sha'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getFileAtCommit',
            instanceUrl: 'https://gitlab.example.com',
            projectId: '12345',
            token: 'test-token',
            branch: 'main',
            filePath: 'todos/test.md',
            sha: 'commit-sha'
          })
        }
      );

      expect(result).toEqual(mockData);
    });
  });

  describe('Environment Detection', () => {
    it('should detect development environment', () => {
      expect(mockLocation.hostname).toBe('localhost');
      expect(mockLocation.port).toBe('3000');
    });
  });
});