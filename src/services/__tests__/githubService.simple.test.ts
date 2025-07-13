import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
const mockLogger = {
  log: vi.fn(),
  error: vi.fn(),
};
vi.mock('../../utils/logger', () => ({
  default: mockLogger,
}));

// Mock window.location
const mockLocation = {
  hostname: 'localhost',
  port: '3000',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('githubService - Simple Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset window.location to default
    mockLocation.hostname = 'localhost';
    mockLocation.port = '3000';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('environment detection', () => {
    it('should detect Cloud Run environment - run.app', async () => {
      mockLocation.hostname = 'myapp-123.run.app';
      mockLocation.port = '';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isCloudRun': true,
          'BACKEND_URL': ''
        })
      );
    });

    it('should detect Cloud Run environment - run.googleapis.com', async () => {
      mockLocation.hostname = 'service-123.run.googleapis.com';
      mockLocation.port = '';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isCloudRun': true,
          'BACKEND_URL': ''
        })
      );
    });

    it('should detect development environment with localhost', async () => {
      mockLocation.hostname = 'localhost';
      mockLocation.port = '3000';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isDevelopment': true,
          'BACKEND_URL': 'http://localhost:3001'
        })
      );
    });

    it('should detect development environment with IP address', async () => {
      mockLocation.hostname = '159.65.120.9';
      mockLocation.port = '3000';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isDevelopment': true,
          'BACKEND_URL': 'http://159.65.120.9:3001'
        })
      );
    });

    it('should use relative URLs for production environment', async () => {
      mockLocation.hostname = 'myapp.com';
      mockLocation.port = '443';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isCloudRun': false,
          'isDevelopment': false,
          'BACKEND_URL': ''
        })
      );
    });

    it('should detect development with port 3000 regardless of hostname', async () => {
      mockLocation.hostname = 'custom.domain.com';
      mockLocation.port = '3000';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isDevelopment': true,
          'BACKEND_URL': 'http://custom.domain.com:3001'
        })
      );
    });
  });

  describe('createProjectFolder validation', () => {
    it('should throw error for empty folder name', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', ''))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for null folder name', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', null as any))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for undefined folder name', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', undefined as any))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for folder name starting with number', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', '123project'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for folder name with special characters', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', 'project@name'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for folder name with spaces', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', 'project name'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should throw error for folder name with dots', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      await expect(createProjectFolder('token', 'owner', 'repo', 'project.name'))
        .rejects.toThrow('Invalid folder name. Use letters, numbers, underscores, and hyphens only.');
    });

    it('should accept valid folder names', async () => {
      const { createProjectFolder } = await import('../githubService');
      
      // These should not throw during validation (they may fail during execution due to no mock fetch)
      const validNames = [
        'validProject',
        'project123',
        'my-project',
        'my_project',
        'a',
        'A',
        'Project-Name_123'
      ];

      for (const name of validNames) {
        // We expect these to pass validation but fail at the fetch level
        try {
          await createProjectFolder('token', 'owner', 'repo', name);
        } catch (error) {
          // Should not be a validation error
          expect((error as Error).message).not.toContain('Invalid folder name');
        }
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle environment variables correctly', async () => {
      // Test various combinations of hostname and port
      const testCases = [
        { hostname: 'app.run.app', port: '', expectedCloudRun: true, expectedDev: false },
        { hostname: 'service.run.googleapis.com', port: '8080', expectedCloudRun: true, expectedDev: false },
        { hostname: 'localhost', port: '3000', expectedCloudRun: false, expectedDev: true },
        { hostname: '127.0.0.1', port: '3000', expectedCloudRun: false, expectedDev: true },
        { hostname: '159.65.120.9', port: '8080', expectedCloudRun: false, expectedDev: true },
        { hostname: 'example.com', port: '80', expectedCloudRun: false, expectedDev: false },
      ];

      for (const testCase of testCases) {
        vi.resetModules();
        vi.clearAllMocks();
        
        mockLocation.hostname = testCase.hostname;
        mockLocation.port = testCase.port;
        
        await import('../githubService');
        
        expect(mockLogger.log).toHaveBeenCalledWith(
          'Environment detection:',
          expect.objectContaining({
            'isCloudRun': testCase.expectedCloudRun,
            'isDevelopment': testCase.expectedDev,
          })
        );
      }
    });

    it('should handle empty port string', async () => {
      mockLocation.hostname = 'production.example.com';
      mockLocation.port = '';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'isCloudRun': false,
          'isDevelopment': false,
          'BACKEND_URL': ''
        })
      );
    });

    it('should log all environment detection details', async () => {
      mockLocation.hostname = 'test.example.com';
      mockLocation.port = '8080';
      
      await import('../githubService');
      
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Environment detection:',
        expect.objectContaining({
          'process.env.NODE_ENV': expect.any(String),
          'window.location.hostname': 'test.example.com',
          'window.location.port': '8080',
          'isCloudRun': expect.any(Boolean),
          'isDevelopment': expect.any(Boolean),
          'BACKEND_URL': expect.any(String)
        })
      );
    });
  });

  describe('folder name regex validation', () => {
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
      
      // Invalid patterns
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
});