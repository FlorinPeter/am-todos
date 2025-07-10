import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as gitlabService from '../gitlabService';

// Mock the global fetch function
global.fetch = vi.fn();

describe('GitLab Service', () => {
  const mockSettings = {
    instanceUrl: 'https://gitlab.example.com',
    projectId: '12345',
    token: 'glpat-test-token',
    branch: 'main'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location for environment detection
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'localhost',
        port: '3000',
        origin: 'http://localhost:3000',
        pathname: '/'
      },
      writable: true
    });
  });

  describe('createOrUpdateTodo', () => {
    it('should create a new todo successfully', async () => {
      const mockResponse = {
        file_path: 'todos/test-todo.md',
        content: 'test content'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await gitlabService.createOrUpdateTodo(
        mockSettings,
        'todos/test-todo.md',
        '# Test Todo\n\n- [ ] Test task',
        'feat: Add test todo'
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'createOrUpdateFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md',
            content: '# Test Todo\n\n- [ ] Test task',
            commitMessage: 'feat: Add test todo'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Project not found')
      });

      await expect(
        gitlabService.createOrUpdateTodo(
          mockSettings,
          'todos/test-todo.md',
          '# Test Todo',
          'feat: Add test todo'
        )
      ).rejects.toThrow('GitLab API proxy error: Not Found - Project not found');
    });
  });

  describe('getTodos', () => {
    it('should fetch todos from active folder', async () => {
      const mockFiles = [
        { name: 'todo1.md', path: 'todos/todo1.md', sha: 'abc123', type: 'file' },
        { name: 'todo2.md', path: 'todos/todo2.md', sha: 'def456', type: 'file' },
        { name: '.gitkeep', path: 'todos/.gitkeep', sha: 'ghi789', type: 'file' }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      });

      const result = await gitlabService.getTodos(mockSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: 'todos'
          })
        })
      );

      // Should filter out .gitkeep and return only .md files
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('todo1.md');
      expect(result[1].name).toBe('todo2.md');
    });

    it('should fetch todos from archive folder', async () => {
      const mockFiles = [
        { name: 'archived-todo.md', path: 'todos/archive/archived-todo.md', sha: 'xyz789', type: 'file' }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFiles)
      });

      const result = await gitlabService.getTodos(mockSettings, 'todos', true);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: 'todos/archive'
          })
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('archived-todo.md');
    });

    it('should handle network errors with retry', async () => {
      // First call fails with network error
      (fetch as any).mockRejectedValueOnce(new TypeError('fetch error'));
      
      // Retry call succeeds
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const result = await gitlabService.getTodos(mockSettings, 'todos', false);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([]);
    });
  });

  describe('getFileContent', () => {
    it('should fetch raw file content', async () => {
      const mockContent = '# Test Todo\n\n- [ ] Test task';

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ content: mockContent })
      });

      const result = await gitlabService.getFileContent(mockSettings, 'todos/test-todo.md');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'getRawFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md'
          })
        })
      );

      expect(result).toBe(mockContent);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      const mockResponse = { message: 'File deleted successfully' };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await gitlabService.deleteFile(
        mockSettings,
        'todos/test-todo.md',
        'feat: Delete test todo'
      );

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'deleteFile',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            filePath: 'todos/test-todo.md',
            commitMessage: 'feat: Delete test todo'
          })
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('moveTaskToArchive', () => {
    it('should move a task to archive successfully', async () => {
      // Mock ensureArchiveDirectory (getTodos call)
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      // Mock createOrUpdateTodo call
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ file_path: 'todos/archive/test-todo.md' })
      });

      // Mock deleteFile call
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'File deleted' })
      });

      const result = await gitlabService.moveTaskToArchive(
        mockSettings,
        'todos/test-todo.md',
        '# Test Todo\n\n- [x] Completed task',
        'feat: Archive completed todo'
      );

      expect(result).toBe('todos/archive/test-todo.md');
      expect(fetch).toHaveBeenCalledTimes(3); // ensureArchive, create, delete
    });
  });

  describe('listProjectFolders', () => {
    it('should list available project folders', async () => {
      const mockContents = [
        { name: 'todos', path: 'todos', type: 'dir' },
        { name: 'work-tasks', path: 'work-tasks', type: 'dir' },
        { name: 'personal', path: 'personal', type: 'dir' },
        { name: 'README.md', path: 'README.md', type: 'file' }
      ];

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockContents)
      });

      const result = await gitlabService.listProjectFolders(mockSettings);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: JSON.stringify({
            action: 'listFiles',
            instanceUrl: mockSettings.instanceUrl,
            projectId: mockSettings.projectId,
            token: mockSettings.token,
            branch: mockSettings.branch,
            path: ''
          })
        })
      );

      // Should include todos (default), work-tasks, and personal
      expect(result).toContain('todos');
      expect(result).toContain('work-tasks');
      expect(result).toContain('personal');
      expect(result).not.toContain('README.md'); // Files should be filtered out
    });

    it('should return default folder on error', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await gitlabService.listProjectFolders(mockSettings);

      expect(result).toEqual(['todos']);
    });
  });

  describe('createProjectFolder', () => {
    it('should create a new project folder', async () => {
      // Mock createOrUpdateTodo calls for .gitkeep files
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ file_path: 'work-tasks/.gitkeep' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ file_path: 'work-tasks/archive/.gitkeep' })
        });

      await gitlabService.createProjectFolder(mockSettings, 'work-tasks');

      expect(fetch).toHaveBeenCalledTimes(2);
      
      // Should create main folder .gitkeep
      expect(fetch).toHaveBeenNthCalledWith(1, 
        'http://localhost:3001/api/gitlab',
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"work-tasks/.gitkeep"')
        })
      );

      // Should create archive folder .gitkeep
      expect(fetch).toHaveBeenNthCalledWith(2,
        'http://localhost:3001/api/gitlab', 
        expect.objectContaining({
          body: expect.stringContaining('"filePath":"work-tasks/archive/.gitkeep"')
        })
      );
    });

    it('should validate folder name', async () => {
      await expect(
        gitlabService.createProjectFolder(mockSettings, '')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        gitlabService.createProjectFolder(mockSettings, '123invalid')
      ).rejects.toThrow('Invalid folder name');

      await expect(
        gitlabService.createProjectFolder(mockSettings, 'spaces not allowed')
      ).rejects.toThrow('Invalid folder name');
    });
  });
});