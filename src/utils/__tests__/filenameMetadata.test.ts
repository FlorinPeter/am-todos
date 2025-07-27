/**
 * Comprehensive tests for filenameMetadata.ts
 * Target: 100% coverage across all functions and branches
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseFilenameMetadata,
  generateFilename,
  isNewFormatFilename,
  isLegacyFormatFilename,
  extractDateFromLegacyFilename,
  extractTitleFromLegacyFilename,
  parseLegacyFilenameMetadata,
  convertLegacyToNewFormat
} from '../filenameMetadata';

// Mock logger to avoid console output during tests
vi.mock('../logger', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('filenameMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('parseFilenameMetadata', () => {
    it('should parse valid new format filename', () => {
      const filename = 'P1--2025-07-24--Deploy_Web_Application.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 1,
        date: '2025-07-24',
        title: 'Deploy_Web_Application',
        displayTitle: 'Deploy Web Application'
      });
    });

    it('should parse filename with path components', () => {
      const filename = 'folder/subfolder/P2--2025-07-23--Update_Documentation.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 2,
        date: '2025-07-23',
        title: 'Update_Documentation',
        displayTitle: 'Update Documentation'
      });
    });

    it('should handle all priority levels (1-5)', () => {
      const priorities = [1, 2, 3, 4, 5];
      
      priorities.forEach(priority => {
        const filename = `P${priority}--2025-07-24--Test_Task.md`;
        const result = parseFilenameMetadata(filename);
        
        expect(result).toEqual({
          priority,
          date: '2025-07-24',
          title: 'Test_Task',
          displayTitle: 'Test Task'
        });
      });
    });

    it('should handle title with multiple underscores', () => {
      const filename = 'P3--2025-07-24--Complex_Title_With_Many_Words.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 3,
        date: '2025-07-24',
        title: 'Complex_Title_With_Many_Words',
        displayTitle: 'Complex Title With Many Words'
      });
    });

    it('should return null for invalid format - wrong priority', () => {
      const filename = 'P6--2025-07-24--Invalid_Priority.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid format - wrong date format', () => {
      const filename = 'P1--25-07-24--Invalid_Date.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid format - missing components', () => {
      const filename = 'P1--2025-07-24.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toBeNull();
    });

    it('should return null for invalid format - wrong extension', () => {
      const filename = 'P1--2025-07-24--Test_Task.txt';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toBeNull();
    });

    it('should return null for completely invalid filename', () => {
      const filename = 'random-filename.md';
      const result = parseFilenameMetadata(filename);
      
      expect(result).toBeNull();
    });

    it('should handle empty filename', () => {
      const result = parseFilenameMetadata('');
      expect(result).toBeNull();
    });

    it('should handle filename with only path separator', () => {
      const result = parseFilenameMetadata('/');
      expect(result).toBeNull();
    });
  });

  describe('generateFilename', () => {
    beforeEach(() => {
      // Mock Date to ensure consistent testing
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-07-24T12:00:00.000Z');
    });

    it('should generate valid filename with correct inputs', () => {
      const result = generateFilename(1, '2025-07-24', 'Deploy Web Application');
      expect(result).toBe('P1--2025-07-24--Deploy_Web_Application.md');
    });

    it('should normalize title with special characters', () => {
      const result = generateFilename(2, '2025-07-24', 'Fix bugs & issues (urgent)!');
      expect(result).toBe('P2--2025-07-24--Fix_bugs_issues_urgent.md');
    });

    it('should handle multiple spaces in title', () => {
      const result = generateFilename(3, '2025-07-24', 'Multiple   spaces   in   title');
      expect(result).toBe('P3--2025-07-24--Multiple_spaces_in_title.md');
    });

    it('should remove leading and trailing underscores', () => {
      const result = generateFilename(3, '2025-07-24', '  Leading and trailing spaces  ');
      expect(result).toBe('P3--2025-07-24--Leading_and_trailing_spaces.md');
    });

    it('should limit title length to 50 characters', () => {
      const longTitle = 'This is a very long title that exceeds the fifty character limit';
      const result = generateFilename(3, '2025-07-24', longTitle);
      // The normalized title gets truncated to 50 chars after processing
      expect(result).toBe('P3--2025-07-24--This_is_a_very_long_title_that_exceeds_the_fifty_c.md');
    });

    it('should handle empty title', () => {
      const result = generateFilename(3, '2025-07-24', '');
      expect(result).toBe('P3--2025-07-24--untitled.md');
    });

    it('should handle title with only special characters', () => {
      const result = generateFilename(3, '2025-07-24', '!@#$%^&*()');
      expect(result).toBe('P3--2025-07-24--untitled.md');
    });

    it('should handle title with only spaces and underscores', () => {
      const result = generateFilename(3, '2025-07-24', '   ___   ');
      expect(result).toBe('P3--2025-07-24--untitled.md');
    });

    // Priority validation tests
    it('should default invalid priority (too low) to 3', () => {
      const result = generateFilename(0, '2025-07-24', 'Test Task');
      expect(result).toBe('P3--2025-07-24--Test_Task.md');
    });

    it('should default invalid priority (too high) to 3', () => {
      const result = generateFilename(6, '2025-07-24', 'Test Task');
      expect(result).toBe('P3--2025-07-24--Test_Task.md');
    });

    it('should default non-integer priority to 3', () => {
      const result = generateFilename(2.5, '2025-07-24', 'Test Task');
      expect(result).toBe('P3--2025-07-24--Test_Task.md');
    });

    it('should default negative priority to 3', () => {
      const result = generateFilename(-1, '2025-07-24', 'Test Task');
      expect(result).toBe('P3--2025-07-24--Test_Task.md');
    });

    // Date validation tests
    it('should use current date for invalid date format', () => {
      const result = generateFilename(1, 'invalid-date', 'Test Task');
      expect(result).toBe('P1--2025-07-24--Test_Task.md');
    });

    it('should use current date for empty date', () => {
      const result = generateFilename(1, '', 'Test Task');
      expect(result).toBe('P1--2025-07-24--Test_Task.md');
    });

    it('should use current date for partial date', () => {
      const result = generateFilename(1, '2025-07', 'Test Task');
      expect(result).toBe('P1--2025-07-24--Test_Task.md');
    });

    it('should accept valid date format', () => {
      const result = generateFilename(1, '2025-12-25', 'Christmas Task');
      expect(result).toBe('P1--2025-12-25--Christmas_Task.md');
    });
  });

  describe('isNewFormatFilename', () => {
    it('should return true for valid new format filename', () => {
      const filename = 'P1--2025-07-24--Deploy_Web_Application.md';
      expect(isNewFormatFilename(filename)).toBe(true);
    });

    it('should return true for filename with path', () => {
      const filename = 'folder/P2--2025-07-23--Update_Documentation.md';
      expect(isNewFormatFilename(filename)).toBe(true);
    });

    it('should return true for all valid priority levels', () => {
      const priorities = [1, 2, 3, 4, 5];
      
      priorities.forEach(priority => {
        const filename = `P${priority}--2025-07-24--Test_Task.md`;
        expect(isNewFormatFilename(filename)).toBe(true);
      });
    });

    it('should return false for invalid priority (0)', () => {
      const filename = 'P0--2025-07-24--Invalid_Priority.md';
      expect(isNewFormatFilename(filename)).toBe(false);
    });

    it('should return false for invalid priority (6)', () => {
      const filename = 'P6--2025-07-24--Invalid_Priority.md';
      expect(isNewFormatFilename(filename)).toBe(false);
    });

    it('should return false for legacy format', () => {
      const filename = '2025-07-24-legacy-task.md';
      expect(isNewFormatFilename(filename)).toBe(false);
    });

    it('should return false for invalid format', () => {
      const filename = 'random-filename.md';
      expect(isNewFormatFilename(filename)).toBe(false);
    });

    it('should return false for wrong extension', () => {
      const filename = 'P1--2025-07-24--Task.txt';
      expect(isNewFormatFilename(filename)).toBe(false);
    });

    it('should return false for empty filename', () => {
      expect(isNewFormatFilename('')).toBe(false);
    });
  });

  describe('isLegacyFormatFilename', () => {
    it('should return true for valid legacy format', () => {
      const filename = '2025-07-24-legacy-task.md';
      expect(isLegacyFormatFilename(filename)).toBe(true);
    });

    it('should return true for legacy format with path', () => {
      const filename = 'folder/2025-07-24-legacy-task.md';
      expect(isLegacyFormatFilename(filename)).toBe(true);
    });

    it('should return false for new format (not legacy)', () => {
      const filename = 'P1--2025-07-24--New_Format_Task.md';
      expect(isLegacyFormatFilename(filename)).toBe(false);
    });

    it('should return false for invalid date in legacy format', () => {
      const filename = '25-07-24-invalid-date.md';
      expect(isLegacyFormatFilename(filename)).toBe(false);
    });

    it('should return false for wrong extension', () => {
      const filename = '2025-07-24-task.txt';
      expect(isLegacyFormatFilename(filename)).toBe(false);
    });

    it('should return false for random filename', () => {
      const filename = 'random-filename.md';
      expect(isLegacyFormatFilename(filename)).toBe(false);
    });

    it('should return false for empty filename', () => {
      expect(isLegacyFormatFilename('')).toBe(false);
    });

    it('should return false for filename without task part', () => {
      const filename = '2025-07-24.md';
      expect(isLegacyFormatFilename(filename)).toBe(false);
    });
  });

  describe('extractDateFromLegacyFilename', () => {
    it('should extract date from valid legacy filename', () => {
      const filename = '2025-07-24-task-name.md';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBe('2025-07-24');
    });

    it('should extract date from filename with path', () => {
      const filename = 'folder/2025-07-24-task-name.md';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBe('2025-07-24');
    });

    it('should return null for invalid format', () => {
      const filename = 'invalid-filename.md';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for new format filename', () => {
      const filename = 'P1--2025-07-24--New_Format.md';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for invalid date format', () => {
      const filename = '25-07-24-invalid-date.md';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for empty filename', () => {
      const result = extractDateFromLegacyFilename('');
      expect(result).toBeNull();
    });

    it('should extract date even without .md extension', () => {
      const filename = '2025-07-24-task-name';
      const result = extractDateFromLegacyFilename(filename);
      expect(result).toBe('2025-07-24');
    });
  });

  describe('extractTitleFromLegacyFilename', () => {
    it('should extract title from valid legacy filename', () => {
      const filename = '2025-07-24-task-name-here.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBe('task name here');
    });

    it('should extract title from filename with path', () => {
      const filename = 'folder/2025-07-24-complex-task-title.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBe('complex task title');
    });

    it('should handle single word title', () => {
      const filename = '2025-07-24-task.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBe('task');
    });

    it('should return null for invalid format', () => {
      const filename = 'invalid-filename.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for new format filename', () => {
      const filename = 'P1--2025-07-24--New_Format.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for filename without title part', () => {
      const filename = '2025-07-24.md';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBeNull();
    });

    it('should return null for empty filename', () => {
      const result = extractTitleFromLegacyFilename('');
      expect(result).toBeNull();
    });

    it('should return null for filename without .md extension', () => {
      const filename = '2025-07-24-task-name.txt';
      const result = extractTitleFromLegacyFilename(filename);
      expect(result).toBeNull();
    });
  });

  describe('parseLegacyFilenameMetadata', () => {
    it('should parse valid legacy filename', () => {
      const filename = '2025-07-24-deploy-web-application.md';
      const result = parseLegacyFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 3,
        date: '2025-07-24',
        title: 'deploy web application',
        displayTitle: 'deploy web application'
      });
    });

    it('should parse legacy filename with path', () => {
      const filename = 'folder/2025-07-24-update-documentation.md';
      const result = parseLegacyFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 3,
        date: '2025-07-24',
        title: 'update documentation',
        displayTitle: 'update documentation'
      });
    });

    it('should return null for new format filename', () => {
      const filename = 'P1--2025-07-24--New_Format.md';
      const result = parseLegacyFilenameMetadata(filename);
      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const filename = 'invalid-filename.md';
      const result = parseLegacyFilenameMetadata(filename);
      expect(result).toBeNull();
    });

    it('should return null when date extraction fails', () => {
      const filename = 'invalid-date-format-task.md';
      const result = parseLegacyFilenameMetadata(filename);
      expect(result).toBeNull();
    });

    it('should return null when title extraction fails', () => {
      const filename = '2025-07-24.md';
      const result = parseLegacyFilenameMetadata(filename);
      expect(result).toBeNull();
    });

    it('should handle complex legacy title', () => {
      const filename = '2025-07-24-fix-critical-bugs-in-authentication-system.md';
      const result = parseLegacyFilenameMetadata(filename);
      
      expect(result).toEqual({
        priority: 3,
        date: '2025-07-24',
        title: 'fix critical bugs in authentication system',
        displayTitle: 'fix critical bugs in authentication system'
      });
    });

    it('should return null when extraction fails for malformed legacy filename', () => {
      // The most straightforward way to hit this branch is to create a filename
      // that isLegacyFormatFilename thinks is valid but extraction actually fails
      // Looking at the regex patterns, this is actually very hard since they use the same logic
      
      // However, we can create an edge case: a filename with just the date and no title part
      // that might pass some checks but fail others
      const filename = '2025-07-24-.md'; // This has date but empty title part
      const result = parseLegacyFilenameMetadata(filename);
      expect(result).toBeNull();
    });

  });

  describe('convertLegacyToNewFormat', () => {
    it('should convert valid legacy filename to new format', () => {
      const legacyFilename = '2025-07-24-deploy-web-application.md';
      const result = convertLegacyToNewFormat(legacyFilename, 1);
      expect(result).toBe('P1--2025-07-24--deploy_web_application.md');
    });

    it('should convert with default priority when not specified', () => {
      const legacyFilename = '2025-07-24-update-documentation.md';
      const result = convertLegacyToNewFormat(legacyFilename);
      expect(result).toBe('P3--2025-07-24--update_documentation.md');
    });

    it('should handle complex legacy title', () => {
      const legacyFilename = '2025-07-24-fix-critical-bugs-in-system.md';
      const result = convertLegacyToNewFormat(legacyFilename, 2);
      expect(result).toBe('P2--2025-07-24--fix_critical_bugs_in_system.md');
    });

    it('should return null for invalid legacy filename', () => {
      const legacyFilename = 'invalid-filename.md';
      const result = convertLegacyToNewFormat(legacyFilename);
      expect(result).toBeNull();
    });

    it('should return null when date extraction fails', () => {
      const legacyFilename = 'no-date-in-filename.md';
      const result = convertLegacyToNewFormat(legacyFilename);
      expect(result).toBeNull();
    });

    it('should return null when title extraction fails', () => {
      const legacyFilename = '2025-07-24.md';
      const result = convertLegacyToNewFormat(legacyFilename);
      expect(result).toBeNull();
    });

    it('should handle legacy filename with path', () => {
      const legacyFilename = 'folder/2025-07-24-task-with-path.md';
      const result = convertLegacyToNewFormat(legacyFilename, 4);
      expect(result).toBe('P4--2025-07-24--task_with_path.md');
    });

    it('should normalize special characters in title', () => {
      const legacyFilename = '2025-07-24-task-with-special-chars.md';
      const result = convertLegacyToNewFormat(legacyFilename, 5);
      expect(result).toBe('P5--2025-07-24--task_with_special_chars.md');
    });

    it('should handle all priority levels', () => {
      const legacyFilename = '2025-07-24-test-task.md';
      
      for (let priority = 1; priority <= 5; priority++) {
        const result = convertLegacyToNewFormat(legacyFilename, priority);
        expect(result).toBe(`P${priority}--2025-07-24--test_task.md`);
      }
    });
  });

  // === Coverage Improvement: Lines 181-183 ===
  describe('parseLegacyFilenameMetadata Error Handling (lines 181-183)', () => {
    it('should return null when date/title extraction fails (lines 181-183)', () => {
      // Test with malformed filename that will fail date/title extraction
      const malformedFilename = 'invalid-filename-format.md';
      const result = parseLegacyFilenameMetadata(malformedFilename);
      
      expect(result).toBeNull(); // Should return null when extraction fails
    });

    it('should return null for empty filename', () => {
      const result = parseLegacyFilenameMetadata('');
      expect(result).toBeNull();
    });

    it('should return null for filename without proper date format', () => {
      const result = parseLegacyFilenameMetadata('no-date-here.md');
      expect(result).toBeNull();
    });
  });
});