import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import SettingsSharing from '../SettingsSharing';
import * as localStorage from '../../utils/localStorage';

// Mock dependencies
vi.mock('../../utils/localStorage');
vi.mock('qrcode');
vi.mock('../../utils/logger');

const mockLoadSettings = vi.mocked(localStorage.loadSettings);
const mockEncodeSettingsToUrl = vi.mocked(localStorage.encodeSettingsToUrl);

// Mock clipboard API
const mockWriteText = vi.fn(() => Promise.resolve());
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

// Mock window.isSecureContext to ensure clipboard API is available
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  writable: true,
});

describe('SettingsSharing', () => {
  const defaultProps = {
    isVisible: true,
    onClose: vi.fn(),
  };

  const mockSettings = {
    githubPat: 'test-token',
    repoOwner: 'test-owner',
    repoName: 'test-repo',
    todosDirectory: 'todos',
    gitProvider: 'github' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockReturnValue(mockSettings);
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=encoded-settings');
    mockWriteText.mockResolvedValue();
  });

  test('renders modal when visible', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    expect(screen.getByText('Share Configuration')).toBeInTheDocument();
    expect(screen.getByText(/share your configuration settings/i)).toBeInTheDocument();
  });

  test('does not render when not visible', () => {
    render(<SettingsSharing {...defaultProps} isVisible={false} />);
    
    expect(screen.queryByText('Share Configuration')).not.toBeInTheDocument();
  });

  test('closes modal when close button is clicked', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('closes modal when overlay is clicked', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('does not close modal when modal content is clicked', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    const modalContent = screen.getByRole('dialog');
    fireEvent.click(modalContent);

    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  test('displays loading state during generation', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    expect(screen.getByText(/generating configuration/i)).toBeInTheDocument();
  });

  test('calls loadSettings when modal becomes visible', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    expect(mockLoadSettings).toHaveBeenCalled();
  });

  test('handles missing settings gracefully', () => {
    mockLoadSettings.mockReturnValue(null);
    
    render(<SettingsSharing {...defaultProps} />);
    
    expect(mockLoadSettings).toHaveBeenCalled();
    // Should not crash when settings are null
    expect(screen.getByText('Share Configuration')).toBeInTheDocument();
  });

  test('regenerates content when modal reopens', () => {
    const { rerender } = render(<SettingsSharing {...defaultProps} isVisible={false} />);
    
    expect(mockLoadSettings).not.toHaveBeenCalled();
    
    rerender(<SettingsSharing {...defaultProps} isVisible={true} />);
    
    expect(mockLoadSettings).toHaveBeenCalled();
  });

  test('shows security warning text', () => {
    render(<SettingsSharing {...defaultProps} />);
    
    expect(screen.getByText(/GitHub\/GitLab/i)).toBeInTheDocument();
  });

  test('shows copy button with clipboard icon', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for the URL to be generated
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    });
  });

  test('shows copy success state when copy button is clicked', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    mockWriteText.mockResolvedValue();
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for content to be generated
    await waitFor(() => {
      expect(screen.queryByText(/generating configuration/i)).not.toBeInTheDocument();
    });

    // Find and click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    // Check for success state
    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    });

    expect(mockWriteText).toHaveBeenCalledWith('https://example.com?config=test123');
  });

  test('shows feedback toast notification after successful copy', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    mockWriteText.mockResolvedValue();
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for content to be generated
    await waitFor(() => {
      expect(screen.queryByText(/generating configuration/i)).not.toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    // Check for feedback toast with green background and check icon
    await waitFor(() => {
      const feedbackToast = screen.getByText(/link copied to clipboard/i).closest('div')?.parentElement;
      expect(feedbackToast).toHaveClass('bg-green-900/50', 'border-green-600');
      
      // Check for success icon in toast
      const successIcon = feedbackToast?.querySelector('svg');
      expect(successIcon).toBeInTheDocument();
    });
  });

  test('handles copy failure gracefully', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    mockWriteText.mockRejectedValue(new Error('Clipboard access denied'));
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for content to be generated
    await waitFor(() => {
      expect(screen.queryByText(/generating configuration/i)).not.toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    // Should show fallback feedback for manual copy
    await waitFor(() => {
      expect(screen.getByText(/use ctrl\+c.*to copy/i)).toBeInTheDocument();
    });
  });

  test('copy success state has correct styling', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    mockWriteText.mockResolvedValue();
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for content to be generated
    await waitFor(() => {
      expect(screen.queryByText(/generating configuration/i)).not.toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    // Check that success button has correct styling
    await waitFor(() => {
      const successButton = screen.getByText('Copied!').closest('button');
      expect(successButton).toHaveClass('bg-green-600', 'text-white', 'scale-105', 'shadow-lg');
    });
  });

  test('feedback toast auto-hides after timeout', async () => {
    mockEncodeSettingsToUrl.mockReturnValue('https://example.com?config=test123');
    mockWriteText.mockResolvedValue();
    
    render(<SettingsSharing {...defaultProps} />);
    
    // Wait for content to be generated
    await waitFor(() => {
      expect(screen.queryByText(/generating configuration/i)).not.toBeInTheDocument();
    });

    // Click copy button
    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    // Should show feedback initially
    await waitFor(() => {
      expect(screen.getByText(/link copied to clipboard/i)).toBeInTheDocument();
    });

    // Wait for auto-hide timeout (2500ms according to component)
    await waitFor(() => {
      expect(screen.queryByText(/link copied to clipboard/i)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});