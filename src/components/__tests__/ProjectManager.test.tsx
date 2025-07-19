import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectManager from '../ProjectManager';
import * as localStorage from '../../utils/localStorage';
import * as gitService from '../../services/gitService';

// Mock the dependencies
vi.mock('../../utils/localStorage');
vi.mock('../../services/gitService');

const mockLoadSettings = localStorage.loadSettings as vi.MockedFunction<typeof localStorage.loadSettings>;
const mockSaveSettings = localStorage.saveSettings as vi.MockedFunction<typeof localStorage.saveSettings>;
const mockListProjectFolders = gitService.listProjectFolders as vi.MockedFunction<typeof gitService.listProjectFolders>;
const mockCreateProjectFolder = gitService.createProjectFolder as vi.MockedFunction<typeof gitService.createProjectFolder>;

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
    
    const { container } = render(
      <ProjectManager onProjectChanged={mockOnProjectChanged} />
    );

    expect(container.firstChild).toBeNull();
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
    });
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

    await waitFor(() => {
      // Should have both mobile and desktop select elements
      const selects = screen.getAllByDisplayValue('todos');
      expect(selects).toHaveLength(2); // mobile + desktop
      
      // Verify mobile select has the correct title
      const mobileSelect = selects.find(select => 
        select.getAttribute('title') === 'Switch Project'
      );
      expect(mobileSelect).toBeInTheDocument();
      
      // Verify desktop select exists
      const desktopSelect = selects.find(select => 
        !select.getAttribute('title') || select.getAttribute('title') !== 'Switch Project'
      );
      expect(desktopSelect).toBeInTheDocument();
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

    await waitFor(() => {
      // Get the first select element (mobile or desktop, both should work)
      const selects = screen.getAllByDisplayValue('todos');
      expect(selects.length).toBeGreaterThan(0);
      
      // Use the first select to test the switching functionality
      fireEvent.change(selects[0], { target: { value: 'work-tasks' } });
    });

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
    });

    // Should still show the component with default folder
    expect(screen.getAllByText('todos')[0]).toBeInTheDocument();
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

    // Check for mobile-specific elements - mobile container should exist
    const mobileContainer = document.querySelector('.md\\:hidden');
    expect(mobileContainer).toBeInTheDocument();
    
    // Check for desktop-specific elements - desktop container should exist
    const desktopContainer = document.querySelector('.hidden.md\\:flex');
    expect(desktopContainer).toBeInTheDocument();
    
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
});