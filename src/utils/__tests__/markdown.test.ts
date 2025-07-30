import { describe, it, expect, vi } from 'vitest';
import { parseMarkdownWithMetadata, stringifyMarkdownWithMetadata, validatePriority } from '../markdown';
import { preprocessMarkdownCheckboxes, updateContentWithCheckboxStates, CheckboxData } from '../checkboxPreprocessor';
import * as filenameMetadata from '../filenameMetadata';
import logger from '../logger';

// Mock logger
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock the filenameMetadata module
vi.mock('../filenameMetadata', () => ({
  parseFilenameMetadata: vi.fn()
}));

describe('markdown utils', () => {



  describe('parseMarkdownWithMetadata', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('New format with filename metadata', () => {
      it('should parse new format with frontmatter and filename metadata', () => {
        const filename = 'P2--2023-12-25--Christmas_Tasks.md';
        const content = `---
tags: ['holiday', 'family']
---
# Christmas Tasks
- [ ] Buy presents
- [ ] Prepare dinner`;

        vi.mocked(filenameMetadata.parseFilenameMetadata).mockReturnValue({
          date: '2023-12-25',
          priority: 2,
          title: 'Christmas_Tasks',
          displayTitle: 'Christmas Tasks',
        });

        const result = parseMarkdownWithMetadata(content, filename, false);

        expect(result).toEqual({
          title: 'Christmas Tasks',
          createdAt: '2023-12-25T00:00:00.000Z',
          priority: 2,
          isArchived: false,
          frontmatter: { tags: ['holiday', 'family'] },
          markdownContent: `# Christmas Tasks
- [ ] Buy presents
- [ ] Prepare dinner`
        });

        expect(logger.log).toHaveBeenCalledWith('parseMarkdownWithMetadata: Starting parse', { filename, isArchived: false });
        expect(logger.log).toHaveBeenCalledWith('parseMarkdownWithMetadata: Using filename metadata', {
          date: '2023-12-25',
          priority: 2,
          title: 'Christmas_Tasks',
          displayTitle: 'Christmas Tasks',
        });
      });

      it('should parse new format without frontmatter', () => {
        const filename = 'P3--2023-12-25--Simple_Task.md';
        const content = `# Simple Task
Just some content without frontmatter`;

        vi.mocked(filenameMetadata.parseFilenameMetadata).mockReturnValue({
          date: '2023-12-25',
          priority: 3,
          title: 'Simple_Task',
          displayTitle: 'Simple Task',
        });

        const result = parseMarkdownWithMetadata(content, filename, true);

        expect(result).toEqual({
          title: 'Simple Task',
          createdAt: '2023-12-25T00:00:00.000Z',
          priority: 3,
          isArchived: true,
          frontmatter: { tags: [] },
          markdownContent: content
        });
      });

      it('should handle YAML parsing errors in new format', () => {
        const filename = 'P1--2023-12-25--Invalid_YAML.md';
        const content = `---
invalid: yaml: content: [
---
# Content after invalid YAML`;

        vi.mocked(filenameMetadata.parseFilenameMetadata).mockReturnValue({
          date: '2023-12-25',
          priority: 1,
          title: 'Invalid_YAML',
          displayTitle: 'Invalid YAML',
        });

        const result = parseMarkdownWithMetadata(content, filename, false);

        expect(result).toEqual({
          title: 'Invalid YAML',
          createdAt: '2023-12-25T00:00:00.000Z',
          priority: 1,
          isArchived: false,
          frontmatter: { tags: [] },
          markdownContent: content
        });

        // Mock logger.error to check if it was called (similar to existing test pattern)
        const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
        
        // Re-run the function to trigger the error with the spy in place
        parseMarkdownWithMetadata(content, filename, false);
        
        expect(loggerSpy).toHaveBeenCalledWith('Error parsing YAML frontmatter:', expect.any(Error));
        loggerSpy.mockRestore();
      });

      it('should handle non-array tags in frontmatter', () => {
        const filename = 'P2--2023-12-25--Bad_Tags.md';
        const content = `---
tags: 'single-tag'
---
# Content`;

        vi.mocked(filenameMetadata.parseFilenameMetadata).mockReturnValue({
          date: '2023-12-25',
          priority: 2,
          title: 'Bad_Tags',
          displayTitle: 'Bad Tags',
        });

        const result = parseMarkdownWithMetadata(content, filename, false);

        expect(result.frontmatter).toEqual({ tags: [] });
      });
    });


    describe('Non-matching format handling', () => {
      it('should return null for unknown formats', () => {
        const filename = 'unknown-format.md';
        const content = `---
title: 'Fallback Task'
createdAt: '2023-12-25T12:00:00.000Z'
priority: 2
---
# Fallback content`;

        vi.mocked(filenameMetadata.parseFilenameMetadata).mockReturnValue(null);

        const result = parseMarkdownWithMetadata(content, filename, false);

        expect(result).toBeNull();

        expect(logger.log).toHaveBeenCalledWith('parseMarkdownWithMetadata: File does not match new format, ignoring', filename);
      });
    });
  });

  describe('stringifyMarkdownWithMetadata', () => {
    it('should generate markdown with frontmatter', () => {
      const frontmatter = { tags: ['work', 'urgent'] };
      const markdownContent = '# Task content\n- [ ] Complete task';

      const result = stringifyMarkdownWithMetadata(frontmatter, markdownContent);

      expect(result).toBe(`---
tags:
  - work
  - urgent
---
# Task content
- [ ] Complete task`);
    });

    it('should handle empty frontmatter', () => {
      const frontmatter = { tags: [] };
      const markdownContent = '# Simple task';

      const result = stringifyMarkdownWithMetadata(frontmatter, markdownContent);

      expect(result).toBe(`---
tags: []
---
# Simple task`);
    });

    it('should handle empty content', () => {
      const frontmatter = { tags: ['test'] };
      const markdownContent = '';

      const result = stringifyMarkdownWithMetadata(frontmatter, markdownContent);

      expect(result).toBe(`---
tags:
  - test
---
`);
    });
  });

  describe('Priority Validation Coverage (lines 20-22)', () => {
    it('should handle invalid priority values and log warning', () => {
      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      
      // Test values outside range 1-5
      expect(validatePriority(0)).toBe(3);
      expect(validatePriority(6)).toBe(3);
      expect(validatePriority(-1)).toBe(3);
      expect(validatePriority(10)).toBe(3);
      
      // Test non-integer values
      expect(validatePriority(2.5)).toBe(3);
      expect(validatePriority(3.7)).toBe(3);
      
      // Verify warning messages were logged (lines 20-21)
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value 0 out of range (1-5), defaulting to 3');
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value 6 out of range (1-5), defaulting to 3');
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value -1 out of range (1-5), defaulting to 3');
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value 10 out of range (1-5), defaulting to 3');
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value 2.5 out of range (1-5), defaulting to 3');
      expect(loggerWarnSpy).toHaveBeenCalledWith('Priority value 3.7 out of range (1-5), defaulting to 3');
      
      loggerWarnSpy.mockRestore();
    });

    it('should parse valid string numbers to cover lines 15-16', () => {
      // Test string numbers that can be parsed successfully (hits lines 15-16)
      expect(validatePriority('1')).toBe(1);
      expect(validatePriority('3')).toBe(3);
      expect(validatePriority('5')).toBe(5);
      expect(validatePriority(' 2 ')).toBe(2); // With whitespace, parseInt handles it
    });
  });


  describe('Checkbox Preprocessor', () => {
    describe('preprocessMarkdownCheckboxes', () => {
      it('should handle empty or invalid content', () => {
        expect(preprocessMarkdownCheckboxes('')).toEqual({
          processedContent: '',
          checkboxRegistry: []
        });
        
        expect(preprocessMarkdownCheckboxes(null as any)).toEqual({
          processedContent: '',
          checkboxRegistry: []
        });
        
        expect(preprocessMarkdownCheckboxes(undefined as any)).toEqual({
          processedContent: '',
          checkboxRegistry: []
        });
        
        expect(preprocessMarkdownCheckboxes(123 as any)).toEqual({
          processedContent: '',
          checkboxRegistry: []
        });
      });

      it('should process basic checkbox syntax', () => {
        const content = `# Task List
- [ ] Unchecked task
- [x] Checked task  
- [X] Checked task uppercase`;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.checkboxRegistry).toHaveLength(3);
        expect(result.checkboxRegistry[0]).toEqual({
          line: 1,
          char: 2,
          content: 'Unchecked task',
          isChecked: false,
          cleanContent: 'unchecked task'
        });
        expect(result.checkboxRegistry[1]).toEqual({
          line: 2,
          char: 2,
          content: 'Checked task',
          isChecked: true,
          cleanContent: 'checked task'
        });
        expect(result.checkboxRegistry[2]).toEqual({
          line: 3,
          char: 2,
          content: 'Checked task uppercase',
          isChecked: true,
          cleanContent: 'checked task uppercase'
        });
      });

      it('should handle complex checkbox content with special characters', () => {
        const content = `- [ ] Task with "quotes" and symbols @#$%
- [x] Task with <html> tags & ampersands
- [ ] Task with multiple    spaces
- [X] Task with punctuation: commas, periods. etc!`;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.checkboxRegistry).toHaveLength(4);
        expect(result.checkboxRegistry[0].cleanContent).toBe('task with quotes and symbols');
        // The regex removes non-word and non-space characters, resulting in double spaces
        expect(result.checkboxRegistry[1].cleanContent).toBe('task with html tags  ampersands');
        // Multiple spaces are preserved in cleanContent
        expect(result.checkboxRegistry[2].cleanContent).toBe('task with multiple    spaces');
        expect(result.checkboxRegistry[3].cleanContent).toBe('task with punctuation commas periods etc');
      });

      it('should handle mixed content with and without checkboxes', () => {
        const content = `# Header
Regular paragraph text
- [ ] First checkbox
More text here
- [x] Second checkbox
- Regular bullet point (no checkbox)
- [ ] Third checkbox`;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.checkboxRegistry).toHaveLength(3);
        expect(result.processedContent).toContain('XCHECKBOXX0XENDX');
        expect(result.processedContent).toContain('XCHECKBOXX1XENDX');
        expect(result.processedContent).toContain('XCHECKBOXX2XENDX');
        expect(result.processedContent).toContain('- Regular bullet point (no checkbox)');
      });

      it('should handle indented checkboxes with different spacing', () => {
        const content = `  - [ ] Indented with 2 spaces
    - [x] Indented with 4 spaces
\t- [ ] Indented with tab
- [ ] No indentation`;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.checkboxRegistry).toHaveLength(4);
        expect(result.checkboxRegistry[0].char).toBe(4); // 2 spaces + "- "
        expect(result.checkboxRegistry[1].char).toBe(6); // 4 spaces + "- "
        expect(result.checkboxRegistry[2].char).toBe(3); // tab + "- "
        expect(result.checkboxRegistry[3].char).toBe(2); // "- "
      });

      it('should create unique tokens for each checkbox', () => {
        const content = `- [ ] First
- [ ] Second
- [ ] Third`;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.processedContent).toContain('XCHECKBOXX0XENDX');
        expect(result.processedContent).toContain('XCHECKBOXX1XENDX');
        expect(result.processedContent).toContain('XCHECKBOXX2XENDX');
      });

      it('should handle empty checkbox content', () => {
        const content = `- [ ] 
- [x]
- [ ]   `;

        const result = preprocessMarkdownCheckboxes(content);

        expect(result.checkboxRegistry).toHaveLength(3);
        expect(result.checkboxRegistry[0].content).toBe('');
        expect(result.checkboxRegistry[1].content).toBe('');
        expect(result.checkboxRegistry[2].content).toBe('');
      });
    });

    describe('updateContentWithCheckboxStates', () => {
      it('should handle empty or invalid content', () => {
        const registry: CheckboxData[] = [];
        
        expect(updateContentWithCheckboxStates('', registry)).toBe('');
        expect(updateContentWithCheckboxStates(null as any, registry)).toBe('');
        expect(updateContentWithCheckboxStates(undefined as any, registry)).toBe('');
        expect(updateContentWithCheckboxStates(123 as any, registry)).toBe('');
      });

      it('should update checkbox states based on registry', () => {
        const originalContent = `# Tasks
- [ ] Task 1
- [x] Task 2
- [ ] Task 3`;

        const registry: CheckboxData[] = [
          { line: 1, char: 2, content: 'Task 1', isChecked: true, cleanContent: 'task 1' },
          { line: 2, char: 2, content: 'Task 2', isChecked: false, cleanContent: 'task 2' },
          { line: 3, char: 2, content: 'Task 3', isChecked: true, cleanContent: 'task 3' }
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`# Tasks
- [x] Task 1
- [ ] Task 2
- [x] Task 3`);
      });

      it('should handle registry entries with invalid line numbers', () => {
        const originalContent = `- [ ] Valid task`;

        const registry: CheckboxData[] = [
          { line: 0, char: 2, content: 'Valid task', isChecked: true, cleanContent: 'valid task' },
          { line: 5, char: 2, content: 'Invalid line', isChecked: true, cleanContent: 'invalid line' }, // Out of bounds
          { line: -1, char: 2, content: 'Negative line', isChecked: true, cleanContent: 'negative line' } // Negative index
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`- [x] Valid task`);
      });

      it('should handle registry entries with invalid character positions', () => {
        const originalContent = `- [ ] Test task`;

        const registry: CheckboxData[] = [
          { line: 0, char: -5, content: 'Test task', isChecked: true, cleanContent: 'test task' }, // Negative char
          { line: 0, char: 1000, content: 'Test task', isChecked: true, cleanContent: 'test task' } // Out of bounds char
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`- [x] Test task`); // Should still update since char check is >= 0
      });

      it('should handle lines that do not match checkbox pattern', () => {
        const originalContent = `# Header
Regular text
- [ ] Valid checkbox`;

        const registry: CheckboxData[] = [
          { line: 0, char: 0, content: 'Header', isChecked: true, cleanContent: 'header' }, // Not a checkbox line
          { line: 1, char: 0, content: 'Regular text', isChecked: true, cleanContent: 'regular text' }, // Not a checkbox line  
          { line: 2, char: 2, content: 'Valid checkbox', isChecked: true, cleanContent: 'valid checkbox' }
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`# Header
Regular text
- [x] Valid checkbox`);
      });

      it('should preserve original formatting and indentation', () => {
        const originalContent = `  - [ ] Indented task
    - [x] More indented
\t- [ ] Tab indented`;

        const registry: CheckboxData[] = [
          { line: 0, char: 4, content: 'Indented task', isChecked: true, cleanContent: 'indented task' },
          { line: 1, char: 6, content: 'More indented', isChecked: false, cleanContent: 'more indented' },
          { line: 2, char: 3, content: 'Tab indented', isChecked: true, cleanContent: 'tab indented' }
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`  - [x] Indented task
    - [ ] More indented
\t- [x] Tab indented`);
      });

      it('should handle both uppercase and lowercase checkbox states correctly', () => {
        const originalContent = `- [ ] Task 1
- [X] Task 2`;

        const registry: CheckboxData[] = [
          { line: 0, char: 2, content: 'Task 1', isChecked: true, cleanContent: 'task 1' },
          { line: 1, char: 2, content: 'Task 2', isChecked: false, cleanContent: 'task 2' }
        ];

        const result = updateContentWithCheckboxStates(originalContent, registry);

        expect(result).toBe(`- [x] Task 1
- [ ] Task 2`);
      });

      it('should handle empty registry gracefully', () => {
        const originalContent = `- [ ] Task 1
- [x] Task 2`;

        const result = updateContentWithCheckboxStates(originalContent, []);

        expect(result).toBe(originalContent); // Should remain unchanged
      });
    });

    describe('Integration: Full preprocessing and updating workflow', () => {
      it('should maintain consistency through preprocess -> update cycle', () => {
        const originalContent = `# Project Tasks
- [ ] Setup database
- [x] Create user interface
- [ ] Write tests
- [x] Deploy to production`;

        // Preprocess the content
        const preprocessResult = preprocessMarkdownCheckboxes(originalContent);
        
        // Modify some checkbox states
        preprocessResult.checkboxRegistry[0].isChecked = true; // Setup database -> checked
        preprocessResult.checkboxRegistry[2].isChecked = true; // Write tests -> checked

        // Update the content with new states
        const updatedContent = updateContentWithCheckboxStates(originalContent, preprocessResult.checkboxRegistry);

        expect(updatedContent).toBe(`# Project Tasks
- [x] Setup database
- [x] Create user interface
- [x] Write tests
- [x] Deploy to production`);
      });

      it('should handle complex mixed content with edge cases', () => {
        const originalContent = `# Complex Document

## Regular Section
This is a paragraph with no checkboxes.

### Task Section
- [ ] Task with "quotes" and symbols @#$%
  - [ ] Nested task (indented)
- [x] Completed task
- Regular bullet point
- [ ] Another task

## More Content
Another paragraph here.

- [X] Final task with uppercase X`;

        const preprocessResult = preprocessMarkdownCheckboxes(originalContent);
        
        // Counting manually: line 6, 7, 8, 10, 15 = 5 checkboxes total
        expect(preprocessResult.checkboxRegistry).toHaveLength(5);
        
        // Toggle all states
        preprocessResult.checkboxRegistry.forEach(checkbox => {
          checkbox.isChecked = !checkbox.isChecked;
        });

        const updatedContent = updateContentWithCheckboxStates(originalContent, preprocessResult.checkboxRegistry);

        // Verify the non-checkbox content is preserved and checkbox states are toggled
        expect(updatedContent).toContain('# Complex Document');
        expect(updatedContent).toContain('## Regular Section');
        expect(updatedContent).toContain('This is a paragraph with no checkboxes.');
        expect(updatedContent).toContain('- Regular bullet point');
        expect(updatedContent).toContain('## More Content');
        expect(updatedContent).toContain('Another paragraph here.');
        
        // Verify checkbox states were toggled
        expect(updatedContent).toContain('- [x] Task with "quotes" and symbols @#$%');
        expect(updatedContent).toContain('  - [x] Nested task (indented)');
        expect(updatedContent).toContain('- [ ] Completed task');
        expect(updatedContent).toContain('- [x] Another task');
        expect(updatedContent).toContain('- [ ] Final task with uppercase X');
      });
    });
  });

});