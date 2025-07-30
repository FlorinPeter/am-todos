/**
 * Comprehensive tests for filenameMetadata.ts
 * Target: 100% coverage across all functions and branches
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseFilenameMetadata,
  generateFilename,
  isNewFormatFilename
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

    it('should return false for old format', () => {
      const filename = '2025-07-24-old-format-task.md';
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






});