import { generateInitialPlan, generateCommitMessage, processChatMessage } from '../aiService';

// Mock fetch globally
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AI Service - Basic Feature Coverage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Feature 1: AI-Powered Task Generation', () => {
    test('generateInitialPlan returns markdown task list', async () => {
      // Mock successful AI response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          response: '- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3' 
        }),
      } as Response);

      const result = await generateInitialPlan('Deploy web application');
      
      expect(result).toContain('- [ ]');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gemini'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('generateInitialPlan')
        })
      );
    });

    test('handles AI service failures gracefully', async () => {
      // Mock failed AI response
      mockFetch.mockRejectedValueOnce(new Error('AI service unavailable'));

      const result = await generateInitialPlan('Test goal');
      
      expect(result).toContain('Error generating plan');
    });
  });

  describe('Feature 8: Conventional Commits with AI', () => {
    test('generateCommitMessage creates conventional commit format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          response: 'feat: Add new todo "Deploy web app"' 
        }),
      } as Response);

      const result = await generateCommitMessage('create', 'Deploy web app', 'content');
      
      expect(result).toMatch(/^(feat|fix|docs|chore):/);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Feature 4: AI Chat Assistant', () => {
    test('processChatMessage modifies content based on user input', async () => {
      const originalContent = '- [ ] Task 1\n- [ ] Task 2';
      const chatMessage = 'Add a task for testing';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          response: '- [ ] Task 1\n- [ ] Task 2\n- [ ] Add testing task' 
        }),
      } as Response);

      const result = await processChatMessage(chatMessage, originalContent, []);
      
      expect(result).toContain('testing');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    test('handles chat processing errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Chat service error'));

      const result = await processChatMessage('test', 'content', []);
      
      expect(result).toContain('Error processing');
    });
  });
});