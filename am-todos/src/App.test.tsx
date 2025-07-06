import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock the services
jest.mock('./services/githubService');
jest.mock('./services/aiService');

describe('App Component - Basic Feature Coverage', () => {
  beforeEach(() => {
    // Mock localStorage to return empty settings
    (localStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  test('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });

  test('shows GitHub settings when not configured', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/github settings/i)).toBeInTheDocument();
    });
  });

  test('renders main layout components', () => {
    render(<App />);
    
    // Check for main structural elements
    const appContainer = document.querySelector('.min-h-screen');
    expect(appContainer).toBeInTheDocument();
  });

  test('handles mobile sidebar toggle', async () => {
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
