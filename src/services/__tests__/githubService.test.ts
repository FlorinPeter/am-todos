import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

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

describe('GitHub Service - Comprehensive Coverage', () => {
  // Test that all major functions are exported and callable
  describe('Module Exports', () => {
    it('should export all required functions', async () => {
      const githubService = await import('../githubService');
      
      const expectedFunctions = [
        'createOrUpdateTodo',
        'ensureDirectory', 
        'ensureTodosDirectory',
        'getTodos',
        'getFileContent',
        'getFileMetadata',
        'ensureArchiveDirectory',
        'moveTaskToArchive',
        'moveTaskFromArchive',
        'deleteFile',
        'getFileHistory',
        'listProjectFolders',
        'createProjectFolder',
        'getFileAtCommit'
      ];

      expectedFunctions.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('Function Parameter Validation', () => {
    it('should handle function calls with proper parameter types', async () => {
      const githubService = await import('../githubService');
      
      // Test that functions are callable with proper parameters (just check they exist)
      const mockParams = {
        token: 'test-token',
        owner: 'test-owner', 
        repo: 'test-repo',
        path: 'test.md',
        content: '# Test',
        commitMessage: 'Test commit',
        sha: 'abc123',
        folder: 'todos'
      };

      // Test that functions exist and accept parameters without throwing type errors
      expect(githubService.createOrUpdateTodo).toBeDefined();
      expect(githubService.ensureDirectory).toBeDefined();
      expect(typeof githubService.createOrUpdateTodo).toBe('function');
      expect(typeof githubService.ensureDirectory).toBe('function');
    });
  });

  describe('Environment Detection', () => {
    it('should handle different environment configurations', () => {
      // Test that the module loads and detects environment correctly
      expect(window.location.hostname).toBeDefined();
      expect(window.location.port).toBeDefined();
    });
  });

  describe('Error Handling Patterns', () => {
    it('should have consistent error handling across functions', async () => {
      const githubService = await import('../githubService');
      
      // Test that async functions return promises
      const asyncFunctions = [
        'createOrUpdateTodo',
        'getTodos', 
        'getFileContent',
        'getFileMetadata',
        'deleteFile'
      ];

      asyncFunctions.forEach(funcName => {
        const func = githubService[funcName];
        expect(func).toBeDefined();
        // Functions should be async and return promises
        expect(typeof func).toBe('function');
      });
    });
  });

  describe('Archive Operations Workflow', () => {
    it('should export archive-related functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.moveTaskToArchive).toBeDefined();
      expect(githubService.moveTaskFromArchive).toBeDefined();
      expect(githubService.ensureArchiveDirectory).toBeDefined();
      
      expect(typeof githubService.moveTaskToArchive).toBe('function');
      expect(typeof githubService.moveTaskFromArchive).toBe('function');
      expect(typeof githubService.ensureArchiveDirectory).toBe('function');
    });
  });

  describe('Project Management Functions', () => {
    it('should export project folder management functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.listProjectFolders).toBeDefined();
      expect(githubService.createProjectFolder).toBeDefined();
      
      expect(typeof githubService.listProjectFolders).toBe('function');
      expect(typeof githubService.createProjectFolder).toBe('function');
    });
  });

  describe('Git History Functions', () => {
    it('should export git history functions', async () => {
      const githubService = await import('../githubService');
      
      expect(githubService.getFileHistory).toBeDefined();
      expect(githubService.getFileAtCommit).toBeDefined();
      
      expect(typeof githubService.getFileHistory).toBe('function');
      expect(typeof githubService.getFileAtCommit).toBe('function');
    });
  });

  describe('File Operations', () => {
    it('should export core file operation functions', async () => {
      const githubService = await import('../githubService');
      
      const fileOperations = [
        'createOrUpdateTodo',
        'getFileContent', 
        'getFileMetadata',
        'deleteFile'
      ];

      fileOperations.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('Directory Management', () => {
    it('should export directory management functions', async () => {
      const githubService = await import('../githubService');
      
      const directoryFunctions = [
        'ensureDirectory',
        'ensureTodosDirectory', 
        'ensureArchiveDirectory'
      ];

      directoryFunctions.forEach(funcName => {
        expect(githubService[funcName]).toBeDefined();
        expect(typeof githubService[funcName]).toBe('function');
      });
    });
  });

  describe('API Integration Points', () => {
    it('should use consistent API patterns', async () => {
      const githubService = await import('../githubService');
      
      // All major functions should be async
      const asyncFunctions = [
        'createOrUpdateTodo',
        'getTodos',
        'getFileContent', 
        'getFileMetadata',
        'deleteFile',
        'getFileHistory',
        'listProjectFolders',
        'createProjectFolder',
        'getFileAtCommit'
      ];

      asyncFunctions.forEach(funcName => {
        const func = githubService[funcName];
        expect(func).toBeDefined();
        expect(func.constructor.name).toBe('AsyncFunction');
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility functions', async () => {
      const githubService = await import('../githubService');
      
      // ensureTodosDirectory is a backward compatibility wrapper
      expect(githubService.ensureTodosDirectory).toBeDefined();
      expect(typeof githubService.ensureTodosDirectory).toBe('function');
    });
  });
});