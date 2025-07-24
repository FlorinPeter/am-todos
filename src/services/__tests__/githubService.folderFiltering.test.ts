import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

// Mock fetch
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

describe('githubService - Pattern Matching Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    
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

  describe('listProjectFolders pattern filtering', () => {
    it('should include folders matching project patterns', async () => {
      // Mock response with various folder names to test pattern matching (lines 449-453)
      const mockContents = [
        { type: 'dir', name: 'src' },                    // Should be excluded
        { type: 'dir', name: 'work-items' },             // Should match 'work' pattern (line 450)
        { type: 'dir', name: 'personal-notes' },         // Should match 'personal' pattern (line 451)
        { type: 'dir', name: 'project-alpha' },          // Should match 'project' pattern (line 449)
        { type: 'dir', name: 'my-tasks' },               // Should match 'task' pattern (line 448)
        { type: 'dir', name: 'valid-name123' },          // Should match regex pattern (line 453)
        { type: 'file', name: 'README.md' },             // Should be excluded (not dir)
        { type: 'dir', name: 'node_modules' },           // Should be excluded (system folder)
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should include todos by default (line 458-459) plus ALL valid folder names
      // Note: githubService.ts doesn't exclude system folders like gitlabService.ts does
      expect(result).toEqual([
        'todos',              // Added by default (lines 458-459)
        'src',               // Matches regex pattern (line 453)
        'work-items',        // Matches 'work' pattern (line 450)
        'personal-notes',    // Matches 'personal' pattern (line 451)  
        'project-alpha',     // Matches 'project' pattern (line 449)
        'my-tasks',          // Matches 'task' pattern (line 448)
        'valid-name123',     // Matches regex pattern (line 453)
        'node_modules'       // Matches regex pattern (line 453)
      ]);
    });

    it('should add todos as default when not present in results', async () => {
      // Mock response without 'todos' folder to test lines 458-459
      const mockContents = [
        { type: 'dir', name: 'work-projects' },
        { type: 'dir', name: 'personal-stuff' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should have 'todos' first (added by lines 458-459)
      expect(result[0]).toBe('todos');
      expect(result).toContain('work-projects');
      expect(result).toContain('personal-stuff');
    });

    it('should not duplicate todos when already present', async () => {
      // Mock response that already has 'todos' folder
      const mockContents = [
        { type: 'dir', name: 'todos' },                   // Already has todos
        { type: 'dir', name: 'work-items' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should not duplicate 'todos'
      const todosCount = result.filter(name => name === 'todos').length;
      expect(todosCount).toBe(1);
      expect(result).toContain('todos');
      expect(result).toContain('work-items');
    });

    it('should test each specific pattern condition individually', async () => {
      // Test each pattern matching condition separately to ensure lines 449-453 are covered

      // Test 'project' pattern (line 449)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ type: 'dir', name: 'my-project' }])
      }));

      const { listProjectFolders: test1 } = await import('../githubService');
      const result1 = await test1('token', 'owner', 'repo');
      expect(result1).toContain('my-project');

      vi.resetModules();
      vi.clearAllMocks();

      // Test 'work' pattern (line 450)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ type: 'dir', name: 'work-stuff' }])
      }));

      const { listProjectFolders: test2 } = await import('../githubService');
      const result2 = await test2('token', 'owner', 'repo');
      expect(result2).toContain('work-stuff');

      vi.resetModules();
      vi.clearAllMocks();

      // Test 'personal' pattern (line 451)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ type: 'dir', name: 'personal-docs' }])
      }));

      const { listProjectFolders: test3 } = await import('../githubService');
      const result3 = await test3('token', 'owner', 'repo');
      expect(result3).toContain('personal-docs');

      vi.resetModules();
      vi.clearAllMocks();

      // Test exact 'todos' match (line 452)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ type: 'dir', name: 'todos' }])
      }));

      const { listProjectFolders: test4 } = await import('../githubService');
      const result4 = await test4('token', 'owner', 'repo');
      expect(result4).toContain('todos');

      vi.resetModules();
      vi.clearAllMocks();

      // Test regex pattern (line 453)
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ type: 'dir', name: 'validName123' }])
      }));

      const { listProjectFolders: test5 } = await import('../githubService');
      const result5 = await test5('token', 'owner', 'repo');
      expect(result5).toContain('validName123');
    });

    it('should exclude invalid folder names that do not match regex', async () => {
      // Test folders that should NOT match the regex pattern (line 453)
      const mockContents = [
        { type: 'dir', name: '123invalid' },         // Starts with number
        { type: 'dir', name: '-invalid' },           // Starts with dash
        { type: 'dir', name: 'invalid spaces' },     // Contains space
        { type: 'dir', name: 'invalid@symbol' },     // Contains invalid symbol
        { type: 'dir', name: 'validFolder' },        // Should match
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockContents)
      }));

      const { listProjectFolders } = await import('../githubService');

      const result = await listProjectFolders('testtoken', 'testowner', 'testrepo');

      // Should only include 'todos' (default) and 'validFolder'
      expect(result).toContain('todos');
      expect(result).toContain('validFolder');
      expect(result).not.toContain('123invalid');
      expect(result).not.toContain('-invalid');
      expect(result).not.toContain('invalid spaces');
      expect(result).not.toContain('invalid@symbol');
    });
  });
});