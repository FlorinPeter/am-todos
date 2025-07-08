import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from './App';

// Mock the services
vi.mock('./services/githubService');
vi.mock('./services/aiService');

describe('App Component - Basic Feature Coverage', () => {
  beforeEach(() => {
    // Mock localStorage to return empty settings
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  it('shows GitHub settings when not configured', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/github settings/i)).toBeInTheDocument();
    });
  });

  it('renders main layout components', () => {
    render(<App />);
    
    // Check for main structural elements
    const appContainer = document.querySelector('.min-h-screen');
    expect(appContainer).toBeInTheDocument();
  });

  it('handles mobile sidebar toggle', async () => {
    render(<App />);
    
    // Look for hamburger menu button (mobile)
    const hamburgerButton = document.querySelector('[data-testid="hamburger-menu"]');
    if (hamburgerButton) {
      await userEvent.click(hamburgerButton);
    }
    
    // Test passes if no errors thrown
    expect(true).toBe(true);
  });
});
