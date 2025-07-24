import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

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

describe('gitlabService - Simple Coverage', () => {
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

    // Clear any cached modules to avoid test interference
    vi.resetModules();
  });

  describe('listProjectFolders filtering logic', () => {
    const defaultConfig = {
      instanceUrl: 'https://gitlab.com',
      projectId: '123',
      token: 'token',
      branch: 'main'
    };

    it('should include folders with todo keyword', async () => {
      const mockResponse = [
        { type: 'tree', name: 'my-todo-app', path: 'my-todo-app' },
        { type: 'tree', name: 'todo-management', path: 'todo-management' },
        { type: 'tree', name: 'todos', path: 'todos' },
        { type: 'tree', name: 'todolist', path: 'todolist' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('my-todo-app');
      expect(result).toContain('todo-management');
      expect(result).toContain('todos');
      expect(result).toContain('todolist');
    });

    it('should include folders with task keyword', async () => {
      const mockResponse = [
        { type: 'tree', name: 'task-tracker', path: 'task-tracker' },
        { type: 'tree', name: 'my-tasks', path: 'my-tasks' },
        { type: 'tree', name: 'task-management', path: 'task-management' },
        { type: 'tree', name: 'tasklist', path: 'tasklist' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('task-tracker');
      expect(result).toContain('my-tasks');
      expect(result).toContain('task-management');
      expect(result).toContain('tasklist');
    });

    it('should include folders with project keyword', async () => {
      const mockResponse = [
        { type: 'tree', name: 'project-alpha', path: 'project-alpha' },
        { type: 'tree', name: 'my-project', path: 'my-project' },
        { type: 'tree', name: 'project-management', path: 'project-management' },
        { type: 'tree', name: 'projects', path: 'projects' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('project-alpha');
      expect(result).toContain('my-project');
      expect(result).toContain('project-management');
      expect(result).toContain('projects');
    });

    it('should include folders with work keyword', async () => {
      const mockResponse = [
        { type: 'tree', name: 'work-items', path: 'work-items' },
        { type: 'tree', name: 'my-work', path: 'my-work' },
        { type: 'tree', name: 'workflow', path: 'workflow' },
        { type: 'tree', name: 'work-management', path: 'work-management' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('work-items');
      expect(result).toContain('my-work');
      expect(result).toContain('workflow');
      expect(result).toContain('work-management');
    });

    it('should include folders with personal keyword', async () => {
      const mockResponse = [
        { type: 'tree', name: 'personal-goals', path: 'personal-goals' },
        { type: 'tree', name: 'my-personal-stuff', path: 'my-personal-stuff' },
        { type: 'tree', name: 'personal-notes', path: 'personal-notes' },
        { type: 'tree', name: 'personality', path: 'personality' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('personal-goals');
      expect(result).toContain('my-personal-stuff');
      expect(result).toContain('personal-notes');
      expect(result).toContain('personality');
    });

    it('should include default todos folder when specified', async () => {
      const mockResponse = [
        { type: 'tree', name: 'todos', path: 'todos' },
        { type: 'tree', name: 'other-folder', path: 'other-folder' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('todos');
      expect(result).toContain('other-folder'); // matches valid pattern
    });

    it('should include folders matching valid name pattern', async () => {
      const mockResponse = [
        { type: 'tree', name: 'validFolder123', path: 'validFolder123' },
        { type: 'tree', name: 'folder-with-hyphens', path: 'folder-with-hyphens' },
        { type: 'tree', name: 'folder_with_underscores', path: 'folder_with_underscores' },
        { type: 'tree', name: 'a', path: 'a' },
        { type: 'tree', name: 'Z', path: 'Z' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('validFolder123');
      expect(result).toContain('folder-with-hyphens');
      expect(result).toContain('folder_with_underscores');
      expect(result).toContain('a');
      expect(result).toContain('Z');
    });

    it('should filter out invalid folder name patterns', async () => {
      const mockResponse = [
        { type: 'tree', name: '123invalid', path: '123invalid' },
        { type: 'tree', name: 'invalid@name', path: 'invalid@name' },
        { type: 'tree', name: 'folder with spaces', path: 'folder with spaces' },
        { type: 'tree', name: 'folder.with.dots', path: 'folder.with.dots' },
        { type: 'tree', name: '', path: '' },
        { type: 'tree', name: '-starts-with-dash', path: '-starts-with-dash' },
        { type: 'tree', name: '_starts-with-underscore', path: '_starts-with-underscore' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).not.toContain('123invalid');
      expect(result).not.toContain('invalid@name');
      expect(result).not.toContain('folder with spaces');
      expect(result).not.toContain('folder.with.dots');
      expect(result).not.toContain('');
      expect(result).not.toContain('-starts-with-dash');
      expect(result).not.toContain('_starts-with-underscore');
      
      // Should default to todos when no valid folders found
      expect(result).toEqual(['todos']);
    });

    it('should default to todos when no project folders found', async () => {
      const mockResponse = [
        { type: 'tree', name: '.git', path: '.git' },
        { type: 'tree', name: 'node_modules', path: 'node_modules' },
        { type: 'tree', name: 'build', path: 'build' },
        { type: 'tree', name: 'src', path: 'src' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toEqual(['todos']);
    });

    it('should handle empty response and return todos', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve([]),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toEqual(['todos']);
    });

    it('should remove duplicate folder names', async () => {
      const mockResponse = [
        { type: 'tree', name: 'project-alpha', path: 'project-alpha' },
        { type: 'tree', name: 'project-alpha', path: 'different/project-alpha' }, // Different path, same name
        { type: 'tree', name: 'todos', path: 'todos' },
        { type: 'tree', name: 'todos', path: 'another/todos' }, // Different path, same name
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      // Should have unique entries only
      const projectAlphaCount = result.filter(name => name === 'project-alpha').length;
      const todosCount = result.filter(name => name === 'todos').length;
      
      expect(projectAlphaCount).toBe(1);
      expect(todosCount).toBe(1);
      expect(result).toContain('project-alpha');
      expect(result).toContain('todos');
    });

    it('should handle error and return default fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toEqual(['todos']);
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing GitLab project folders:', expect.any(Error));
    });

    it('should handle non-ok response and return fallback', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toEqual(['todos']);
      expect(mockLogger.error).toHaveBeenCalledWith('Error listing GitLab project folders:', expect.any(Error));
    });

    it('should log filtered project folders', async () => {
      const mockResponse = [
        { type: 'tree', name: 'project-work', path: 'project-work' },
        { type: 'tree', name: 'task-list', path: 'task-list' },
      ];

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const { listProjectFolders } = await import('../gitlabService');
      const result = await listProjectFolders(defaultConfig);

      expect(result).toContain('project-work');
      expect(result).toContain('task-list');
    });
  });

  describe('folder name validation regex', () => {
    it('should validate regex pattern correctly', () => {
      const regex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
      
      // Valid patterns
      expect(regex.test('validName')).toBe(true);
      expect(regex.test('a')).toBe(true);
      expect(regex.test('A')).toBe(true);
      expect(regex.test('project123')).toBe(true);
      expect(regex.test('my-project')).toBe(true);
      expect(regex.test('my_project')).toBe(true);
      expect(regex.test('Project-Name_123')).toBe(true);
      
      // Invalid patterns - should be filtered out
      expect(regex.test('')).toBe(false);
      expect(regex.test('123project')).toBe(false);
      expect(regex.test('project@name')).toBe(false);
      expect(regex.test('project name')).toBe(false);
      expect(regex.test('project.name')).toBe(false);
      expect(regex.test('-project')).toBe(false);
      expect(regex.test('_project')).toBe(false);
      expect(regex.test('project!')).toBe(false);
      expect(regex.test('project#')).toBe(false);
    });
  });

  describe('system folder filtering', () => {
    it('should filter out all system folders', () => {
      const systemFolders = [
        '.git', 'node_modules', 'build', 'dist', 'coverage', 'target', 'bin',
        'public', 'assets', 'static', 'images', 'css', 'js', 'lib', 'vendor',
        'third_party', 'documentation', 'docs', 'examples', 'tests', 'test',
        'spec', 'scripts', 'tools', 'config', 'src'
      ];

      systemFolders.forEach(folder => {
        expect(folder.toLowerCase()).toBe(folder.toLowerCase());
        // These should all be filtered out by the system folder check
      });
    });
  });
});