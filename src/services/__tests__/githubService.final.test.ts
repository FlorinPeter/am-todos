import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFileHistory, listProjectFolders } from '../githubService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create proper Response mock objects
const createMockResponse = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
  headers?: Map<string, string> | Headers;
  url?: string;
}) => {
  const mockResponse = {
    ok: options.ok,
    status: options.status || (options.ok ? 200 : 500),
    statusText: options.statusText || (options.ok ? 'OK' : 'Error'),
    json: options.json || (async () => ({})),
    text: options.text || (async () => ''),
    headers: options.headers || new Headers(),
    url: options.url || 'test-url',
    clone: () => createMockResponse(options) // Add clone method
  };
  return mockResponse;
};

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('githubService - Final Coverage Push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Mock window.location for environment detection
    Object.defineProperty(global, 'window', {
      value: {
        location: {
          hostname: 'localhost',
          port: '3000'
        }
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('deleteFile function (lines 389-392)', () => {
    it('should handle delete error and throw with detailed message', async () => {
      // Import deleteFile
      const { deleteFile } = await import('../githubService');
      
      // Mock failed delete response (lines 389-392)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File does not exist')
      });

      await expect(
        deleteFile('test-token', 'owner', 'repo', 'todos/test.md', 'abc123')
      ).rejects.toThrow('GitHub API proxy error: Not Found - File does not exist');
    });
  });

  describe('getFileHistory function (lines 400-401, 414-417)', () => {
    it('should handle API error response and throw with error message', async () => {
      // Target lines 414-417: error handling path
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('File not found in repository')
      });

      // Test the function with all parameters (lines 400-401)
      await expect(
        getFileHistory('test-token', 'test-owner', 'test-repo', 'todos/test.md')
      ).rejects.toThrow('Failed to fetch file history: Not Found');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/git-history'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'token test-token',
          },
          body: JSON.stringify({
            path: 'todos/test.md',
            owner: 'test-owner',
            repo: 'test-repo'
          }),
        })
      );
    });

    it('should successfully return commits when API call succeeds', async () => {
      // Test successful path to ensure the function works properly
      const mockCommits = [
        { sha: 'abc123', message: 'Initial commit', date: '2023-01-01' },
        { sha: 'def456', message: 'Update task', date: '2023-01-02' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ commits: mockCommits })
      });

      const result = await getFileHistory('token', 'owner', 'repo', 'path/file.md');

      expect(result).toEqual(mockCommits);
    });
  });

  describe('listProjectFolders function (lines 435-437)', () => {
    it('should return default fallback when API request fails', async () => {
      // Target lines 435-437: error handling path
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      const result = await listProjectFolders('test-token', 'test-owner', 'test-repo');

      // Should return default fallback array (line 436)
      expect(result).toEqual(['todos']);
    });

    it('should successfully return filtered folders when API call succeeds', async () => {
      // Test successful path to ensure the function works properly
      const mockContents = [
        { name: 'todos', type: 'dir' },
        { name: 'docs', type: 'dir' },
        { name: 'src', type: 'dir' },
        { name: 'README.md', type: 'file' }
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const result = await listProjectFolders('token', 'owner', 'repo');

      // Service filters folders in test environment - should contain todos plus valid folders
      expect(result).toEqual(['todos', 'docs', 'src']);
      expect(result).not.toContain('README.md'); // Should exclude files
    });
  });
});