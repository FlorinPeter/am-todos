import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
        pat: 'github-token',
        owner: 'testowner',
        repo: 'testrepo',
        instanceUrl: 'https://custom.gitlab.com',
        projectId: '12345',
        token: 'gitlab-token',
        folder: 'custom-folder',
        geminiApiKey: 'gemini-key',
        aiProvider: 'openrouter',
        openRouterApiKey: 'openrouter-key',
        aiModel: 'custom-model'
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

      // Should save settings and call callback
      expect(mockSaveSettings).toHaveBeenCalledWith({
        gitProvider: 'github',
        pat: 'test-token',
        owner: 'testowner',
        repo: 'testrepo',
        instanceUrl: 'https://gitlab.com',
        projectId: '',
        token: '',
        folder: 'todos',
        geminiApiKey: 'test-gemini-key',
        aiProvider: 'gemini',
        openRouterApiKey: '',
        aiModel: ''
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
});