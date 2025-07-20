import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockLoadSettings = vi.fn();
vi.mock('../../utils/localStorage', () => ({
  loadSettings: mockLoadSettings,
}));

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

// Mock window.location
const mockLocation = {
  hostname: 'localhost',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('aiService - Focused Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockLocation.hostname = 'localhost';
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getApiUrl function - relative URLs for all environments', () => {
    it('should use relative URL when not localhost', async () => {
      // Set hostname to external IP 
      mockLocation.hostname = '159.65.120.9';
      
      // Mock successful AI settings and response
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('AI response'),
        json: () => Promise.resolve({ response: 'AI response' })
      });
      
      // Import and call a function that uses the AI API
      const { generateInitialPlan } = await import('../aiService');
      
      await generateInitialPlan('test goal');
      
      // Should always use relative URL regardless of hostname
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });

    it('should use relative URL for localhost', async () => {
      // Keep hostname as localhost
      mockLocation.hostname = 'localhost';
      
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('AI response'),
        json: () => Promise.resolve({ response: 'AI response' })
      });
      
      const { generateInitialPlan } = await import('../aiService');
      
      await generateInitialPlan('test goal');
      
      // Should always use relative URL
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });

    it('should use relative URL for 127.0.0.1', async () => {
      mockLocation.hostname = '127.0.0.1';
      
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('AI response'),
        json: () => Promise.resolve({ response: 'AI response' })
      });
      
      const { generateInitialPlan } = await import('../aiService');
      
      await generateInitialPlan('test goal');
      
      // Should always use relative URL
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });

    it('should use relative URL for custom domain', async () => {
      mockLocation.hostname = 'my-app.custom-domain.com';
      
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('AI response'),
        json: () => Promise.resolve({ response: 'AI response' })
      });
      
      const { generateInitialPlan } = await import('../aiService');
      
      await generateInitialPlan('test goal');
      
      // Should always use relative URL regardless of domain
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });

    it('should handle various hostname scenarios', async () => {
      const testCases = [
        { hostname: '192.168.1.100', expectedUrl: '/api/ai' },
        { hostname: 'production.example.com', expectedUrl: '/api/ai' },
        { hostname: 'staging-server', expectedUrl: '/api/ai' },
        { hostname: 'localhost', expectedUrl: '/api/ai' },
        { hostname: '127.0.0.1', expectedUrl: '/api/ai' },
      ];

      for (const testCase of testCases) {
        vi.resetModules();
        vi.clearAllMocks();
        
        mockLocation.hostname = testCase.hostname;
        
        mockLoadSettings.mockReturnValue({
          aiProvider: 'gemini',
          geminiApiKey: 'test-key'
        });
        
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('AI response'),
          json: () => Promise.resolve({ response: 'AI response' })
        });
        
        const { generateInitialPlan } = await import('../aiService');
        
        await generateInitialPlan('test goal');
        
        expect(mockFetch).toHaveBeenCalledWith(
          testCase.expectedUrl,
          expect.any(Object)
        );
      }
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle network errors with relative URL', async () => {
      mockLocation.hostname = '10.0.0.5';
      
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const { generateInitialPlan } = await import('../aiService');
      
      await expect(generateInitialPlan('test goal'))
        .rejects.toThrow('Network error');
      
      // Should always use relative URL
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });

    it('should handle server errors with relative URL', async () => {
      mockLocation.hostname = '172.16.0.10';
      
      mockLoadSettings.mockReturnValue({
        aiProvider: 'gemini',
        geminiApiKey: 'test-key'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server Error')
      });
      
      const { generateInitialPlan } = await import('../aiService');
      
      await expect(generateInitialPlan('test goal'))
        .rejects.toThrow();
      
      // Should always use relative URL
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai',
        expect.any(Object)
      );
    });
  });
});