import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as aiService from '../aiService';
import { loadSettings } from '../../utils/localStorage';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
vi.mock('../../utils/localStorage');

// Mock logger methods to avoid test output pollution
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

beforeEach(() => {
  vi.clearAllMocks();
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

describe('AI Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('generateInitialPlan', () => {
    it('should generate plan with Gemini provider', async () => {
      // Mock settings for Gemini
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-gemini-key',
        aiModel: 'gemini-2.5-flash'
      });

      const mockPlan = '# Deploy Web Application\n\n- [ ] Set up hosting\n- [ ] Configure domain\n- [ ] Deploy code';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockPlan }));

      const result = await aiService.generateInitialPlan('Deploy web application');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'Deploy web application' },
          provider: 'gemini',
          apiKey: 'test-gemini-key',
          model: 'gemini-2.5-flash'
        }),
        signal: expect.any(AbortSignal)
      }));

      expect(result).toBe(mockPlan);
    });

    it('should generate plan with OpenRouter provider', async () => {
      // Mock settings for OpenRouter
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: 'test-openrouter-key',
        aiModel: 'anthropic/claude-3.5-sonnet'
      });

      const mockPlan = '- [ ] Task 1\n- [ ] Task 2';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockPlan }));

      const result = await aiService.generateInitialPlan('Create tasks');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'Create tasks' },
          provider: 'openrouter',
          apiKey: 'test-openrouter-key',
          model: 'anthropic/claude-3.5-sonnet'
        }),
        signal: expect.any(AbortSignal)
      }));

      expect(result).toBe(mockPlan);
    });

    it('should use default models when not specified', async () => {
      // Mock settings without explicit model
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse({ text: 'plan' }));

      await aiService.generateInitialPlan('test goal');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai', 
        expect.objectContaining({
          body: expect.stringContaining('"model":"gemini-2.5-flash"')
        })
      );
    });

    it('should handle network errors', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('Network error: Unable to connect to AI service');
    });

    it('should handle API errors', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse(
        'API quota exceeded',
        false,
        429,
        'Too Many Requests'
      ));

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('HTTP error! status: 429');
    });

    it('should throw error when no settings configured', async () => {
      vi.mocked(loadSettings).mockReturnValue(null);

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('No settings configured');
    });

    it('should throw error when Gemini API key missing', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini'
        // Missing geminiApiKey
      });

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('Gemini API key not configured');
    });

    it('should throw error when OpenRouter API key missing', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter'
        // Missing openRouterApiKey
      });

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('OpenRouter API key not configured');
    });

    it('should throw error for invalid provider', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'invalid-provider',
        geminiApiKey: 'test-key'
      });

      await expect(aiService.generateInitialPlan('test goal'))
        .rejects.toThrow('Invalid AI provider configured');
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate structured commit message with Gemini', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockStructuredResponse = JSON.stringify({
        message: 'feat: Add new todo task for deployment',
        description: 'Generated conventional commit message for new todo creation'
      });
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockStructuredResponse }));

      const result = await aiService.generateCommitMessage('Added new todo task');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateCommitMessage',
          payload: { changeDescription: 'Added new todo task' },
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash'
        }),
        signal: expect.any(AbortSignal)
      }));

      expect(result).toEqual({
        message: 'feat: Add new todo task for deployment',
        description: 'Generated conventional commit message for new todo creation'
      });
    });

    it('should handle backward compatibility with plain text responses', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockPlainTextResponse = 'feat: Add new todo task for deployment';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockPlainTextResponse }));

      const result = await aiService.generateCommitMessage('Added new todo task');

      expect(result).toEqual({
        message: 'feat: Add new todo task for deployment',
        description: 'Extracted commit message from plain text response'
      });
    });

    it('should extract commit message from markdown code blocks', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockMarkdownResponse = `Sure, here's a conventional commit message for the change you described:
\`\`\`
fix: Update "Claude Code Setup" todo list item
\`\`\``;
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockMarkdownResponse }));

      const result = await aiService.generateCommitMessage('Update todo item');

      expect(result).toEqual({
        message: 'fix: Update "Claude Code Setup" todo list item',
        description: 'Extracted commit message from markdown response'
      });
    });

    it('should extract JSON from markdown code blocks', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini', 
        geminiApiKey: 'test-key'
      });

      const mockMarkdownWithJson = `Here's the commit message in JSON format:
\`\`\`json
{
  "message": "feat: Add user authentication system",
  "description": "Generated conventional commit for auth feature"
}
\`\`\``;
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockMarkdownWithJson }));

      const result = await aiService.generateCommitMessage('Add authentication');

      expect(result).toEqual({
        message: 'feat: Add user authentication system',
        description: 'Generated conventional commit for auth feature'
      });
    });

    it('should handle responses with AI prefixes and clean them up', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockResponseWithPrefix = 'Sure, here\'s a conventional commit message: feat: Implement new feature';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockResponseWithPrefix }));

      const result = await aiService.generateCommitMessage('Add new feature');

      expect(result).toEqual({
        message: 'feat: Implement new feature',
        description: 'Extracted commit message from plain text response'
      });
    });

    it('should use fallback for unrecognized response formats', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockWeirdResponse = 'This is some random AI response without a clear commit message pattern';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockWeirdResponse }));

      const result = await aiService.generateCommitMessage('Random change');

      expect(result).toEqual({
        message: 'This is some random AI response without a clear commit message pattern',
        description: 'Used cleaned AI response as commit message'
      });
    });

    it('should handle API errors', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse(
        'Invalid request',
        false,
        400,
        'Bad Request'
      ));

      await expect(aiService.generateCommitMessage('test change'))
        .rejects.toThrow('HTTP error! status: 400');
    });

    it('should handle network errors', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(aiService.generateCommitMessage('test change'))
        .rejects.toThrow('Network error: Unable to connect to AI service for commit message generation');
    });
  });

  describe('processChatMessage', () => {
    const mockChatHistory = [
      { role: 'user', content: 'Add a task for testing' },
      { role: 'assistant', content: 'I added the testing task.' }
    ];

    it('should process chat message successfully', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: 'test-key',
        aiModel: 'anthropic/claude-3.5-sonnet'
      });

      const mockStructuredResponse = JSON.stringify({
        content: '# Updated Content\n\n- [ ] Original task\n- [ ] New testing task',
        description: 'Added a testing task to the todo list'
      });
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockStructuredResponse }));

      const result = await aiService.processChatMessage(
        'Add a testing task',
        '# Original Content\n\n- [ ] Original task',
        mockChatHistory
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'processChatMessage',
          payload: {
            message: 'Add a testing task',
            currentContent: '# Original Content\n\n- [ ] Original task',
            chatHistory: mockChatHistory
          },
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'anthropic/claude-3.5-sonnet'
        }),
        signal: expect.any(AbortSignal)
      }));

      expect(result).toEqual({
        content: '# Updated Content\n\n- [ ] Original task\n- [ ] New testing task',
        description: 'Added a testing task to the todo list'
      });
    });

    it('should handle plain text response as fallback', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      const mockPlainTextResponse = '# Updated Content\n\n- [ ] Original task\n- [ ] New testing task';
      mockFetch.mockResolvedValueOnce(mockResponse({ text: mockPlainTextResponse }));

      const result = await aiService.processChatMessage(
        'Add a testing task',
        '# Original Content\n\n- [ ] Original task',
        mockChatHistory
      );

      expect(result).toEqual({
        content: mockPlainTextResponse,
        description: undefined
      });
    });

    it('should handle API errors', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse(
        'Context too long',
        false,
        413,
        'Payload Too Large'
      ));

      await expect(aiService.processChatMessage('test', 'content', []))
        .rejects.toThrow('HTTP error! status: 413');
    });

    it('should handle settings errors', async () => {
      vi.mocked(loadSettings).mockReturnValue(null);

      await expect(aiService.processChatMessage('test', 'content', []))
        .rejects.toThrow('No settings configured');
    });
  });

  describe('AI Provider Configuration', () => {
    it('should default to gemini provider when not specified', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        geminiApiKey: 'test-key'
        // No aiProvider specified - should default to 'gemini'
      });

      mockFetch.mockResolvedValueOnce(mockResponse({ text: 'test plan' }));

      await aiService.generateInitialPlan('test goal');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai',
        expect.objectContaining({
          body: expect.stringContaining('"provider":"gemini"')
        })
      );
    });

    it('should use correct default models for each provider', async () => {
      // Test Gemini default
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse({ text: 'test' }));
      await aiService.generateInitialPlan('test');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai',
        expect.objectContaining({
          body: expect.stringContaining('"model":"gemini-2.5-flash"')
        })
      );

      // Test OpenRouter default
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: 'test-key'
      });

      mockFetch.mockResolvedValueOnce(mockResponse({ text: 'test' }));
      await aiService.generateInitialPlan('test');

      expect(mockFetch).toHaveBeenCalledWith('/api/ai',
        expect.objectContaining({
          body: expect.stringContaining('"model":"anthropic/claude-3.5-sonnet"')
        })
      );
    });
  });
});