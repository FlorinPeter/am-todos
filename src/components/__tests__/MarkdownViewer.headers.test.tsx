import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MarkdownViewer from '../MarkdownViewer';

// Mock logger to avoid console output during tests
vi.mock('../../utils/logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock services that MarkdownViewer uses
vi.mock('../../services/aiService', () => ({
  processChatMessage: vi.fn().mockResolvedValue('Updated content')
}));

describe('MarkdownViewer - Header Components Coverage', () => {
  const defaultProps = {
    content: '',
    chatHistory: [],
    onMarkdownChange: vi.fn(),
    onChatHistoryChange: vi.fn(),
    filePath: '/test/path.md',
    taskId: 'task-123',
    todoId: 'todo-123'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('H5 Header Component Coverage', () => {
    it('should render H5 headers with correct styling', () => {
      const contentWithH5 = `# Main Title

## Subtitle

### Section

#### Subsection

##### H5 Header One
This is content under H5 header one.

##### H5 Header Two
This is content under H5 header two.

Some more content here.`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={contentWithH5}
        />
      );

      // Check that H5 headers are rendered with correct text
      expect(screen.getByText('H5 Header One')).toBeInTheDocument();
      expect(screen.getByText('H5 Header Two')).toBeInTheDocument();

      // Verify the H5 elements have the correct styling classes
      const h5Elements = screen.getAllByRole('heading', { level: 5 });
      expect(h5Elements).toHaveLength(2);
      
      h5Elements.forEach(h5 => {
        expect(h5).toHaveClass('text-base', 'font-medium', 'mb-1', 'text-white');
      });
    });

    it('should handle multiple H5 headers in complex markdown', () => {
      const complexContent = `# Document Title

Some intro content.

## Main Section

### Subsection A

#### Detail Section

##### Important Note
This is an important note.

##### Warning
This is a warning message.

### Subsection B

##### Configuration
Configuration details here.

## Another Section

##### Final Notes
Final notes here.`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={complexContent}
        />
      );

      // Check all H5 headers are present
      expect(screen.getByText('Important Note')).toBeInTheDocument();
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('Configuration')).toBeInTheDocument();
      expect(screen.getByText('Final Notes')).toBeInTheDocument();

      // Verify we have 4 H5 elements
      const h5Elements = screen.getAllByRole('heading', { level: 5 });
      expect(h5Elements).toHaveLength(4);
    });
  });

  describe('H6 Header Component Coverage', () => {
    it('should render H6 headers with correct styling', () => {
      const contentWithH6 = `# Main Title

## Subtitle

### Section

#### Subsection

##### Sub-subsection

###### H6 Header One
This is content under H6 header one.

###### H6 Header Two
This is content under H6 header two.

Some more content here.`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={contentWithH6}
        />
      );

      // Check that H6 headers are rendered with correct text
      expect(screen.getByText('H6 Header One')).toBeInTheDocument();
      expect(screen.getByText('H6 Header Two')).toBeInTheDocument();

      // Verify the H6 elements have the correct styling classes
      const h6Elements = screen.getAllByRole('heading', { level: 6 });
      expect(h6Elements).toHaveLength(2);
      
      h6Elements.forEach(h6 => {
        expect(h6).toHaveClass('text-sm', 'font-medium', 'mb-1', 'text-white');
      });
    });

    it('should handle nested H6 headers in complex document structure', () => {
      const nestedContent = `# API Documentation

## Authentication

### OAuth 2.0

#### Scopes

##### Required Scopes

###### Read Access
Description of read access scope.

###### Write Access
Description of write access scope.

##### Optional Scopes

###### Admin Access
Description of admin access scope.

## Endpoints

### User Management

#### User Profile

##### Profile Fields

###### Basic Information
Basic profile information fields.

###### Advanced Settings
Advanced profile settings.`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={nestedContent}
        />
      );

      // Check all H6 headers are present
      expect(screen.getByText('Read Access')).toBeInTheDocument();
      expect(screen.getByText('Write Access')).toBeInTheDocument();
      expect(screen.getByText('Admin Access')).toBeInTheDocument();
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();

      // Verify we have 5 H6 elements
      const h6Elements = screen.getAllByRole('heading', { level: 6 });
      expect(h6Elements).toHaveLength(5);
    });

    it('should handle mixed H5 and H6 headers correctly', () => {
      const mixedContent = `# Main Document

## Section One

### Detailed Analysis

#### Key Points

##### Important Considerations
These are important considerations.

###### Security Notes
Security considerations here.

###### Performance Notes  
Performance considerations here.

##### Implementation Details
Implementation details here.

###### Code Examples
Code examples here.

###### Best Practices
Best practices here.`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={mixedContent}
        />
      );

      // Verify H5 headers
      const h5Elements = screen.getAllByRole('heading', { level: 5 });
      expect(h5Elements).toHaveLength(2);
      expect(screen.getByText('Important Considerations')).toBeInTheDocument();
      expect(screen.getByText('Implementation Details')).toBeInTheDocument();

      // Verify H6 headers
      const h6Elements = screen.getAllByRole('heading', { level: 6 });
      expect(h6Elements).toHaveLength(4);
      expect(screen.getByText('Security Notes')).toBeInTheDocument();
      expect(screen.getByText('Performance Notes')).toBeInTheDocument();
      expect(screen.getByText('Code Examples')).toBeInTheDocument();
      expect(screen.getByText('Best Practices')).toBeInTheDocument();
    });
  });

  describe('Header Styling Consistency', () => {
    it('should apply consistent styling across all header levels', () => {
      const allHeadersContent = `# H1 Header
## H2 Header  
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={allHeadersContent}
        />
      );

      // Verify H5 styling
      const h5Element = screen.getByRole('heading', { level: 5 });
      expect(h5Element).toHaveClass('text-base', 'font-medium', 'mb-1', 'text-white');

      // Verify H6 styling
      const h6Element = screen.getByRole('heading', { level: 6 });
      expect(h6Element).toHaveClass('text-sm', 'font-medium', 'mb-1', 'text-white');

      // Ensure both have white text for dark theme consistency
      expect(h5Element).toHaveClass('text-white');
      expect(h6Element).toHaveClass('text-white');
    });

    it('should handle edge cases with empty headers', () => {
      const edgeCaseContent = `##### 
###### 
##### Valid H5 Header
###### Valid H6 Header`;

      render(
        <MarkdownViewer
          {...defaultProps}
          content={edgeCaseContent}
        />
      );

      // Should still render headers even if some are empty
      const allHeaders = screen.getAllByRole('heading');
      expect(allHeaders.length).toBeGreaterThanOrEqual(2);
      
      // Valid headers should be present
      expect(screen.getByText('Valid H5 Header')).toBeInTheDocument();
      expect(screen.getByText('Valid H6 Header')).toBeInTheDocument();
    });
  });
});