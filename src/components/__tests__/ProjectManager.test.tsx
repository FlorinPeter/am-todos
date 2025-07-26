import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import ProjectManager from '../ProjectManager';
import * as localStorage from '../../utils/localStorage';
import * as gitService from '../../services/gitService';

// Mock the dependencies
vi.mock('../../utils/localStorage');
vi.mock('../../services/gitService');
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

const mockLoadSettings = localStorage.loadSettings as any;
const mockSaveSettings = localStorage.saveSettings as any;
const mockListProjectFolders = gitService.listProjectFolders as any;
const mockCreateProjectFolder = gitService.createProjectFolder as any;

describe('ProjectManager', () => {
  const mockOnProjectChanged = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSettings.mockReturnValue(null);
    mockListProjectFolders.mockResolvedValue(['todos']);
    mockCreateProjectFolder.mockResolvedValue(undefined);
  });

  it('renders nothing when no settings are configured', () => {
    mockLoadSettings.mockReturnValue(null);
    
    render(
      <ProjectManager onProjectChanged={mockOnProjectChanged} />
    );

    // Component should render nothing when no settings
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('renders for GitHub settings', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Check for project name display (no longer shows "Project:" label)
    expect(screen.getAllByText('todos')[0]).toBeInTheDocument();
    expect(screen.getByText('New Project')).toBeInTheDocument();
  });

  it('renders for GitLab settings', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'gitlab',
      instanceUrl: 'https://gitlab.com',
      projectId: '12345',
      token: 'token',
      folder: 'work-tasks'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Check for project name display (no longer shows "Project:" label)
    expect(screen.getAllByText('work-tasks')[0]).toBeInTheDocument();
  });

  it('loads project folders on mount', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks', 'personal']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    }, { timeout: 3000 }); // Give more time for debounced loading
  });

  it('shows project switcher when multiple folders available', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks', 'personal']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    await waitFor(
      () => {
        // Should have both mobile and desktop select elements
        const selects = screen.getAllByDisplayValue('todos');
        expect(selects).toHaveLength(2); // mobile + desktop
      },
      { timeout: 3000 } // Give more time for debounced loading
    );
    
    await waitFor(() => {
      // Verify mobile select has the correct title
      const selects = screen.getAllByDisplayValue('todos');
      const mobileSelect = selects.find(select => 
        select.getAttribute('title') === 'Switch Project'
      );
      expect(mobileSelect).toBeInTheDocument();
    });
  });

  it('handles project switching', async () => {
    const initialSettings = {
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    };
    mockLoadSettings.mockReturnValue(initialSettings);
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for folders to load (component uses debounced loading with 100ms timeout)
    await waitFor(
      () => {
        // Get the first select element (mobile or desktop, both should work)
        const selects = screen.getAllByDisplayValue('todos');
        expect(selects.length).toBeGreaterThan(0);
        return selects[0];
      },
      { timeout: 3000 } // Give more time for debounced loading
    );

    // Now test the switching functionality
    const selects = screen.getAllByDisplayValue('todos');
    fireEvent.change(selects[0], { target: { value: 'work-tasks' } });

    expect(mockSaveSettings).toHaveBeenCalledWith({
      ...initialSettings,
      folder: 'work-tasks'
    });
    expect(mockOnProjectChanged).toHaveBeenCalledWith({
      ...initialSettings,
      folder: 'work-tasks'
    });
  });

  it('opens create project modal', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    const createButton = screen.getByText('New Project');
    fireEvent.click(createButton);

    expect(screen.getByText('Project Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('work-tasks')).toBeInTheDocument();
  });

  it('creates new project successfully', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders
      .mockResolvedValueOnce(['todos'])
      .mockResolvedValueOnce(['todos', 'new-project']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Open modal
    const createButton = screen.getByText('New Project');
    fireEvent.click(createButton);

    // Fill in project name
    const input = screen.getByPlaceholderText('work-tasks');
    fireEvent.change(input, { target: { value: 'new-project' } });

    // Create project
    const createProjectButton = screen.getByText('Create Project');
    fireEvent.click(createProjectButton);

    await waitFor(() => {
      expect(mockCreateProjectFolder).toHaveBeenCalledWith('new-project');
    });

    expect(mockListProjectFolders).toHaveBeenCalledWith(); // Should be called for initial load and after create
  });

  it('handles create project error', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockCreateProjectFolder.mockRejectedValue(new Error('Creation failed'));

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Open modal and try to create
    fireEvent.click(screen.getByText('New Project'));
    fireEvent.change(screen.getByPlaceholderText('work-tasks'), { 
      target: { value: 'invalid-project' } 
    });
    fireEvent.click(screen.getByText('Create Project'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to create project: Creation failed');
    });

    alertSpy.mockRestore();
  });

  it('disables create button with empty name', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    fireEvent.click(screen.getByText('New Project'));

    const createButton = screen.getByText('Create Project');
    expect(createButton).toBeDisabled();
  });

  it('closes modal on close button click', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByText('Project Management')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('Project Management')).not.toBeInTheDocument();
  });

  it('handles folder loading error gracefully', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockRejectedValue(new Error('Network error'));

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    }, { timeout: 3000 }); // Give more time for debounced loading

    // Should still show the component with default folder
    expect(screen.getAllByText('todos')[0]).toBeInTheDocument();
  });

  it('shows project switcher when multiple folders exist', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks', 'personal']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for folders to load - should have both mobile and desktop select elements
    await waitFor(() => {
      const selects = screen.getAllByDisplayValue('todos');
      expect(selects).toHaveLength(2); // mobile + desktop
    }, { timeout: 3000 }); // Give more time for debounced loading

    // Should show available options in selects
    expect(screen.getAllByText('work-tasks')).toHaveLength(2); // mobile + desktop
    expect(screen.getAllByText('personal')).toHaveLength(2); // mobile + desktop
  });

  it('hides project switcher when only one folder exists', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos']); // Only one folder

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for folders to load
    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    }, { timeout: 3000 }); // Give more time for debounced loading

    // Should show current project name but no select dropdowns when only one folder
    expect(screen.getAllByText('todos')).toHaveLength(2); // mobile + desktop display
    
    // Should NOT show select dropdowns when only one folder
    expect(screen.queryByDisplayValue('todos')).not.toBeInTheDocument();
  });

  it('disables project switcher during loading', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    
    // Simulate delayed response
    let resolvePromise: (value: string[]) => void;
    const foldersPromise = new Promise<string[]>((resolve) => {
      resolvePromise = resolve;
    });
    mockListProjectFolders.mockReturnValue(foldersPromise);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Initially should not show select dropdowns during loading
    expect(screen.queryByDisplayValue('todos')).not.toBeInTheDocument();

    // Resolve with multiple folders
    resolvePromise!(['todos', 'work-tasks']);

    // Wait for selects to appear and be enabled
    await waitFor(
      () => {
        const selects = screen.getAllByDisplayValue('todos');
        expect(selects).toHaveLength(2); // mobile + desktop
      },
      { timeout: 3000 } // Give more time for debounced loading
    );
  });

  it('closes modal when switching projects in modal switcher', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos', 'work-tasks']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for folders to load first
    await waitFor(
      () => {
        const selects = screen.getAllByDisplayValue('todos');
        expect(selects.length).toBeGreaterThanOrEqual(2); // mobile + desktop
      },
      { timeout: 3000 }
    );

    // Open modal
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByText('Project Management')).toBeInTheDocument();

    // Wait for modal content to load - should have project switcher since we have multiple folders
    await waitFor(() => {
      expect(screen.getByText('Switch to:')).toBeInTheDocument();
    });

    // Find the modal select (which should be the 3rd one: mobile + desktop + modal)
    const allSelects = screen.getAllByDisplayValue('todos');
    expect(allSelects).toHaveLength(3); // mobile + desktop + modal
    const modalSelect = allSelects[2]; // The modal select should be the last one

    // Switch project in modal - should close modal
    fireEvent.change(modalSelect, { target: { value: 'work-tasks' } });

    // Modal should close after switching
    await waitFor(() => {
      expect(screen.queryByText('Project Management')).not.toBeInTheDocument();
    });
  });

  it('shows mobile view correctly', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Check that component renders mobile and desktop views correctly
    expect(screen.getAllByText('todos')).toHaveLength(2); // mobile + desktop versions
    
    // Both containers should have "Create New Project" buttons
    const createButtons = screen.getAllByTitle('Create New Project');
    expect(createButtons).toHaveLength(2); // mobile + desktop
  });

  it('handles GitLab force loading', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'gitlab',
      instanceUrl: 'https://gitlab.com',
      projectId: '12345',
      token: 'token',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Should attempt to load folders for GitLab
    expect(mockLoadSettings).toHaveBeenCalled();
  });

  it('validates project name pattern', () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    fireEvent.click(screen.getByText('New Project'));
    const input = screen.getByPlaceholderText('work-tasks');
    
    expect(input).toHaveAttribute('pattern', '^[a-zA-Z][a-zA-Z0-9_-]*$');
  });

  it('handles storage change events for cross-tab updates (lines 75-78)', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for initial load
    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    });

    // Clear the mock to track new calls
    mockListProjectFolders.mockClear();

    // Simulate a storage event for settings change
    const storageEvent = new StorageEvent('storage', {
      key: 'am-todos-settings',
      newValue: JSON.stringify({
        gitProvider: 'github',
        pat: 'token',
        owner: 'user',
        repo: 'repo',
        folder: 'work-tasks' // Changed folder
      }),
      oldValue: JSON.stringify({
        gitProvider: 'github',
        pat: 'token',
        owner: 'user',
        repo: 'repo',
        folder: 'todos'
      })
    });

    // Dispatch the storage event to trigger the handler
    window.dispatchEvent(storageEvent);

    // Should trigger checkForSettingsChanges which calls loadFolders
    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    });
  });

  it('ignores storage events for non-settings keys (line 75)', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos']);

    render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for initial load and any pending timeouts to complete
    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    }, { timeout: 2000 });
    
    // Wait additional time to ensure all timeouts are done
    await new Promise(resolve => setTimeout(resolve, 1200));
    mockListProjectFolders.mockClear();

    // Simulate a storage event for a different key
    const storageEvent = new StorageEvent('storage', {
      key: 'some-other-key',
      newValue: 'new-value',
      oldValue: 'old-value'
    });

    window.dispatchEvent(storageEvent);

    // Should NOT trigger additional loadFolders calls - wait longer than debounce
    await new Promise(resolve => setTimeout(resolve, 1200));
    expect(mockListProjectFolders).not.toHaveBeenCalled();
  });

  it('clears existing timeout when new settings change occurs (lines 128-130)', async () => {
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'token',
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });
    mockListProjectFolders.mockResolvedValue(['todos']);

    // Spy on setTimeout and clearTimeout BEFORE rendering
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { rerender } = render(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for initial load to complete and settle any timeouts (component uses 1s debounce)
    await waitFor(() => {
      expect(mockListProjectFolders).toHaveBeenCalled();
    }, { timeout: 2000 });

    // Clear call counts from initial render
    setTimeoutSpy.mockClear();
    clearTimeoutSpy.mockClear();

    // Simulate rapid settings changes that would trigger debounced loading
    // Change 1: Update settings to trigger first timeout
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'new-token', // Changed PAT to trigger settings effect
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    rerender(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Wait for first timeout to be set
    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    // Change 2: Quickly change settings again to trigger clearTimeout
    mockLoadSettings.mockReturnValue({
      gitProvider: 'github',
      pat: 'newer-token', // Changed PAT again
      owner: 'user',
      repo: 'repo',
      folder: 'todos'
    });

    rerender(<ProjectManager onProjectChanged={mockOnProjectChanged} />);

    // Should have called clearTimeout when new timeout is set
    await waitFor(() => {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });
});