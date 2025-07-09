import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import GitHubSettings from '../GitHubSettings';

// Mock the services
vi.mock('../../services/githubService', () => ({
  listProjectFolders: vi.fn().mockResolvedValue(['todos', 'work']),
  createProjectFolder: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../utils/localStorage', () => ({
  saveSettings: vi.fn(),
  loadSettings: vi.fn().mockReturnValue(null)
}));

const mockProps = {
  onSettingsSaved: vi.fn()
};

describe('GitHubSettings - Basic Feature Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GitHub Integration Configuration', () => {
    it('renders application setup form', () => {
      render(<GitHubSettings {...mockProps} />);
      
      expect(screen.getByText(/application setup/i)).toBeInTheDocument();
    });

    it('shows PAT input field', () => {
      render(<GitHubSettings {...mockProps} />);
      
      const patInput = screen.getByLabelText(/GitHub Personal Access Token/i);
      expect(patInput).toBeInTheDocument();
      expect(patInput).toHaveAttribute('type', 'password');
    });

    it('shows repository owner input', () => {
      render(<GitHubSettings {...mockProps} />);
      
      const ownerInput = screen.getByLabelText(/Repository Owner/i);
      expect(ownerInput).toBeInTheDocument();
    });

    it('shows repository name input', () => {
      render(<GitHubSettings {...mockProps} />);
      
      const repoInput = screen.getByLabelText(/Repository Name/i);
      expect(repoInput).toBeInTheDocument();
    });

    it('shows AI provider configuration', () => {
      render(<GitHubSettings {...mockProps} />);
      
      expect(screen.getByText(/AI Provider Configuration/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/AI Provider/i)).toBeInTheDocument();
    });

    it('shows save settings button', () => {
      render(<GitHubSettings {...mockProps} />);
      
      const saveButton = screen.getByText(/save settings/i);
      expect(saveButton).toBeInTheDocument();
    });

    it('handles input changes correctly', async () => {
      render(<GitHubSettings {...mockProps} />);
      
      const patInput = screen.getByLabelText(/GitHub Personal Access Token/i);
      const ownerInput = screen.getByLabelText(/Repository Owner/i);
      const repoInput = screen.getByLabelText(/Repository Name/i);
      
      await userEvent.type(patInput, 'test-token');
      await userEvent.type(ownerInput, 'test-owner');
      await userEvent.type(repoInput, 'test-repo');
      
      expect(patInput).toHaveValue('test-token');
      expect(ownerInput).toHaveValue('test-owner');
      expect(repoInput).toHaveValue('test-repo');
    });

    it('shows security information about PAT', () => {
      render(<GitHubSettings {...mockProps} />);
      
      expect(screen.getByText(/fine-grained PAT/i)).toBeInTheDocument();
    });

    it('shows AI provider selection', () => {
      render(<GitHubSettings {...mockProps} />);
      
      const providerSelect = screen.getByLabelText(/AI Provider/i);
      expect(providerSelect).toBeInTheDocument();
      
      // Check that the select has the expected default value
      expect(providerSelect).toHaveValue('gemini');
    });
  });

  describe('Form Validation and UX', () => {
    it('shows Gemini API key field when Gemini is selected', () => {
      render(<GitHubSettings {...mockProps} />);
      
      // Gemini is selected by default
      expect(screen.getByLabelText(/Google Gemini API Key/i)).toBeInTheDocument();
    });

    it('switches to OpenRouter fields when OpenRouter is selected', async () => {
      render(<GitHubSettings {...mockProps} />);
      
      const providerSelect = screen.getByLabelText(/AI Provider/i);
      await userEvent.selectOptions(providerSelect, 'openrouter');
      
      expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeInTheDocument();
    });

    it('shows project folder configuration', () => {
      render(<GitHubSettings {...mockProps} />);
      
      expect(screen.getByText(/Project Folder/i)).toBeInTheDocument();
      expect(screen.getByText(/New Project/i)).toBeInTheDocument();
    });
  });
});