import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeSettingsFromUrl } from '../localStorage';

// Mock logger
const mockLogger = {
  error: vi.fn(),
  log: vi.fn(),
};
vi.mock('../logger', () => ({
  default: mockLogger,
}));

describe('localStorage - Compressed Format Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Compressed format decoding (lines 134-180)', () => {
    it('should decode compressed GitHub settings with all fields', () => {
      // Test the compressed format path (lines 134-148)
      const compressedData = {
        g: 0, // github
        p: 'test-pat',
        o: 'test-owner', 
        r: 'test-repo',
        f: 'custom-folder',
        b: 'develop',
        a: 0, // gemini
        gk: 'gemini-key',
        m: 'gemini-model'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      // Verify all compressed fields are properly decoded (lines 151-163)
      expect(result).toEqual({
        gitProvider: 'github',
        pat: 'test-pat',
        owner: 'test-owner',
        repo: 'test-repo',
        instanceUrl: '',
        projectId: '',
        token: '',
        folder: 'custom-folder',
        branch: 'develop', 
        aiProvider: 'gemini',
        geminiApiKey: 'gemini-key',
        openRouterApiKey: '',
        aiModel: 'gemini-model'
      });
    });

    it('should decode compressed GitLab settings with GitLab provider flag', () => {
      // Test GitLab provider decoding (line 151: g === 1)
      const compressedData = {
        g: 1, // gitlab
        u: 'https://gitlab.example.com',
        i: '12345',
        t: 'gitlab-token',
        f: 'work-tasks',
        a: 1, // openrouter  
        ok: 'openrouter-key',
        m: 'claude-model'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toEqual({
        gitProvider: 'gitlab',
        pat: '',
        owner: '',
        repo: '',
        instanceUrl: 'https://gitlab.example.com',
        projectId: '12345',
        token: 'gitlab-token',
        folder: 'work-tasks',
        branch: 'main',
        aiProvider: 'openrouter',
        geminiApiKey: '',
        openRouterApiKey: 'openrouter-key',
        aiModel: 'claude-model'
      });
    });

    it('should handle compressed format with missing optional fields using defaults', () => {
      // Test default value fallbacks (lines 151-163)
      const compressedData = {
        g: 0, // github (minimal data)
        p: 'pat',
        o: 'owner',
        r: 'repo'
        // Missing: f, b, a, gk, ok, m - should use defaults
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toEqual({
        gitProvider: 'github',
        pat: 'pat',
        owner: 'owner', 
        repo: 'repo',
        instanceUrl: '',
        projectId: '',
        token: '',
        folder: 'todos', // default
        branch: 'main', // default
        aiProvider: 'gemini', // default
        geminiApiKey: '',
        openRouterApiKey: '',
        aiModel: ''
      });
    });

    it('should handle compressed format with undefined gitProvider defaulting to github', () => {
      // Test fallback when g is undefined (line 151: compressed.g || 'github')
      const compressedData = {
        // g is undefined
        p: 'pat',
        o: 'owner',
        r: 'repo'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result?.gitProvider).toBe('github');
    });

    it('should handle compressed format with undefined aiProvider defaulting to gemini', () => {
      // Test fallback when a is undefined (line 160: compressed.a || 'gemini')
      const compressedData = {
        g: 0,
        p: 'pat',
        o: 'owner',
        r: 'repo'
        // a is undefined
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result?.aiProvider).toBe('gemini');
    });

    it('should validate GitHub settings and return null for missing pat', () => {
      // Test GitHub validation failure (lines 167-171)
      const compressedData = {
        g: 0, // github
        // p: missing pat
        o: 'owner',
        r: 'repo'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitHub settings configuration - missing required fields"
      );
    });

    it('should validate GitHub settings and return null for missing owner', () => {
      // Test GitHub validation failure (lines 167-171)  
      const compressedData = {
        g: 0, // github
        p: 'pat',
        // o: missing owner
        r: 'repo'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitHub settings configuration - missing required fields"
      );
    });

    it('should validate GitHub settings and return null for missing repo', () => {
      // Test GitHub validation failure (lines 167-171)
      const compressedData = {
        g: 0, // github  
        p: 'pat',
        o: 'owner'
        // r: missing repo
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitHub settings configuration - missing required fields"
      );
    });

    it('should validate GitLab settings and return null for missing instanceUrl', () => {
      // Test GitLab validation failure (lines 172-176)
      const compressedData = {
        g: 1, // gitlab
        // u: missing instanceUrl
        i: '12345',
        t: 'token'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitLab settings configuration - missing required fields"
      );
    });

    it('should validate GitLab settings and return null for missing projectId', () => {
      // Test GitLab validation failure (lines 172-176)
      const compressedData = {
        g: 1, // gitlab
        u: 'https://gitlab.com',
        // i: missing projectId
        t: 'token'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitLab settings configuration - missing required fields"
      );
    });

    it('should validate GitLab settings and return null for missing token', () => {
      // Test GitLab validation failure (lines 172-176)
      const compressedData = {
        g: 1, // gitlab
        u: 'https://gitlab.com',
        i: '12345'
        // t: missing token
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Invalid GitLab settings configuration - missing required fields"
      );
    });

    it('should return valid GitLab settings when all required fields are present', () => {
      // Test successful GitLab validation (lines 172-179)
      const compressedData = {
        g: 1, // gitlab
        u: 'https://gitlab.com',
        i: '12345',
        t: 'valid-token'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).not.toBeNull();
      expect(result?.gitProvider).toBe('gitlab');
      expect(result?.instanceUrl).toBe('https://gitlab.com');
      expect(result?.projectId).toBe('12345');
      expect(result?.token).toBe('valid-token');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return valid GitHub settings when all required fields are present', () => {
      // Test successful GitHub validation (lines 167-179)
      const compressedData = {
        g: 0, // github
        p: 'valid-pat',
        o: 'valid-owner', 
        r: 'valid-repo'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      expect(result).not.toBeNull();
      expect(result?.gitProvider).toBe('github');
      expect(result?.pat).toBe('valid-pat');
      expect(result?.owner).toBe('valid-owner');
      expect(result?.repo).toBe('valid-repo');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});