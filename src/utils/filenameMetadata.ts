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

/**
 * Check if filename uses the legacy format (date-slug.md)
 */
export const isLegacyFormatFilename = (filename: string): boolean => {
  // Remove path components if present
  const justFilename = filename.split('/').pop() || filename;
  
  // Legacy pattern: YYYY-MM-DD-slug.md (without priority prefix)
  const isLegacy = /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(justFilename) && !isNewFormatFilename(justFilename);
  
  logger.log('isLegacyFormatFilename:', {
    filename: justFilename,
    isLegacy
  });
  
  return isLegacy;
};

/**
 * Extract date from legacy filename format (YYYY-MM-DD-slug.md)
 * Used for backward compatibility during migration
 */
export const extractDateFromLegacyFilename = (filename: string): string | null => {
  const justFilename = filename.split('/').pop() || filename;
  const match = justFilename.match(/^(\d{4}-\d{2}-\d{2})-/);
  
  if (match) {
    logger.log('extractDateFromLegacyFilename: Extracted date:', match[1]);
    return match[1];
  }
  
  logger.log('extractDateFromLegacyFilename: No date found in:', justFilename);
  return null;
};

/**
 * Extract title slug from legacy filename format
 * Used for backward compatibility during migration
 */
export const extractTitleFromLegacyFilename = (filename: string): string | null => {
  const justFilename = filename.split('/').pop() || filename;
  const match = justFilename.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
  
  if (match) {
    // Convert hyphens to spaces for display
    const title = match[1].replace(/-/g, ' ');
    logger.log('extractTitleFromLegacyFilename: Extracted title:', title);
    return title;
  }
  
  logger.log('extractTitleFromLegacyFilename: No title found in:', justFilename);
  return null;
};

/**
 * Parse metadata from legacy filename format WITHOUT content fetching
 * This enables performance optimization for existing legacy files
 * 
 * Format: YYYY-MM-DD-title-slug.md
 * Returns metadata with default priority (P3) to avoid content fetch
 */
export const parseLegacyFilenameMetadata = (filename: string): FileMetadata | null => {
  // Remove path components if present
  const justFilename = filename.split('/').pop() || filename;
  
  if (!isLegacyFormatFilename(justFilename)) {
    logger.log('parseLegacyFilenameMetadata: Not a legacy format:', justFilename);
    return null;
  }
  
  const date = extractDateFromLegacyFilename(justFilename);
  const title = extractTitleFromLegacyFilename(justFilename);
  
  if (!date || !title) {
    logger.log('parseLegacyFilenameMetadata: Could not extract date/title from:', justFilename);
    return null;
  }
  
  // 🚀 PERFORMANCE OPTIMIZATION: Use default priority to avoid content fetch
  const metadata: FileMetadata = {
    priority: 3, // Default to P3 (Medium) for legacy files
    date,
    title,
    displayTitle: title // Already has spaces from extractTitleFromLegacyFilename
  };
  
  logger.log('✅ LEGACY PERFORMANCE: Parsed metadata without content fetch:', {
    filename: justFilename,
    metadata
  });
  
  return metadata;
};

/**
 * Convert legacy filename to new format
 * Used during migration when files are edited
 */
export const convertLegacyToNewFormat = (
  legacyFilename: string, 
  priority: number = 3
): string | null => {
  const date = extractDateFromLegacyFilename(legacyFilename);
  const title = extractTitleFromLegacyFilename(legacyFilename);
  
  if (!date || !title) {
    logger.warn('convertLegacyToNewFormat: Could not extract date/title from:', legacyFilename);
    return null;
  }
  
  const newFilename = generateFilename(priority, date, title);
  
  logger.log('convertLegacyToNewFormat: Conversion:', {
    legacy: legacyFilename,
    new: newFilename,
    priority
  });
  
  return newFilename;
};