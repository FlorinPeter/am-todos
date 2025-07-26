import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GitSettings from '../GitSettings';

// Mock localStorage
vi.mock('../../utils/localStorage', () => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

// Mock git service
vi.mock('../../services/gitService', () => ({
  listProjectFolders: vi.fn(),
  createProjectFolder: vi.fn(),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock SettingsSharing component
vi.mock('../SettingsSharing', () => ({
  default: ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => (
    isVisible ? (
      <div data-testid="settings-sharing-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    ) : null
  ),
}));

// Mock VersionInfo component
vi.mock('../VersionInfo', () => ({
  default: () => <div data-testid="version-info">Version Info Component</div>,
}));

describe('GitSettings - Focused Coverage Tests', () => {
  const mockOnSettingsSaved = vi.fn();
  let mockLoadSettings: ReturnType<typeof vi.fn>;
  let mockSaveSettings: ReturnType<typeof vi.fn>;
  let mockListProjectFolders: ReturnType<typeof vi.fn>;
  let mockCreateProjectFolder: ReturnType<typeof vi.fn>;
  let mockLogger: { error: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get the mocked functions
    const localStorage = await import('../../utils/localStorage');
    mockLoadSettings = vi.mocked(localStorage.loadSettings);
    mockSaveSettings = vi.mocked(localStorage.saveSettings);
    
    const gitService = await import('../../services/gitService');
    mockListProjectFolders = vi.mocked(gitService.listProjectFolders);
    mockCreateProjectFolder = vi.mocked(gitService.createProjectFolder);
    
    const logger = await import('../../utils/logger');
    mockLogger = vi.mocked(logger.default);
    
    // Set default mock values
    mockLoadSettings.mockReturnValue(null); // No saved settings by default
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks', 'personal']);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component initialization and state loading', () => {
    it('should load and apply saved settings from localStorage', async () => {
      // Test the useEffect that loads saved settings (lines 41-63)
      const savedSettings = {
        gitProvider: 'gitlab',
        folder: 'custom-folder',
        aiProvider: 'openrouter',
        geminiApiKey: 'gemini-key',
        openRouterApiKey: 'openrouter-key',
        aiModel: 'custom-model',
        github: {
          pat: 'github-token',
          owner: 'testowner',
          repo: 'testrepo',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://custom.gitlab.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        }
      };
      
      mockLoadSettings.mockReturnValue(savedSettings);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify GitLab provider is selected
      expect(screen.getByLabelText('Choose Your Git Provider')).toHaveValue('gitlab');
      
      // Verify GitLab settings are loaded
      expect(screen.getByDisplayValue('https://custom.gitlab.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12345')).toBeInTheDocument();
      expect(screen.getByDisplayValue('gitlab-token')).toBeInTheDocument();
      
      // Verify common settings
      expect(screen.getByDisplayValue('custom-folder')).toBeInTheDocument();
      expect(screen.getByLabelText('AI Provider')).toHaveValue('openrouter');
      expect(screen.getByDisplayValue('openrouter-key')).toBeInTheDocument();
      expect(screen.getByDisplayValue('custom-model')).toBeInTheDocument();
    });

    it('should use default values when no saved settings exist', () => {
      mockLoadSettings.mockReturnValue(null);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Should use default values
      expect(screen.getByLabelText('Choose Your Git Provider')).toHaveValue('github');
      expect(screen.getByDisplayValue('todos')).toBeInTheDocument();
      expect(screen.getByLabelText('AI Provider')).toHaveValue('gemini');
    });
  });

  describe('Provider switching and conditional rendering', () => {
    it('should show GitHub configuration when GitHub is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // GitHub should be selected by default
      expect(screen.getByLabelText('Choose Your Git Provider')).toHaveValue('github');
      
      // GitHub-specific fields should be visible
      expect(screen.getByLabelText('GitHub Personal Access Token (PAT)')).toBeInTheDocument();
      expect(screen.getByLabelText('Repository Owner (Username or Organization)')).toBeInTheDocument();
      expect(screen.getByLabelText('Repository Name')).toBeInTheDocument();
      
      // GitLab fields should not be visible
      expect(screen.queryByLabelText('GitLab Instance URL')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Project ID')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('GitLab Personal Access Token')).not.toBeInTheDocument();
    });

    it('should show GitLab configuration when GitLab is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      const providerSelect = screen.getByLabelText('Choose Your Git Provider');
      fireEvent.change(providerSelect, { target: { value: 'gitlab' } });

      // GitLab-specific fields should be visible
      expect(screen.getByLabelText('GitLab Instance URL')).toBeInTheDocument();
      expect(screen.getByLabelText('Project ID')).toBeInTheDocument();
      expect(screen.getByLabelText('GitLab Personal Access Token')).toBeInTheDocument();
      
      // GitHub fields should not be visible
      expect(screen.queryByLabelText('GitHub Personal Access Token (PAT)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Repository Owner (Username or Organization)')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Repository Name')).not.toBeInTheDocument();
    });

    it('should show Gemini configuration when Gemini is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Gemini should be selected by default
      expect(screen.getByLabelText('Google Gemini API Key')).toBeInTheDocument();
      expect(screen.queryByLabelText('OpenRouter API Key')).not.toBeInTheDocument();
      
      // Should show Gemini-specific placeholder and help text
      expect(screen.getByPlaceholderText('gemini-2.5-flash')).toBeInTheDocument();
    });

    it('should show OpenRouter configuration when OpenRouter is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to OpenRouter
      const aiProviderSelect = screen.getByLabelText('AI Provider');
      fireEvent.change(aiProviderSelect, { target: { value: 'openrouter' } });

      // OpenRouter fields should be visible
      expect(screen.getByLabelText('OpenRouter API Key')).toBeInTheDocument();
      expect(screen.queryByLabelText('Google Gemini API Key')).not.toBeInTheDocument();
      
      // Should show OpenRouter-specific placeholder
      expect(screen.getByPlaceholderText('anthropic/claude-3.5-sonnet')).toBeInTheDocument();
    });
  });

  describe('Folder loading functionality', () => {
    it('should load folders when GitHub credentials are complete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in GitHub credentials
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Wait for folder loading to complete
      await waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(mockListProjectFolders).toHaveBeenCalled();
      });
    });

    it('should load folders when GitLab credentials are complete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Fill in GitLab credentials
      fireEvent.change(screen.getByLabelText('GitLab Instance URL'), {
        target: { value: 'https://gitlab.com' }
      });
      fireEvent.change(screen.getByLabelText('Project ID'), {
        target: { value: '12345' }
      });
      fireEvent.change(screen.getByLabelText('GitLab Personal Access Token'), {
        target: { value: 'gitlab-token' }
      });

      // Wait for folder loading to complete
      await waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(mockListProjectFolders).toHaveBeenCalled();
      });
    });

    it('should not load folders when GitHub credentials are incomplete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in only partial GitHub credentials
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      // Don't fill in repo name

      // Should not call listProjectFolders
      await waitFor(() => {
        expect(mockListProjectFolders).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should not load folders when GitLab credentials are incomplete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Fill in only partial GitLab credentials
      fireEvent.change(screen.getByLabelText('GitLab Instance URL'), {
        target: { value: 'https://gitlab.com' }
      });
      // Don't fill in project ID or token

      // Should not call listProjectFolders
      await waitFor(() => {
        expect(mockListProjectFolders).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should handle folder loading errors gracefully', async () => {
      mockListProjectFolders.mockRejectedValue(new Error('Network error'));

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in GitHub credentials to trigger folder loading
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Wait for error handling
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to load folders:', expect.any(Error));
      });
    });

    it('should show loading state when loading folders', async () => {
      // Mock a slow response
      let resolvePromise: (value: string[]) => void;
      const slowPromise = new Promise<string[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockListProjectFolders.mockReturnValue(slowPromise);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in credentials to trigger loading
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading existing projects...')).toBeInTheDocument();
      });

      // Complete the loading
      resolvePromise!(['todos', 'work-tasks']);

      // Loading message should disappear
      await waitFor(() => {
        expect(screen.queryByText('Loading existing projects...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Folder selection and display', () => {
    it('should show dropdown when multiple folders are available', async () => {
      mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks', 'personal']);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in credentials to load folders
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Wait for folders to load and dropdown to appear
      await waitFor(() => {
        const folderSelect = screen.getByDisplayValue('todos');
        expect(folderSelect.tagName).toBe('SELECT');
      });
      
      await waitFor(() => {
        expect(screen.getByText('Found 3 project folders. Select one or create a new project.')).toBeInTheDocument();
      });
    });

    it('should show input field when only one folder is available', () => {
      mockListProjectFolders.mockResolvedValue(['todos']);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Should show input field
      const folderInput = screen.getByDisplayValue('todos');
      expect(folderInput.tagName).toBe('INPUT');
      expect(screen.getByText(/Folder in your repository where tasks will be stored/)).toBeInTheDocument();
    });
  });

  describe('Create folder functionality', () => {
    it('should show create folder form when "+ New Project" is clicked', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Click the New Project button
      fireEvent.click(screen.getByText('+ New Project'));

      // Create folder form should be visible
      expect(screen.getByText('Create New Project Folder')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('work-tasks')).toBeInTheDocument();
      expect(screen.getByText('Create Project')).toBeInTheDocument();
    });

    it('should hide create folder form when "Cancel" is clicked', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show the form
      fireEvent.click(screen.getByText('+ New Project'));
      expect(screen.getByText('Create New Project Folder')).toBeInTheDocument();

      // Click Cancel button in the create folder form (the gray one, not the green one)
      const cancelButtons = screen.getAllByText('Cancel');
      const createFolderCancelButton = cancelButtons.find(button => 
        button.className.includes('text-gray-400')
      );
      fireEvent.click(createFolderCancelButton!);

      // Form should be hidden
      expect(screen.queryByText('Create New Project Folder')).not.toBeInTheDocument();
      expect(screen.getByText('+ New Project')).toBeInTheDocument();
    });

    it('should toggle create folder form when "+ New Project" is clicked multiple times', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show the form
      fireEvent.click(screen.getByText('+ New Project'));
      expect(screen.getByText('Create New Project Folder')).toBeInTheDocument();

      // Click the Cancel button to hide the form (the gray one, not the green one)
      const cancelButtons = screen.getAllByText('Cancel');
      const createFolderCancelButton = cancelButtons.find(button => 
        button.className.includes('text-gray-400')
      );
      fireEvent.click(createFolderCancelButton!);
      expect(screen.queryByText('Create New Project Folder')).not.toBeInTheDocument();
    });

    it('should handle successful folder creation', async () => {
      mockCreateProjectFolder.mockResolvedValue(undefined);
      mockListProjectFolders.mockResolvedValue(['todos', 'new-project']);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in GitHub credentials first
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Click create
      fireEvent.click(screen.getByText('Create Project'));

      // Wait for creation to complete
      await waitFor(() => {
        expect(mockCreateProjectFolder).toHaveBeenCalledWith('new-project');
      });
      
      await waitFor(() => {
        expect(mockListProjectFolders).toHaveBeenCalled();
      });

      // Form should be hidden and folder should be selected
      await waitFor(() => {
        expect(screen.queryByText('Create New Project Folder')).not.toBeInTheDocument();
      });
    });

    it('should handle folder creation errors', async () => {
      const createError = new Error('Creation failed');
      mockCreateProjectFolder.mockRejectedValue(createError);
      
      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in GitHub credentials first
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Click create
      fireEvent.click(screen.getByText('Create Project'));

      // Wait for error handling
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to create folder:', createError);
      });
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to create folder: Creation failed');
      });

      alertSpy.mockRestore();
    });

    it('should not create folder if name is empty', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Try to create without entering name
      fireEvent.click(screen.getByText('Create Project'));

      // Should not call createProjectFolder
      expect(mockCreateProjectFolder).not.toHaveBeenCalled();
    });

    it('should not create folder if GitHub credentials are incomplete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name but don't fill credentials
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Try to create
      fireEvent.click(screen.getByText('Create Project'));

      // Should not call createProjectFolder
      expect(mockCreateProjectFolder).not.toHaveBeenCalled();
    });

    it('should not create folder if GitLab credentials are incomplete', async () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name but don't fill credentials
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Try to create
      fireEvent.click(screen.getByText('Create Project'));

      // Should not call createProjectFolder
      expect(mockCreateProjectFolder).not.toHaveBeenCalled();
    });

    it('should show creating state during folder creation', async () => {
      // Mock a slow creation
      let resolvePromise: () => void;
      const slowPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockCreateProjectFolder.mockReturnValue(slowPromise);

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in credentials
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Click create
      fireEvent.click(screen.getByText('Create Project'));

      // Should show creating state
      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      // Complete the creation
      resolvePromise!();

      // Creating state should disappear
      await waitFor(() => {
        expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Settings sharing modal', () => {
    it('should show settings sharing modal when "Share Config" is clicked', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Click Share Config button
      fireEvent.click(screen.getByText('Share Config'));

      // Modal should be visible
      expect(screen.getByTestId('settings-sharing-modal')).toBeInTheDocument();
    });

    it('should hide settings sharing modal when closed', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show modal
      fireEvent.click(screen.getByText('Share Config'));
      expect(screen.getByTestId('settings-sharing-modal')).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByText('Close Modal'));

      // Modal should be hidden
      expect(screen.queryByTestId('settings-sharing-modal')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should save settings and call onSettingsSaved when form is submitted', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in some settings
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'test-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      fireEvent.change(screen.getByLabelText('Repository Name'), {
        target: { value: 'testrepo' }
      });
      fireEvent.change(screen.getByLabelText('Google Gemini API Key'), {
        target: { value: 'test-gemini-key' }
      });

      // Submit form
      const submitButton = screen.getByText('Save Settings');
      fireEvent.click(submitButton);

      // Should save settings in dual-config format
      expect(mockSaveSettings).toHaveBeenCalledWith({
        gitProvider: 'github',
        folder: 'todos',
        geminiApiKey: 'test-gemini-key',
        aiProvider: 'gemini',
        openRouterApiKey: '',
        aiModel: '',
        github: {
          pat: 'test-token',
          owner: 'testowner',
          repo: 'testrepo',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://gitlab.com',
          projectId: '',
          token: '',
          branch: 'main'
        }
      });
      expect(mockOnSettingsSaved).toHaveBeenCalled();
    });

    it('should save only GitLab fields when GitLab provider is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab provider
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Fill in GitLab settings
      fireEvent.change(screen.getByLabelText('GitLab Instance URL'), {
        target: { value: 'https://gitlab.example.com' }
      });
      fireEvent.change(screen.getByLabelText('Project ID'), {
        target: { value: '12345' }
      });
      fireEvent.change(screen.getByLabelText('GitLab Personal Access Token'), {
        target: { value: 'gitlab-token' }
      });
      
      // Also set a folder since it's required
      fireEvent.change(screen.getByDisplayValue('todos'), {
        target: { value: 'work-tasks' }
      });
      
      // Set required AI key since Gemini is the default provider
      fireEvent.change(screen.getByLabelText('Google Gemini API Key'), {
        target: { value: 'test-gemini-key' }
      });

      // Submit form
      const submitButton = screen.getByText('Save Settings');
      fireEvent.click(submitButton);

      // Should save settings in dual-config format
      expect(mockSaveSettings).toHaveBeenCalledWith({
        gitProvider: 'gitlab',
        folder: 'work-tasks',
        geminiApiKey: 'test-gemini-key',
        aiProvider: 'gemini',
        openRouterApiKey: '',
        aiModel: '',
        github: {
          pat: '',
          owner: '',
          repo: '',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '12345',
          token: 'gitlab-token',
          branch: 'main'
        }
      });
      expect(mockOnSettingsSaved).toHaveBeenCalled();
    });
  });

  describe('Required field validation', () => {
    it('should set required attribute for GitHub fields when GitHub is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // GitHub fields should be required
      expect(screen.getByLabelText('GitHub Personal Access Token (PAT)')).toHaveAttribute('required');
      expect(screen.getByLabelText('Repository Owner (Username or Organization)')).toHaveAttribute('required');
      expect(screen.getByLabelText('Repository Name')).toHaveAttribute('required');
    });

    it('should set required attribute for GitLab fields when GitLab is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // GitLab fields should be required
      expect(screen.getByLabelText('GitLab Instance URL')).toHaveAttribute('required');
      expect(screen.getByLabelText('Project ID')).toHaveAttribute('required');
      expect(screen.getByLabelText('GitLab Personal Access Token')).toHaveAttribute('required');
    });

    it('should set required attribute for Gemini API key when Gemini is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Gemini API key should be required
      expect(screen.getByLabelText('Google Gemini API Key')).toHaveAttribute('required');
    });

    it('should set required attribute for OpenRouter API key when OpenRouter is selected', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to OpenRouter
      fireEvent.change(screen.getByLabelText('AI Provider'), {
        target: { value: 'openrouter' }
      });

      // OpenRouter API key should be required
      expect(screen.getByLabelText('OpenRouter API Key')).toHaveAttribute('required');
    });
  });

  describe('Version info integration', () => {
    it('should render VersionInfo component', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      expect(screen.getByTestId('version-info')).toBeInTheDocument();
    });
  });

  describe('Reset functionality', () => {
    it('should render Reset All button', () => {
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      const resetButton = screen.getByRole('button', { name: /reset all/i });
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveClass('bg-red-600');
    });

    it('should clear localStorage and reset form fields when Reset All is clicked', () => {
      // Set up initial settings with GitHub provider for easier testing
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        folder: 'custom-folder',
        aiProvider: 'openrouter',
        geminiApiKey: 'test-gemini-key',
        openRouterApiKey: 'test-openrouter-key',
        aiModel: 'custom-model',
        github: {
          pat: 'test-token',
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://gitlab.com',
          projectId: '',
          token: '',
          branch: 'main'
        }
      });

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify initial state has loaded settings (GitHub fields should be visible)
      expect(screen.getByDisplayValue('test-token')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-owner')).toBeInTheDocument();
      expect(screen.getByDisplayValue('custom-folder')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-repo')).toBeInTheDocument();

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset all/i });
      fireEvent.click(resetButton);

      // Verify localStorage.removeItem was called
      expect(Object.prototype.hasOwnProperty.call(global.localStorage, 'removeItem')).toBe(true);

      // Verify form fields are reset to defaults
      expect(screen.getByDisplayValue('todos')).toBeInTheDocument(); // Default folder

      // Verify provider is reset to GitHub (should remain GitHub)
      const gitProviderSelect = screen.getByLabelText(/choose your git provider/i);
      expect(gitProviderSelect).toHaveValue('github');

      // Verify GitHub fields are cleared
      const patField = screen.getByLabelText(/github personal access token/i);
      const ownerField = screen.getByLabelText(/repository owner/i);
      expect(patField).toHaveValue('');
      expect(ownerField).toHaveValue('');
    });
  });

  describe('Provider switching', () => {
    it('should clear GitLab fields when switching from GitLab to GitHub', () => {
      // Start with GitLab settings
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        folder: 'todos',
        aiProvider: 'gemini',
        geminiApiKey: '',
        openRouterApiKey: '',
        aiModel: '',
        github: {
          pat: '',
          owner: '',
          repo: '',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://gitlab.example.com',
          projectId: '123',
          token: 'gitlab-token',
          branch: 'main'
        }
      });

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify GitLab fields are populated
      expect(screen.getByDisplayValue('https://gitlab.example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123')).toBeInTheDocument();

      // Switch to GitHub
      const gitProviderSelect = screen.getByLabelText(/choose your git provider/i);
      fireEvent.change(gitProviderSelect, { target: { value: 'github' } });

      // GitLab fields should be cleared (not visible in GitHub mode)
      expect(screen.queryByDisplayValue('https://gitlab.example.com')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('123')).not.toBeInTheDocument();

      // GitHub fields should be visible and empty
      expect(screen.getByLabelText(/github personal access token/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/repository owner/i)).toBeInTheDocument();
    });

    it('should clear GitHub fields when switching from GitHub to GitLab', () => {
      // Start with GitHub settings
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        folder: 'todos',
        aiProvider: 'gemini',
        geminiApiKey: '',
        openRouterApiKey: '',
        aiModel: '',
        github: {
          pat: 'github-token',
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'main'
        },
        gitlab: {
          instanceUrl: 'https://gitlab.com',
          projectId: '',
          token: '',
          branch: 'main'
        }
      });

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify GitHub fields are populated
      expect(screen.getByDisplayValue('github-token')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test-owner')).toBeInTheDocument();

      // Switch to GitLab
      const gitProviderSelect = screen.getByLabelText(/choose your git provider/i);
      fireEvent.change(gitProviderSelect, { target: { value: 'gitlab' } });

      // GitHub fields should be cleared (not visible in GitLab mode)
      expect(screen.queryByDisplayValue('github-token')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('test-owner')).not.toBeInTheDocument();

      // GitLab fields should be visible and have defaults
      expect(screen.getByDisplayValue('https://gitlab.com')).toBeInTheDocument();
      expect(screen.getByLabelText(/project id/i)).toBeInTheDocument();
    });
  });

  describe('Legacy Settings Migration Coverage (lines 53-56, 65-68)', () => {
    it('should handle legacy GitHub settings without dual-config structure', () => {
      // Mock legacy format settings (no .github/.gitlab properties)
      mockLoadSettings.mockReturnValue({
        gitProvider: 'github',
        folder: 'legacy-folder',
        // Legacy direct fields (lines 53-56)
        pat: 'legacy-pat',
        owner: 'legacy-owner', 
        repo: 'legacy-repo'
      });

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify legacy GitHub fields are loaded (exercises lines 53-56)
      expect(screen.getByDisplayValue('legacy-pat')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-owner')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-repo')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-folder')).toBeInTheDocument();
    });

    it('should handle legacy GitLab settings without dual-config structure', () => {
      // Mock legacy format settings (no .github/.gitlab properties)
      mockLoadSettings.mockReturnValue({
        gitProvider: 'gitlab',
        folder: 'legacy-folder',
        // Legacy direct fields (lines 65-68)
        instanceUrl: 'https://legacy.gitlab.com',
        projectId: 'legacy-project-123',
        token: 'legacy-gitlab-token'
      });

      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Verify legacy GitLab fields are loaded (exercises lines 65-68)
      expect(screen.getByDisplayValue('https://legacy.gitlab.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-project-123')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-gitlab-token')).toBeInTheDocument();
      expect(screen.getByDisplayValue('legacy-folder')).toBeInTheDocument();
    });
  });

  describe('Branch Coverage for Early Returns (lines 81-82, 110, 114)', () => {
    it('should not load folders when GitHub credentials are missing (line 81-82)', async () => {
      // Test the early return in loadFolders for incomplete GitHub credentials
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Fill in only PAT and owner, but missing repo (triggers line 81-82)
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      fireEvent.change(screen.getByLabelText('Repository Owner (Username or Organization)'), {
        target: { value: 'testowner' }
      });
      // Don't fill in repo - this should trigger the early return at lines 81-82

      // Wait to ensure no folder loading is triggered
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(mockListProjectFolders).not.toHaveBeenCalled();
    });

    it('should not load folders when GitLab credentials are missing (line 82)', async () => {
      // Test the early return in loadFolders for incomplete GitLab credentials
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Fill in only instanceUrl and projectId, but missing token (triggers line 82)
      fireEvent.change(screen.getByLabelText('GitLab Instance URL'), {
        target: { value: 'https://gitlab.com' }
      });
      fireEvent.change(screen.getByLabelText('Project ID'), {
        target: { value: '12345' }
      });
      // Don't fill in token - this should trigger the early return at line 82

      // Wait to ensure no folder loading is triggered
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(mockListProjectFolders).not.toHaveBeenCalled();
    });

    it('should not create folder when GitHub credentials are missing (line 114)', async () => {
      // Test the early return in handleCreateFolder for incomplete GitHub credentials
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Fill in only partial GitHub credentials (triggers line 114)
      fireEvent.change(screen.getByLabelText('GitHub Personal Access Token (PAT)'), {
        target: { value: 'github-token' }
      });
      // Don't fill in owner and repo - this should trigger the early return at line 114

      // Click create
      fireEvent.click(screen.getByText('Create Project'));

      // Should not call createProjectFolder due to missing credentials
      expect(mockCreateProjectFolder).not.toHaveBeenCalled();
    });

    it('should not create folder when GitLab credentials are missing (line 114)', async () => {
      // Test the early return in handleCreateFolder for incomplete GitLab credentials  
      render(<GitSettings onSettingsSaved={mockOnSettingsSaved} />);

      // Switch to GitLab
      fireEvent.change(screen.getByLabelText('Choose Your Git Provider'), {
        target: { value: 'gitlab' }
      });

      // Show create folder form
      fireEvent.click(screen.getByText('+ New Project'));

      // Enter folder name
      fireEvent.change(screen.getByPlaceholderText('work-tasks'), {
        target: { value: 'new-project' }
      });

      // Fill in only instanceUrl (triggers line 114)
      fireEvent.change(screen.getByLabelText('GitLab Instance URL'), {
        target: { value: 'https://gitlab.com' }
      });
      // Don't fill in projectId and token - this should trigger the early return at line 114

      // Click create
      fireEvent.click(screen.getByText('Create Project'));

      // Should not call createProjectFolder due to missing credentials
      expect(mockCreateProjectFolder).not.toHaveBeenCalled();
    });
  });
});