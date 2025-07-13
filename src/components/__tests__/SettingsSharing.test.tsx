import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
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
});