import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VersionInfoComponent from '../VersionInfo';

// Mock the version service
vi.mock('../../services/versionService', () => ({
  getVersionInfo: vi.fn(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

describe('VersionInfo - Focused Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('formatSha function coverage', () => {
    it('should format regular SHA to 7 characters', async () => {
      // Test line 53: return sha.substring(0, 7);
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890abcdef12',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('abcdef1')).toBeInTheDocument();
      });
    });

    it('should handle development SHA without formatting', async () => {
      // Test line 52: if (sha === 'development' || sha === 'unknown') return sha;
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'development',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'production' // Use different env to avoid duplicate text
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        // Look for development in the commit SHA area specifically
        const commitElements = screen.getAllByText('development');
        expect(commitElements.length).toBeGreaterThan(0);
      });
      
      await waitFor(() => {
        // Verify it's in the gray background (commit SHA style)
        const commitElements = screen.getAllByText('development');
        const commitSha = commitElements.find(el => 
          el.className.includes('bg-gray-100')
        );
        expect(commitSha).toBeInTheDocument();
      });
    });

    it('should handle unknown SHA without formatting', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'unknown',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('unknown')).toBeInTheDocument();
      });
    });
  });

  describe('gitTag vs version display coverage', () => {
    it('should display gitTag when available and not unknown', async () => {
      // Test line 62: versionInfo.gitTag - the "true" branch
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: 'v1.2.3',
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('v1.2.3')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
      });
    });

    it('should fall back to version when gitTag is unknown', async () => {
      // Test line 63: versionInfo.version - the fallback case
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: 'unknown',
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('1.0.0')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.queryByText('unknown')).not.toBeInTheDocument();
      });
    });

    it('should fall back to version when gitTag is null', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('1.0.0')).toBeInTheDocument();
      });
    });
  });

  describe('buildDate conditional rendering coverage', () => {
    it('should render build date when available and valid', async () => {
      // Test lines 75-78: the buildDate conditional rendering
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: '2023-12-25T10:30:00.000Z',
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('Built:')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        // The date format should be YYYYMMDDHHMM - use regex to handle timezone differences
        expect(screen.getByText(/^20231225\d{4}$/)).toBeInTheDocument();
      });
    });

    it('should not render build date when null', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.queryByText('Built:')).not.toBeInTheDocument();
      });
    });

    it('should not render build date when unknown', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: 'unknown',
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.queryByText('Built:')).not.toBeInTheDocument();
      });
    });

    it('should handle invalid date gracefully', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: 'invalid-date-string',
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('Built:')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        // Invalid dates result in NaN values being formatted as NaNNaNNaNNaNNaN
        expect(screen.getByText('NaNNaNNaNNaNNaN')).toBeInTheDocument();
      });
    });

    it('should handle date parsing exception in catch block (lines 47-48)', async () => {
      // Test the catch block by providing a date string that throws during parsing
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: 'throw-error-date', // This will trigger exception handling
        nodeEnv: 'production'
      };

      // Mock Date constructor to throw an error
      const originalDate = global.Date;
      global.Date = class extends Date {
        constructor(value?: any) {
          if (value === 'throw-error-date') {
            throw new Error('Date parsing error');
          }
          super(value);
        }
      } as any;

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('Built:')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        // Should return the original dateString when catch block is hit (line 47)
        expect(screen.getByText('throw-error-date')).toBeInTheDocument();
      });

      // Restore original Date constructor
      global.Date = originalDate;
    });
  });

  describe('environment styling coverage', () => {
    it('should apply production styling for production environment', async () => {
      // Test line 86: production styling branch
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        const envElement = screen.getByText('production');
        expect(envElement).toHaveClass('bg-green-100', 'text-green-800');
      });
    });

    it('should apply development styling for non-production environments', async () => {
      // Test the else branch of the environment styling
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'unknownsha123',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'development'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        // Find the environment badge specifically by looking for the classes
        const envElements = screen.getAllByText('development');
        const envBadge = envElements.find(el => 
          el.className.includes('bg-yellow-100') && el.className.includes('text-yellow-800')
        );
        expect(envBadge).toBeInTheDocument();
      });
      
      await waitFor(() => {
        const envElements = screen.getAllByText('development');
        const envBadge = envElements.find(el => 
          el.className.includes('bg-yellow-100') && el.className.includes('text-yellow-800')
        );
        expect(envBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
      });
    });

    it('should apply development styling for staging environment', async () => {
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: null,
        nodeEnv: 'staging'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        const envElement = screen.getByText('staging');
        expect(envElement).toHaveClass('bg-yellow-100', 'text-yellow-800');
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle version service errors', async () => {
      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockRejectedValueOnce(new Error('Service unavailable'));

      render(<VersionInfoComponent />);

      await waitFor(async () => {
        const logger = vi.mocked(await import('../../utils/logger')).default;
        expect(logger.error).toHaveBeenCalledWith('Failed to load version info:', expect.any(Error));
      });

      // Should not render version info after error
      expect(screen.queryByText('Version:')).not.toBeInTheDocument();
    });

    it('should show loading state initially', async () => {
      // Delay the mock resolution to test loading state
      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          version: '1.0.0',
          gitSha: 'abcdef1234567890',
          gitTag: null,
          buildDate: null,
          nodeEnv: 'development'
        }), 100))
      );

      render(<VersionInfoComponent />);

      expect(screen.getByText('Loading version info...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText('Loading version info...')).not.toBeInTheDocument();
      });
    });

    it('should handle complex date formatting edge cases', async () => {
      // Test various date edge cases
      const mockVersionInfo = {
        version: '1.0.0',
        gitSha: 'abcdef1234567890',
        gitTag: null,
        buildDate: '2023-01-01T00:00:00.000Z',
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        // Use regex to handle timezone differences across CI environments
        expect(screen.getByText(/^20230101\d{4}$/)).toBeInTheDocument();
      });
    });

    it('should handle all version info fields together', async () => {
      // Comprehensive test covering all fields
      const mockVersionInfo = {
        version: '2.1.5',
        gitSha: 'fedcba0987654321fedcba09',
        gitTag: 'v2.1.5-release',
        buildDate: '2023-12-31T12:59:00.000Z',
        nodeEnv: 'production'
      };

      const { getVersionInfo } = await import('../../services/versionService');
      vi.mocked(getVersionInfo).mockResolvedValueOnce(mockVersionInfo);

      render(<VersionInfoComponent />);

      await waitFor(() => {
        expect(screen.getByText('v2.1.5-release')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText('fedcba0')).toBeInTheDocument();
      });
      
      await waitFor(() => {
        // Use regex to handle timezone differences across CI environments
        expect(screen.getByText(/^20231231\d{4}$/)).toBeInTheDocument();
      });
      
      await waitFor(() => {
        expect(screen.getByText('production')).toBeInTheDocument();
      });
    });
  });
});