/**
 * Filename-Based Metadata Utilities
 * 
 * This module handles parsing and generation of metadata-encoded filenames
 * Format: P{priority}--{date}--{title}.md
 * 
 * Examples:
 * - P1--2025-07-24--Deploy_Web_Application.md
 * - P3--2025-07-23--Update_Documentation.md
 */

import logger from './logger';

export interface FileMetadata {
  priority: number;
  date: string;
  title: string;
  displayTitle: string; // Spaces restored for UI display
}

/**
 * Parse metadata from filename using new format
 * Pattern: P{1-5}--YYYY-MM-DD--Title_With_Underscores.md
 */
export const parseFilenameMetadata = (filename: string): FileMetadata | null => {
  // Remove path components if present, work with just the filename
  const justFilename = filename.split('/').pop() || filename;
  
  // Pattern: P{1-5}--YYYY-MM-DD--Title_With_Underscores.md
  const pattern = /^P([1-5])--(\d{4}-\d{2}-\d{2})--(.+)\.md$/;
  const match = justFilename.match(pattern);
  
  if (!match) {
    logger.log('parseFilenameMetadata: No match for filename:', justFilename);
    return null;
  }
  
  const [, priority, date, title] = match;
  
  const metadata: FileMetadata = {
    priority: parseInt(priority, 10),
    date,
    title,
    displayTitle: title.replace(/_/g, ' ') // Convert underscores back to spaces for display
  };
  
  logger.log('parseFilenameMetadata: Parsed metadata:', metadata);
  return metadata;
};

/**
 * Generate filename with encoded metadata
 * Format: P{priority}--{date}--{normalized_title}.md
 */
export const generateFilename = (priority: number, date: string, title: string): string => {
  // Validate priority
  if (priority < 1 || priority > 5 || !Number.isInteger(priority)) {
    logger.warn(`generateFilename: Invalid priority ${priority}, defaulting to 3`);
    priority = 3;
  }
  
  // Validate date format (basic check)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    logger.warn(`generateFilename: Invalid date format ${date}, using today`);
    date = new Date().toISOString().split('T')[0];
  }
  
  // Normalize title for filesystem compatibility
  const normalizedTitle = title
    .replace(/ /g, '_')                    // Spaces to underscores
    .replace(/[^\w-]/g, '')                // Remove special chars (keep letters, numbers, underscores, hyphens)
    .replace(/_+/g, '_')                   // Multiple underscores to single
    .replace(/^_+|_+$/g, '')               // Remove leading/trailing underscores
    .substring(0, 50);                     // Limit length for filesystem compatibility
  
  // Ensure we have a title after normalization
  const finalTitle = normalizedTitle || 'untitled';
  
  const filename = `P${priority}--${date}--${finalTitle}.md`;
  
  logger.log('generateFilename: Generated filename:', {
    input: { priority, date, title },
    output: filename,
    normalizedTitle: finalTitle
  });
  
  return filename;
};

/**
 * Check if filename uses the new metadata format
 */
export const isNewFormatFilename = (filename: string): boolean => {
  // Remove path components if present
  const justFilename = filename.split('/').pop() || filename;
  
  const isNewFormat = /^P[1-5]--\d{4}-\d{2}-\d{2}--.+\.md$/.test(justFilename);
  
  logger.log('isNewFormatFilename:', {
    filename: justFilename,
    isNewFormat
  });
  
  return isNewFormat;
};

