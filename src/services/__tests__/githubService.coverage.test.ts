import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const mockLogger = {
  error: vi.fn(),
  log: vi.fn(),
};
vi.mock('../../utils/logger', () => ({ default: mockLogger }));

describe('githubService - Coverage Boost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockLogger.error.mockClear();
    mockLogger.log.mockClear();
    
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

  describe('getFileAtCommit - Direct fetch (lines 483-507)', () => {
    it('should fetch file content at specific commit', async () => {
      const { getFileAtCommit } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve({
          content: 'File content at commit',
          sha: 'abc123'
        }),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      });

      const result = await getFileAtCommit('token', 'owner', 'repo', 'file.md', 'commit-sha');
      
      expect(result.content).toBe('File content at commit');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/file-at-commit'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'token token',
          },
          body: JSON.stringify({
            path: 'file.md',
            sha: 'commit-sha',
            owner: 'owner',
            repo: 'repo'
          })
        })
      );
    });

    it('should handle file-at-commit fetch errors', async () => {
      const { getFileAtCommit } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: () => Promise.resolve('Commit not found'),
        json: () => Promise.resolve({}),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      });

      await expect(getFileAtCommit('token', 'owner', 'repo', 'file.md', 'bad-sha'))
        .rejects.toThrow('Failed to fetch file at commit: Not Found');
      
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch file at commit:', 'Commit not found');
    });
  });


  describe('ensureTodosDirectory wrapper', () => {
    it('should call ensureDirectory with todos folder', async () => {
      const { ensureTodosDirectory } = await import('../githubService');
      
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: () => Promise.resolve({ sha: 'exists' }),
        text: () => Promise.resolve('')
      }));

      await ensureTodosDirectory('token', 'owner', 'repo', 'Create todos');
      
      // Should call the underlying ensureDirectory function
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});