import request from 'supertest';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockGoogleGenerativeAI = {
  getGenerativeModel: vi.fn()
};

const mockGitLabService = vi.fn();

// Mock the modules before importing the server
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => mockGoogleGenerativeAI)
}));

vi.mock('../gitlabService.js', () => ({ default: mockGitLabService }));

// Mock fetch for external API calls
global.fetch = vi.fn();

describe('Server API Tests', () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset modules and require fresh instance
    vi.resetModules();
    
    // Mock console methods to avoid test output pollution
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock process.env for consistent testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    
    // Import the server after mocking
    const serverModule = await import('../server.js');
    app = serverModule.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        port: "3001",
        nodeEnv: 'test'
      });
    });

    it('should return version info', async () => {
      process.env.VERSION = '1.0.0';
      process.env.GIT_SHA = 'abc123';
      
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toEqual({
        version: '1.0.0',
        gitSha: 'abc123',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'test'
      });
    });

    it('should return memory usage with admin auth', async () => {
      process.env.ADMIN_TOKEN = 'test-admin-token';
      
      const response = await request(app)
        .get('/api/memory')
        .set('Authorization', 'Bearer test-admin-token')
        .expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        memory: {
          rss: expect.stringMatching(/\d+\.\d+ MB/),
          heapTotal: expect.stringMatching(/\d+\.\d+ MB/),
          heapUsed: expect.stringMatching(/\d+\.\d+ MB/),
          external: expect.stringMatching(/\d+\.\d+ MB/),
          arrayBuffers: expect.stringMatching(/\d+\.\d+ MB/)
        },
        raw: expect.any(Object),
        uptime: expect.stringMatching(/\d+(\.\d+)? seconds/)
      });
      
      delete process.env.ADMIN_TOKEN;
    });
  });

  describe('GitHub API Proxy', () => {
    it('should validate required fields', async () => {
      await request(app)
        .post('/api/github')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing required fields: path, owner, repo');
        });
    });

    it('should validate repository path', async () => {
      await request(app)
        .post('/api/github')
        .send({
          path: '/invalid/path',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toBe('Invalid repository path');
        });
    });

    it('should block non-allowed endpoints', async () => {
      await request(app)
        .post('/api/github')
        .send({
          path: '/repos/testuser/testrepo/issues',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toBe('Endpoint not allowed');
        });
    });

    it('should proxy allowed contents endpoint', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ content: 'test' }),
        headers: new Map([['content-type', 'application/json']])
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/github')
        .send({
          path: '/repos/testuser/testrepo/contents/test.md',
          owner: 'testuser',
          repo: 'testrepo',
          method: 'GET',
          headers: { Authorization: 'token abc123' }
        })
        .expect(200);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/contents/test.md',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'Agentic-Markdown-Todos',
            'Authorization': 'token abc123'
          })
        })
      );
    });

    it('should handle GitHub API errors', async () => {
      const mockHeaders = new Map([['content-type', 'text/plain']]);
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'File not found',
        headers: {
          forEach: (callback) => {
            mockHeaders.forEach(callback);
          }
        }
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/github')
        .send({
          path: '/repos/testuser/testrepo/contents/nonexistent.md',
          owner: 'testuser',
          repo: 'testrepo'
        });

      // The proxy returns the GitHub status code
      expect(response.status).toBe(404);
      expect(response.text).toContain('File not found');
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await request(app)
        .post('/api/github')
        .send({
          path: '/repos/testuser/testrepo/contents/test.md',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to proxy GitHub API request');
        });
    });
  });

  describe('GitLab API Proxy', () => {
    beforeEach(() => {
      mockGitLabService.mockImplementation(() => ({
        getFile: vi.fn(),
        getRawFile: vi.fn(),
        listFiles: vi.fn(),
        createOrUpdateFile: vi.fn(),
        deleteFile: vi.fn(),
        getProject: vi.fn(),
        getFileHistory: vi.fn(),
        getFileAtCommit: vi.fn()
      }));
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/gitlab')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing required fields: action, instanceUrl, projectId, token');
        });
    });

    it('should handle getFile action', async () => {
      const mockGitLab = {
        getFile: vi.fn().mockResolvedValue({ content: 'test content' })
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'getFile',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          filePath: 'test.md'
        })
        .expect(200);

      expect(mockGitLab.getFile).toHaveBeenCalledWith('test.md', 'main');
    });

    it('should handle getRawFile action', async () => {
      const mockGitLab = {
        getRawFile: vi.fn().mockResolvedValue('raw content')
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'getRawFile',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          filePath: 'test.md'
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ content: 'raw content' });
        });
    });

    it('should handle listFiles action', async () => {
      const mockGitLab = {
        listFiles: vi.fn().mockResolvedValue([{ name: 'test.md' }])
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'listFiles',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token'
        })
        .expect(200);

      expect(mockGitLab.listFiles).toHaveBeenCalledWith('', 'main');
    });

    it('should handle createOrUpdateFile action', async () => {
      const mockGitLab = {
        createOrUpdateFile: vi.fn().mockResolvedValue({ success: true })
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'createOrUpdateFile',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          filePath: 'test.md',
          content: 'test content',
          commitMessage: 'Add test file'
        })
        .expect(200);

      expect(mockGitLab.createOrUpdateFile).toHaveBeenCalledWith(
        'test.md',
        'test content',
        'Add test file',
        'main'
      );
    });

    it('should handle deleteFile action', async () => {
      const mockGitLab = {
        deleteFile: vi.fn().mockResolvedValue({ deleted: true })
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'deleteFile',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          filePath: 'test.md',
          commitMessage: 'Delete test file'
        })
        .expect(200);

      expect(mockGitLab.deleteFile).toHaveBeenCalledWith(
        'test.md',
        'Delete test file',
        'main'
      );
    });

    it('should handle unknown action', async () => {
      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'unknownAction',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token'
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Unknown action');
        });
    });

    it('should handle GitLab service errors', async () => {
      const mockGitLab = {
        getFile: vi.fn().mockRejectedValue(new Error('GitLab API error'))
      };
      mockGitLabService.mockImplementation(() => mockGitLab);

      await request(app)
        .post('/api/gitlab')
        .send({
          action: 'getFile',
          instanceUrl: 'https://gitlab.com',
          projectId: '123',
          token: 'token',
          filePath: 'test.md'
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to process GitLab API request: GitLab API error');
        });
    });
  });

  describe('AI API Endpoint', () => {
    it('should validate required fields', async () => {
      await request(app)
        .post('/api/ai')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing action in request body');
        });
    });

    it('should require API key', async () => {
      await request(app)
        .post('/api/ai')
        .send({ action: 'generateInitialPlan' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing AI API key. Please configure your API key in the application settings.');
        });
    });

    it('should require provider', async () => {
      await request(app)
        .post('/api/ai')
        .send({ 
          action: 'generateInitialPlan',
          apiKey: 'test-key'
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing AI provider. Please select a provider in the application settings.');
        });
    });

    it('should handle Gemini generateInitialPlan', async () => {
      const mockResult = {
        response: {
          text: () => 'Generated plan content'
        }
      };
      
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue(mockResult)
      };
      
      mockGoogleGenerativeAI.getGenerativeModel.mockReturnValue(mockModel);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'generateInitialPlan',
          provider: 'gemini',
          apiKey: 'AIzaTestKey123456789012345678901234',
          payload: { goal: 'Test goal' }
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.text).toBe('Generated plan content');
        });

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ 
          role: "user", 
          parts: [{ text: 'Create a simple, high-level markdown template for this goal: Test goal' }] 
        }],
        systemInstruction: { 
          parts: [{ text: expect.stringContaining('You are an expert project manager') }] 
        }
      });
    });

    it('should handle OpenRouter provider', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenRouter response' } }]
        })
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'generateInitialPlan',
          provider: 'openrouter',
          apiKey: 'sk-or-v1-test-key-123456789012345',
          model: 'anthropic/claude-3.5-sonnet',
          payload: { goal: 'Test goal' }
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.text).toBe('OpenRouter response');
        });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-or-v1-test-key-123456789012345',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('anthropic/claude-3.5-sonnet')
        })
      );
    });

    it('should handle generateCommitMessage action', async () => {
      const mockResult = {
        response: {
          text: () => 'feat: Add new feature'
        }
      };
      
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue(mockResult)
      };
      
      mockGoogleGenerativeAI.getGenerativeModel.mockReturnValue(mockModel);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'generateCommitMessage',
          provider: 'gemini',
          apiKey: 'AIzaTestKey123456789012345678901234',
          payload: { changeDescription: 'Added new feature' }
        })
        .expect(200);

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ 
          role: "user", 
          parts: [{ text: 'Generate a conventional commit message for the following change: Added new feature' }] 
        }],
        systemInstruction: { 
          parts: [{ text: expect.stringContaining('You are an expert at writing conventional commit messages') }] 
        }
      });
    });

    it('should handle processChatMessage action', async () => {
      const mockResult = {
        response: {
          text: () => 'Updated markdown content'
        }
      };
      
      const mockModel = {
        generateContent: vi.fn().mockResolvedValue(mockResult)
      };
      
      mockGoogleGenerativeAI.getGenerativeModel.mockReturnValue(mockModel);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'processChatMessage',
          provider: 'gemini',
          apiKey: 'AIzaTestKey123456789012345678901234',
          payload: {
            currentContent: '# Test Todo',
            chatHistory: [{ role: 'user', content: 'Hello' }],
            message: 'Add a new task'
          }
        })
        .expect(200);

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: [{ 
          role: "user", 
          parts: [{ text: expect.stringContaining('Current markdown content:') }] 
        }],
        systemInstruction: { 
          parts: [{ text: expect.stringContaining('You are an AI assistant helping users modify their task lists') }] 
        }
      });
    });

    it('should handle unknown action', async () => {
      await request(app)
        .post('/api/ai')
        .send({
          action: 'unknownAction',
          provider: 'gemini',
          apiKey: 'AIzaTestKey123456789012345678901234'
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Unknown action');
        });
    });

    it('should handle unsupported provider', async () => {
      const response = await request(app)
        .post('/api/ai')
        .send({
          action: 'generateInitialPlan',
          provider: 'unsupported',
          apiKey: 'test-key'
        });

      // The server should return 400 for unsupported provider
      expect([400, 500]).toContain(response.status);
      if (response.status === 400) {
        expect(response.body.error).toBe('Unsupported AI provider. Supported providers: gemini, openrouter');
      } else {
        expect(response.body.error).toContain('Failed to get response from');
      }
    });

    it('should handle OpenRouter API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'generateInitialPlan',
          provider: 'openrouter',
          apiKey: 'sk-or-v1-valid-format-but-invalid-key',
          payload: { goal: 'Test goal' }
        })
        .expect(500);
    });

    it('should handle Gemini API errors', async () => {
      const mockModel = {
        generateContent: vi.fn().mockRejectedValue(new Error('Gemini API error'))
      };
      
      mockGoogleGenerativeAI.getGenerativeModel.mockReturnValue(mockModel);

      await request(app)
        .post('/api/ai')
        .send({
          action: 'generateInitialPlan',
          provider: 'gemini',
          apiKey: 'AIzaTestKey123456789012345678901234',
          payload: { goal: 'Test goal' }
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to get response from gemini API');
        });
    });
  });

  describe('Git History Endpoint', () => {
    it('should validate required fields', async () => {
      await request(app)
        .post('/api/git-history')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing required fields: path, owner, repo');
        });
    });

    it('should fetch git history successfully', async () => {
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            message: 'feat: Add feature',
            author: { name: 'Test User', date: '2023-01-01T00:00:00Z' }
          },
          html_url: 'https://github.com/user/repo/commit/abc123'
        }
      ];

      const mockResponse = {
        ok: true,
        json: async () => mockCommits
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/git-history')
        .send({
          path: 'test.md',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .set('Authorization', 'token abc123')
        .expect(200)
        .expect((res) => {
          expect(res.body.commits).toEqual([
            {
              sha: 'abc123',
              message: 'feat: Add feature',
              author: 'Test User',
              date: '2023-01-01T00:00:00Z',
              url: 'https://github.com/user/repo/commit/abc123'
            }
          ]);
        });
    });

    it('should handle GitHub API errors', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/git-history')
        .send({
          path: 'nonexistent.md',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to fetch git history');
        });
    });
  });

  describe('File at Commit Endpoint', () => {
    it('should validate required fields', async () => {
      await request(app)
        .post('/api/file-at-commit')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing required fields: path, sha, owner, repo');
        });
    });

    it('should fetch file at commit successfully', async () => {
      const mockFileData = {
        content: Buffer.from('# Test Content').toString('base64'),
        sha: 'file-sha'
      };

      const mockResponse = {
        ok: true,
        json: async () => mockFileData
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/file-at-commit')
        .send({
          path: 'test.md',
          sha: 'commit-sha',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .set('Authorization', 'token abc123')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            content: '# Test Content',
            sha: 'file-sha'
          });
        });
    });

    it('should handle GitHub API errors', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/file-at-commit')
        .send({
          path: 'nonexistent.md',
          sha: 'commit-sha',
          owner: 'testuser',
          repo: 'testrepo'
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toBe('Failed to fetch file at commit');
        });
    });
  });

  describe('Root Route', () => {
    it('should return API info in development', async () => {
      process.env.NODE_ENV = 'development';
      
      await request(app)
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            message: 'AM-Todos API Server',
            status: 'running',
            timestamp: expect.any(String)
          });
        });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown API routes', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('API endpoint not found');
        });
    });

    it('should return 404 for unknown non-API routes in development', async () => {
      process.env.NODE_ENV = 'development';
      
      await request(app)
        .get('/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Not found');
        });
    });
  });

  describe('Search Endpoint', () => {
    it('should handle GitHub search rate limit errors', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'API rate limit exceeded'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'github',
          owner: 'testuser',
          repo: 'testrepo',
          token: 'test-token'
        })
        .expect(429)
        .expect((res) => {
          expect(res.body.error).toBe('GitHub search API rate limit exceeded. Please try again in a few minutes.');
        });
    });

    it('should handle GitHub search with invalid query', async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => 'Validation Failed'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: '',
          scope: 'folder',
          folder: 'todos',
          provider: 'github',
          owner: 'testuser',
          repo: 'testrepo',
          token: 'test-token'
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing or empty search query');
        });
    });

    it('should handle successful GitHub search', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          items: [{
            path: 'todos/test.md',
            name: 'test.md',
            sha: 'abc123',
            html_url: 'https://github.com/test/repo/blob/main/todos/test.md',
            repository: { full_name: 'test/repo' },
            text_matches: []
          }]
        })
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'github',
          owner: 'testuser',
          repo: 'testrepo',
          token: 'test-token'
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.query).toBe('test');
          expect(res.body.scope).toBe('folder');
          expect(res.body.items).toHaveLength(1);
          expect(res.body.items[0].name).toBe('test.md');
        });
    });

    it('should handle GitLab search rate limit errors', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'glpat-test-token'
        })
        .expect(429)
        .expect((res) => {
          expect(res.body.error).toBe('GitLab search API rate limit exceeded. Please try again in a few minutes.');
        });
    });

    it('should handle GitLab authentication errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'glpat-test-token'
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('GitLab authentication failed. Please check your access token.');
        });
    });

    it('should handle GitLab permission errors', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied'
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'glpat-test-token'
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.error).toBe('GitLab access denied. Please check your permissions.');
        });
    });

    it('should handle successful GitLab search', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ([{
          path: 'todos/test.md',
          filename: 'test.md', // GitLab uses 'filename'
          ref: 'def456',        // GitLab uses 'ref'
        }])
      };

      global.fetch.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'gitlab',
          instanceUrl: 'https://gitlab.com',
          projectId: '12345',
          token: 'glpat-test-token'
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.query).toBe('test');
          expect(res.body.scope).toBe('folder');
          expect(res.body.items).toHaveLength(1);
          expect(res.body.items[0].name).toBe('test.md');  // Normalized from 'filename'
          expect(res.body.items[0].sha).toBe('def456');    // Normalized from 'ref'
        });
    });

    it('should validate missing credentials', async () => {
      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          provider: 'github'
          // Missing owner, repo, token
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing GitHub credentials: owner, repo, token');
        });
    });

    it('should validate provider', async () => {
      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder'
          // Missing provider
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Missing provider (github or gitlab)');
        });
    });

    it('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await request(app)
        .post('/api/search')
        .send({
          query: 'test',
          scope: 'folder',
          folder: 'todos',
          provider: 'github',
          owner: 'testuser',
          repo: 'testrepo',
          token: 'test-token'
        })
        .expect(500)
        .expect((res) => {
          expect(res.body.error).toContain('Network error');
        });
    });
  });
});