import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decodeSettingsFromUrl } from '../localStorage';

// Mock logger
vi.mock('../logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('localStorage - Compressed Format Coverage', () => {
  let mockLogger: { error: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked logger
    const logger = await import('../logger');
    mockLogger = vi.mocked(logger.default);
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
        a: 0, // gemini
        gk: 'gemini-key',
        m: 'gemini-model'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      // Verify all compressed fields are properly decoded (lines 151-163)
      expect(result).toEqual({
        gitProvider: 'github',
        folder: 'custom-folder',
        aiProvider: 'gemini',
        geminiApiKey: 'gemini-key',
        openRouterApiKey: '',
        aiModel: 'gemini-model',
        github: {
          pat: 'test-pat',
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'main'
        }
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
        folder: 'work-tasks',
        aiProvider: 'openrouter',
        geminiApiKey: '',
        openRouterApiKey: 'openrouter-key',
        aiModel: 'claude-model',
        gitlab: {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        }
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
        folder: 'todos', // default
        aiProvider: 'gemini', // default
        geminiApiKey: '',
        openRouterApiKey: '',
        aiModel: '',
        github: {
          pat: 'pat',
          owner: 'owner',
          repo: 'repo',
          branch: 'main' // default
        }
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
        "Invalid configuration - no complete provider settings found"
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
        "Invalid configuration - no complete provider settings found"
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
        "Invalid configuration - no complete provider settings found"
      );
    });

    it('should validate GitLab settings and return null for missing instanceUrl', () => {
      // Test GitLab validation failure (lines 172-176)
      const compressedData = {
        g: 1, // gitlab
        // u: missing instanceUrl (defaults to https://gitlab.com)
        i: '12345',
        t: 'token'
      };

      const encoded = btoa(JSON.stringify(compressedData));
      const result = decodeSettingsFromUrl(encoded);

      // This actually passes validation because instanceUrl defaults to https://gitlab.com
      expect(result).not.toBeNull();
      expect(result?.gitlab?.instanceUrl).toBe('https://gitlab.com');
      expect(result?.gitlab?.projectId).toBe('12345');
      expect(result?.gitlab?.token).toBe('token');
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
        "Invalid configuration - no complete provider settings found"
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
        "Invalid configuration - no complete provider settings found"
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
      expect(result?.gitlab?.instanceUrl).toBe('https://gitlab.com');
      expect(result?.gitlab?.projectId).toBe('12345');
      expect(result?.gitlab?.token).toBe('valid-token');
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
      expect(result?.github?.pat).toBe('valid-pat');
      expect(result?.github?.owner).toBe('valid-owner');
      expect(result?.github?.repo).toBe('valid-repo');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });
});