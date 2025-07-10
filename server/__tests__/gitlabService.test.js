import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import GitLabService from '../gitlabService.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('GitLabService', () => {
  let gitlabService;
  const mockInstanceUrl = 'https://gitlab.example.com';
  const mockProjectId = '123';
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console methods to avoid test output pollution
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    gitlabService = new GitLabService(mockInstanceUrl, mockProjectId, mockToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(gitlabService.instanceUrl).toBe(mockInstanceUrl);
      expect(gitlabService.projectId).toBe(mockProjectId);
      expect(gitlabService.token).toBe(mockToken);
      expect(gitlabService.apiBase).toBe(`${mockInstanceUrl}/api/v4`);
    });

    it('should remove trailing slash from instanceUrl', () => {
      const serviceWithSlash = new GitLabService('https://gitlab.example.com/', mockProjectId, mockToken);
      expect(serviceWithSlash.instanceUrl).toBe('https://gitlab.example.com');
    });
  });

  describe('makeRequest', () => {
    it('should make GET request with default headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.makeRequest('/test-endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/test-endpoint`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Private-Token': mockToken,
            'Content-Type': 'application/json',
            'User-Agent': 'Agentic-Markdown-Todos'
          })
        })
      );

      expect(result).toBe(mockResponse);
    });

    it('should merge custom options with defaults', async () => {
      const mockResponse = {
        ok: true,
        status: 200
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const customOptions = {
        method: 'POST',
        headers: { 'Custom-Header': 'custom-value' },
        body: JSON.stringify({ test: 'data' })
      };

      await gitlabService.makeRequest('/test-endpoint', customOptions);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/test-endpoint`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Private-Token': mockToken,
            'Content-Type': 'application/json',
            'User-Agent': 'Agentic-Markdown-Todos',
            'Custom-Header': 'custom-value'
          }),
          body: JSON.stringify({ test: 'data' })
        })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await expect(gitlabService.makeRequest('/test-endpoint')).rejects.toThrow(
        'GitLab API error: 404 Not Found - File not found'
      );
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(gitlabService.makeRequest('/test-endpoint')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('getFile', () => {
    it('should get file content successfully', async () => {
      const mockFileData = {
        content: Buffer.from('# Test Content').toString('base64'),
        blob_id: 'file-sha',
        file_path: 'test.md',
        file_name: 'test.md'
      };

      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockFileData)
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getFile('test.md', 'main');

      expect(result).toEqual({
        content: '# Test Content',
        sha: 'file-sha',
        path: 'test.md',
        name: 'test.md'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md?ref=main`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Private-Token': mockToken,
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should handle JSON parse errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'invalid json'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await expect(gitlabService.getFile('test.md')).rejects.toThrow(
        'Failed to parse GitLab getFile response'
      );
    });

    it('should handle file not found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await expect(gitlabService.getFile('nonexistent.md')).rejects.toThrow(
        'GitLab API error: 404 Not Found - File not found'
      );
    });
  });

  describe('getRawFile', () => {
    it('should get raw file content', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => '# Raw Content'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getRawFile('test.md', 'main');

      expect(result).toBe('# Raw Content');
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md/raw?ref=main`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('listFiles', () => {
    it('should list files in directory', async () => {
      const mockFiles = [
        { name: 'file1.md', path: 'docs/file1.md', id: 'sha1', type: 'blob' },
        { name: 'file2.md', path: 'docs/file2.md', id: 'sha2', type: 'blob' },
        { name: 'subfolder', path: 'docs/subfolder', id: 'sha3', type: 'tree' }
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockFiles
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.listFiles('docs', 'main');

      expect(result).toEqual([
        { name: 'file1.md', path: 'docs/file1.md', sha: 'sha1', type: 'file' },
        { name: 'file2.md', path: 'docs/file2.md', sha: 'sha2', type: 'file' }
      ]);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/tree?ref=main&path=docs&per_page=100`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle empty directory', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => []
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.listFiles('empty');

      expect(result).toEqual([]);
    });
  });

  describe('createOrUpdateFile', () => {
    it('should create new file', async () => {
      // First call - file doesn't exist
      const notFoundResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found'
      };

      // Second call - create file
      const createResponse = {
        ok: true,
        status: 201,
        json: async () => ({ file_path: 'test.md', branch: 'main' })
      };

      global.fetch
        .mockResolvedValueOnce(notFoundResponse)
        .mockResolvedValueOnce(createResponse);

      const result = await gitlabService.createOrUpdateFile(
        'test.md',
        '# Test Content',
        'feat: Add test file',
        'main'
      );

      expect(result).toEqual({ file_path: 'test.md', branch: 'main' });

      // Should make POST request for new file
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            branch: 'main',
            content: Buffer.from('# Test Content').toString('base64'),
            commit_message: 'feat: Add test file',
            encoding: 'base64'
          })
        })
      );
    });

    it('should update existing file', async () => {
      // First call - file exists
      const existingFileResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          content: Buffer.from('# Existing Content').toString('base64'),
          blob_id: 'existing-sha',
          file_path: 'test.md',
          file_name: 'test.md'
        })
      };

      // Second call - update file
      const updateResponse = {
        ok: true,
        status: 200,
        json: async () => ({ file_path: 'test.md', branch: 'main' })
      };

      global.fetch
        .mockResolvedValueOnce(existingFileResponse)
        .mockResolvedValueOnce(updateResponse);

      const result = await gitlabService.createOrUpdateFile(
        'test.md',
        '# Updated Content',
        'feat: Update test file',
        'main'
      );

      expect(result).toEqual({ file_path: 'test.md', branch: 'main' });

      // Should make PUT request for existing file
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            branch: 'main',
            content: Buffer.from('# Updated Content').toString('base64'),
            commit_message: 'feat: Update test file',
            encoding: 'base64'
          })
        })
      );
    });

    it('should handle special characters in file path', async () => {
      const notFoundResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found'
      };

      const createResponse = {
        ok: true,
        status: 201,
        json: async () => ({ file_path: 'folder/test file.md', branch: 'main' })
      };

      global.fetch
        .mockResolvedValueOnce(notFoundResponse)
        .mockResolvedValueOnce(createResponse);

      await gitlabService.createOrUpdateFile(
        'folder/test file.md',
        '# Test Content',
        'feat: Add test file',
        'main'
      );

      // Should encode file path with spaces
      expect(global.fetch).toHaveBeenLastCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/folder%2Ftest%20file.md`,
        expect.objectContaining({
          method: 'POST'
        })
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file with JSON response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ deleted: true })
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.deleteFile('test.md', 'feat: Delete test file', 'main');

      expect(result).toEqual({ deleted: true });
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({
            branch: 'main',
            commit_message: 'feat: Delete test file'
          })
        })
      );
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => ''
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.deleteFile('test.md', 'feat: Delete test file', 'main');

      expect(result).toEqual({ deleted: true });
    });

    it('should handle non-JSON response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'File deleted successfully'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.deleteFile('test.md', 'feat: Delete test file', 'main');

      expect(result).toEqual({ deleted: true });
    });
  });

  describe('getProject', () => {
    it('should get project information', async () => {
      const mockProject = {
        id: 123,
        name: 'Test Project',
        path: 'test-project',
        namespace: { name: 'Test User' }
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockProject
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getProject();

      expect(result).toEqual(mockProject);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('getFileHistory', () => {
    it('should get file commit history', async () => {
      const mockCommits = [
        {
          id: 'commit1',
          message: 'feat: Add feature',
          author_name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
          web_url: 'https://gitlab.com/user/repo/commit/commit1'
        },
        {
          id: 'commit2',
          message: 'fix: Fix bug',
          author_name: 'Test User',
          created_at: '2023-01-02T00:00:00Z',
          web_url: 'https://gitlab.com/user/repo/commit/commit2'
        }
      ];

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockCommits
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getFileHistory('test.md', 'main');

      expect(result).toEqual([
        {
          sha: 'commit1',
          message: 'feat: Add feature',
          author: 'Test User',
          date: '2023-01-01T00:00:00Z',
          url: 'https://gitlab.com/user/repo/commit/commit1'
        },
        {
          sha: 'commit2',
          message: 'fix: Fix bug',
          author: 'Test User',
          date: '2023-01-02T00:00:00Z',
          url: 'https://gitlab.com/user/repo/commit/commit2'
        }
      ]);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/commits?ref_name=main&path=test.md&per_page=20`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle empty history', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => []
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getFileHistory('nonexistent.md');

      expect(result).toEqual([]);
    });
  });

  describe('getFileAtCommit', () => {
    it('should get file content at specific commit', async () => {
      const mockFileData = {
        content: Buffer.from('# Content at commit').toString('base64'),
        blob_id: 'file-sha-at-commit'
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockFileData
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getFileAtCommit('test.md', 'commit-sha');

      expect(result).toEqual({
        content: '# Content at commit',
        sha: 'file-sha-at-commit'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/test.md?ref=commit-sha`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle file not found at commit', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found at commit'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await expect(gitlabService.getFileAtCommit('test.md', 'invalid-commit')).rejects.toThrow(
        'GitLab API error: 404 Not Found - File not found at commit'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle URL encoding for file paths with special characters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => 'Raw content'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await gitlabService.getRawFile('docs/file with spaces & symbols.md');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/files/docs%2Ffile%20with%20spaces%20%26%20symbols.md/raw?ref=main`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle Unicode content in Base64 encoding', async () => {
      const unicodeContent = '# Test with émojis 🚀 and unicode characters';
      const mockFileData = {
        content: Buffer.from(unicodeContent, 'utf-8').toString('base64'),
        blob_id: 'unicode-sha',
        file_path: 'unicode.md',
        file_name: 'unicode.md'
      };

      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockFileData)
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const result = await gitlabService.getFile('unicode.md');

      expect(result.content).toBe(unicodeContent);
    });

    it('should handle different branch names', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => []
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await gitlabService.listFiles('docs', 'feature-branch');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockInstanceUrl}/api/v4/projects/123/repository/tree?ref=feature-branch&path=docs&per_page=100`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });
});