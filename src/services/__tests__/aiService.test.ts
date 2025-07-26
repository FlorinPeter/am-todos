import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock external dependencies only
vi.mock('../../utils/localStorage', () => ({
  loadSettings: vi.fn()
}));

vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../utils/fetchWithTimeout', () => ({
  fetchJsonWithTimeout: vi.fn(),
  TIMEOUT_VALUES: { AI: 30000 }
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost'
  },
  writable: true
});

import { loadSettings } from '../../utils/localStorage';
import logger from '../../utils/logger';
import { fetchJsonWithTimeout } from '../../utils/fetchWithTimeout';
import { generateInitialPlan, generateCommitMessage, processChatMessage } from '../aiService';

describe('AI Service - Comprehensive Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.hostname to default
    window.location.hostname = 'localhost';
  });

  describe('API URL Generation', () => {
    // Note: getApiUrl is not exported, but it's tested indirectly through other functions
    it('should use correct API URL for localhost', async () => {
      window.location.hostname = 'localhost';
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-2.5-flash'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: 'test response' });

      await generateInitialPlan('test goal');

      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.any(Object));
    });

    it('should use correct API URL for production', async () => {
      window.location.hostname = 'example.com';
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-2.5-flash'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: 'test response' });

      await generateInitialPlan('test goal');

      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.any(Object));
    });
  });

  describe('AI Settings Loading', () => {
    it('should throw error when no settings configured', async () => {
      vi.mocked(loadSettings).mockReturnValue(null);

      await expect(generateInitialPlan('test')).rejects.toThrow('No settings configured. Please configure your settings in the application.');
    });

    it('should throw error when Gemini API key not configured', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: null
      });

      await expect(generateInitialPlan('test')).rejects.toThrow('Gemini API key not configured. Please add your API key in the application settings.');
    });

    it('should throw error when OpenRouter API key not configured', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: null
      });

      await expect(generateInitialPlan('test')).rejects.toThrow('OpenRouter API key not configured. Please add your API key in the application settings.');
    });

    it('should throw error for invalid AI provider', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'invalid-provider',
        geminiApiKey: 'test-key'
      });

      await expect(generateInitialPlan('test')).rejects.toThrow('Invalid AI provider configured. Please select a valid provider in the application settings.');
    });

    it('should use default Gemini model when none specified', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: 'test response' });

      await generateInitialPlan('test goal');

      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'test goal' },
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash'
        }),
        timeout: 30000
      });
    });

    it('should use default OpenRouter model when none specified', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: 'test-key'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: 'test response' });

      await generateInitialPlan('test goal');

      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'test goal' },
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'anthropic/claude-3.5-sonnet'
        }),
        timeout: 30000
      });
    });

    it('should use custom model when specified', async () => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-1.5-pro'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: 'test response' });

      await generateInitialPlan('test goal');

      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'test goal' },
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-1.5-pro'
        })
      }));
    });
  });

  describe('generateInitialPlan', () => {
    beforeEach(() => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-2.5-flash'
      });
    });

    it('should successfully generate initial plan', async () => {
      const expectedPlan = '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3';
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: expectedPlan });

      const result = await generateInitialPlan('Deploy web application');

      expect(result).toBe(expectedPlan);
      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'generateInitialPlan',
          payload: { goal: 'Deploy web application' },
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash'
        })
      }));
    });

    it('should handle network errors with specific message', async () => {
      const networkError = new TypeError('fetch failed');
      vi.mocked(fetchJsonWithTimeout).mockRejectedValue(networkError);

      await expect(generateInitialPlan('test goal')).rejects.toThrow('Network error: Unable to connect to AI service. Please check if the backend server is running.');
      expect(logger.error).toHaveBeenCalledWith('AI Service: Network or fetch error:', networkError);
    });

    it('should handle other errors by rethrowing', async () => {
      const customError = new Error('Custom error');
      vi.mocked(fetchJsonWithTimeout).mockRejectedValue(customError);

      await expect(generateInitialPlan('test goal')).rejects.toThrow('Custom error');
      expect(logger.error).toHaveBeenCalledWith('AI Service: Network or fetch error:', customError);
    });
  });

  describe('parseCommitResponse - Complex Parsing Logic', () => {
    // This tests the internal parseCommitResponse function through generateCommitMessage
    beforeEach(() => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-2.5-flash'
      });
    });

    it('should parse direct JSON response with message and description', async () => {
      const jsonResponse = JSON.stringify({
        message: 'feat: Add new todo functionality',
        description: 'Implemented comprehensive todo creation with AI assistance'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: jsonResponse });

      const result = await generateCommitMessage('Add new todo');

      expect(result).toEqual({
        message: 'feat: Add new todo functionality',
        description: 'Implemented comprehensive todo creation with AI assistance'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Successfully parsed direct JSON response');
    });

    it('should parse JSON response with message only', async () => {
      const jsonResponse = JSON.stringify({
        message: 'fix: Resolve todo deletion bug'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: jsonResponse });

      const result = await generateCommitMessage('Fix deletion bug');

      expect(result).toEqual({
        message: 'fix: Resolve todo deletion bug',
        description: 'Generated conventional commit message'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Parsed JSON with message only, generating description');
    });

    it('should extract JSON from markdown code blocks', async () => {
      const markdownResponse = `Here's your commit message:
\`\`\`json
{
  "message": "chore: Update dependencies",
  "description": "Updated all project dependencies to latest versions"
}
\`\`\``;
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: markdownResponse });

      const result = await generateCommitMessage('Update deps');

      expect(result).toEqual({
        message: 'chore: Update dependencies',
        description: 'Updated all project dependencies to latest versions'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Successfully extracted JSON from markdown code block');
    });

    it('should extract JSON from markdown code blocks with message only', async () => {
      const markdownResponse = `\`\`\`json
{
  "message": "docs: Update README"
}
\`\`\``;
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: markdownResponse });

      const result = await generateCommitMessage('Update docs');

      expect(result).toEqual({
        message: 'docs: Update README',
        description: 'Extracted commit message from AI response'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Extracted JSON from markdown with message only');
    });

    it('should handle invalid JSON in markdown code blocks', async () => {
      const markdownResponse = `\`\`\`json
{ invalid json }
\`\`\`
feat: Fallback commit message`;
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: markdownResponse });

      const result = await generateCommitMessage('Test change');

      expect(result.message).toBe('feat: Fallback commit message');
      expect(logger.log).toHaveBeenCalledWith('AI Service: Failed to parse JSON from markdown code block');
    });

    it('should extract commit message from markdown code blocks', async () => {
      const markdownResponse = `Here's your commit:
\`\`\`
feat: Add user authentication system
\`\`\``;
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: markdownResponse });

      const result = await generateCommitMessage('Add auth');

      expect(result).toEqual({
        message: 'feat: Add user authentication system',
        description: 'Extracted commit message from markdown response'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Extracted commit message from markdown code block:', 'feat: Add user authentication system');
    });

    it('should find conventional commit patterns in text', async () => {
      const textResponse = 'I suggest using this commit message: fix(auth): Resolve login validation issue for better security';
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: textResponse });

      const result = await generateCommitMessage('Fix login');

      expect(result).toEqual({
        message: 'fix(auth): Resolve login validation issue for better security',
        description: 'Extracted commit message from plain text response'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Found conventional commit pattern in text:', 'fix(auth): Resolve login validation issue for better security');
    });

    it('should find general commit patterns', async () => {
      const textResponse = 'You could use something like: feat-add-user-authentication-system';
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: textResponse });

      const result = await generateCommitMessage('Add auth');

      expect(result).toEqual({
        message: 'feat-add-user-authentication-system',
        description: 'Extracted commit message pattern from AI response'
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Found general commit pattern:', 'feat-add-user-authentication-system');
    });

    it('should use fallback parsing for unstructured responses', async () => {
      const messyResponse = `Sure, here's a commit message: 
      - Update the todo functionality
      \`\`\`some code\`\`\`
      Here's more info...`;
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: messyResponse });

      const result = await generateCommitMessage('Update todo');

      expect(result.message).toBe('Update the todo functionality\n      \n      Here\'s more info...');
      expect(result.description).toBe('Used cleaned AI response as commit message');
      expect(logger.log).toHaveBeenCalledWith('AI Service: Using fallback parsing, cleaned message:', expect.any(String));
    });

    it('should use default message for completely empty responses', async () => {
      const emptyResponse = '```\n\n```';
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: emptyResponse });

      const result = await generateCommitMessage('Empty response');

      expect(result).toEqual({
        message: 'fix: Update task',
        description: 'Used cleaned AI response as commit message'
      });
    });
  });

  describe('generateCommitMessage', () => {
    beforeEach(() => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key',
        aiModel: 'gemini-2.5-flash'
      });
    });

    it('should successfully generate commit message', async () => {
      const jsonResponse = JSON.stringify({
        message: 'feat: Add new todo creation',
        description: 'Implemented AI-powered todo generation'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: jsonResponse });

      const result = await generateCommitMessage('Add new todo creation functionality');

      expect(result.message).toBe('feat: Add new todo creation');
      expect(result.description).toBe('Implemented AI-powered todo generation');
      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        body: JSON.stringify({
          action: 'generateCommitMessage',
          payload: { changeDescription: 'Add new todo creation functionality' },
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash'
        })
      }));
    });

    it('should handle network errors for commit message generation', async () => {
      const networkError = new TypeError('fetch failed');
      vi.mocked(fetchJsonWithTimeout).mockRejectedValue(networkError);

      await expect(generateCommitMessage('test change')).rejects.toThrow('Network error: Unable to connect to AI service for commit message generation.');
      expect(logger.error).toHaveBeenCalledWith('AI Service: Commit message generation error:', networkError);
    });

    it('should handle other errors by rethrowing', async () => {
      const customError = new Error('API error');
      vi.mocked(fetchJsonWithTimeout).mockRejectedValue(customError);

      await expect(generateCommitMessage('test change')).rejects.toThrow('API error');
      expect(logger.error).toHaveBeenCalledWith('AI Service: Commit message generation error:', customError);
    });
  });

  describe('processChatMessage', () => {
    beforeEach(() => {
      vi.mocked(loadSettings).mockReturnValue({
        aiProvider: 'openrouter',
        openRouterApiKey: 'test-key',
        aiModel: 'anthropic/claude-3.5-sonnet'
      });
    });

    it('should process structured JSON response', async () => {
      const structuredResponse = JSON.stringify({
        content: '- [ ] Updated task 1\n- [ ] Updated task 2\n- [ ] New task',
        description: 'Added new task based on user request'
      });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: structuredResponse });

      const result = await processChatMessage(
        'Add a new task',
        '- [ ] Task 1\n- [ ] Task 2',
        [{ role: 'user', content: 'Previous message' }]
      );

      expect(result).toEqual({
        content: '- [ ] Updated task 1\n- [ ] Updated task 2\n- [ ] New task',
        description: 'Added new task based on user request'
      });
      expect(fetchJsonWithTimeout).toHaveBeenCalledWith('/api/ai', expect.objectContaining({
        body: JSON.stringify({
          action: 'processChatMessage',
          payload: {
            message: 'Add a new task',
            currentContent: '- [ ] Task 1\n- [ ] Task 2',
            chatHistory: [{ role: 'user', content: 'Previous message' }]
          },
          provider: 'openrouter',
          apiKey: 'test-key',
          model: 'anthropic/claude-3.5-sonnet'
        })
      }));
    });

    it('should handle JSON response missing expected fields', async () => {
      const incompleteJson = JSON.stringify({ content: 'Updated content' });
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: incompleteJson });

      const result = await processChatMessage('test message', 'content', []);

      expect(result).toEqual({
        content: incompleteJson,
        description: undefined
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: JSON response missing expected fields, falling back to text mode');
    });

    it('should handle non-JSON responses as text', async () => {
      const textResponse = '- [ ] Task 1\n- [ ] Task 2\n- [ ] Added task';
      vi.mocked(fetchJsonWithTimeout).mockResolvedValue({ text: textResponse });

      const result = await processChatMessage('Add task', 'content', []);

      expect(result).toEqual({
        content: textResponse,
        description: undefined
      });
      expect(logger.log).toHaveBeenCalledWith('AI Service: Response is not JSON, treating as plain text');
    });

    it('should handle errors in processChatMessage', async () => {
      const error = new Error('Chat processing failed');
      vi.mocked(fetchJsonWithTimeout).mockRejectedValue(error);

      await expect(processChatMessage('test', 'content', [])).rejects.toThrow('Chat processing failed');
      expect(logger.error).toHaveBeenCalledWith('AI Service: processChatMessage error:', error);
    });
  });
});