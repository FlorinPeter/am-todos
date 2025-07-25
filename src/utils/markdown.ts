import yaml from 'js-yaml';
import logger from './logger';
import { TodoFrontmatter } from '../types';
import { parseFilenameMetadata, isNewFormatFilename, isLegacyFormatFilename, extractDateFromLegacyFilename, extractTitleFromLegacyFilename } from './filenameMetadata';

// Priority validation function
export const validatePriority = (priority: unknown): number => {
  // If priority is not a number, default to 3
  if (typeof priority !== 'number') {
    const parsed = parseInt(String(priority), 10);
    if (isNaN(parsed)) {
      logger.warn(`Invalid priority value: ${priority}, defaulting to 3`);
      return 3;
    }
    priority = parsed;
  }
  
  // Ensure priority is within valid range (1-5)
  if ((priority as number) < 1 || (priority as number) > 5 || !Number.isInteger(priority as number)) {
    logger.warn(`Priority value ${priority} out of range (1-5), defaulting to 3`);
    return 3;
  }
  
  return priority as number;
};

/**
 * NEW: Parse markdown with filename-first metadata approach
 * This is the main parsing function that prioritizes filename metadata
 */
export const parseMarkdownWithMetadata = (content: string, filename: string, isArchived: boolean = false) => {
  logger.log('parseMarkdownWithMetadata: Starting parse', { filename, isArchived });
  
  // 🆕 Try filename-based metadata first (new format)
  const filenameMetadata = parseFilenameMetadata(filename);
  
  if (filenameMetadata) {
    logger.log('parseMarkdownWithMetadata: Using filename metadata', filenameMetadata);
    
    // New format: metadata from filename, minimal frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      const frontmatterYaml = frontmatterMatch[1];
      const markdownContent = frontmatterMatch[2];
      
      try {
        const rawFrontmatter = yaml.load(frontmatterYaml) as any;
        const frontmatter: TodoFrontmatter = {
          tags: Array.isArray(rawFrontmatter?.tags) ? rawFrontmatter.tags : []
        };
        
        return {
          title: filenameMetadata.displayTitle,
          createdAt: filenameMetadata.date + 'T00:00:00.000Z',
          priority: filenameMetadata.priority,
          isArchived,
          frontmatter,
          markdownContent
        };
      } catch (e) {
        logger.error("Error parsing YAML frontmatter:", e);
        return {
          title: filenameMetadata.displayTitle,
          createdAt: filenameMetadata.date + 'T00:00:00.000Z', 
          priority: filenameMetadata.priority,
          isArchived,
          frontmatter: { tags: [] },
          markdownContent: content
        };
      }
    } else {
      // No frontmatter, just filename metadata
      return {
        title: filenameMetadata.displayTitle,
        createdAt: filenameMetadata.date + 'T00:00:00.000Z',
        priority: filenameMetadata.priority,
        isArchived,
        frontmatter: { tags: [] },
        markdownContent: content
      };
    }
  } else if (isLegacyFormatFilename(filename)) {
    logger.log('parseMarkdownWithMetadata: Using legacy filename + frontmatter', filename);
    
    // 🔄 Legacy format with partial filename metadata
    const legacyDate = extractDateFromLegacyFilename(filename);
    const legacyTitle = extractTitleFromLegacyFilename(filename);
    
    // Still need frontmatter for priority in legacy format
    const legacyParsed = parseMarkdownWithFrontmatter(content);
    const legacyFrontmatter = legacyParsed.frontmatter;
    
    if (legacyFrontmatter) {
      // Cast to any to access legacy frontmatter properties
      const legacyData = legacyFrontmatter as any;
      
      return {
        title: legacyTitle || legacyData.title || 'Untitled',
        createdAt: legacyDate ? legacyDate + 'T00:00:00.000Z' : legacyData.createdAt,
        priority: validatePriority(legacyData.priority),
        isArchived,
        frontmatter: { tags: [] }, // Convert legacy to new frontmatter format
        markdownContent: legacyParsed.markdownContent
      };
    } else {
      // Legacy filename without frontmatter
      return {
        title: legacyTitle || 'Untitled',
        createdAt: legacyDate ? legacyDate + 'T00:00:00.000Z' : new Date().toISOString(),
        priority: 3, // Default priority
        isArchived,
        frontmatter: { tags: [] },
        markdownContent: legacyParsed.markdownContent
      };
    }
  } else {
    logger.log('parseMarkdownWithMetadata: Falling back to pure frontmatter parsing', filename);
    
    // 🔄 Fallback: pure legacy frontmatter parsing (very old format)
    return parseMarkdownWithFrontmatter(content, isArchived);
  }
};

/**
 * LEGACY: Original frontmatter parsing - kept for backward compatibility
 * Only used as fallback for very old files without recognizable filename patterns
 */
export const parseMarkdownWithFrontmatter = (content: string, isArchived: boolean = false) => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatterYaml = match[1];
    const markdownContent = match[2];
    try {
      const rawFrontmatter = yaml.load(frontmatterYaml) as any;
      
      // Convert legacy frontmatter to new format
      return {
        title: String(rawFrontmatter?.title || 'Untitled'),
        createdAt: String(rawFrontmatter?.createdAt || new Date().toISOString()),
        priority: validatePriority(rawFrontmatter?.priority),
        isArchived,
        frontmatter: { tags: [] }, // Convert to new simplified format
        markdownContent
      };
    } catch (e) {
      logger.error("Error parsing YAML frontmatter:", e);
      return {
        title: 'Untitled',
        createdAt: new Date().toISOString(),
        priority: 3,
        isArchived,
        frontmatter: { tags: [] },
        markdownContent: content
      };
    }
  } else {
    return {
      title: 'Untitled',
      createdAt: new Date().toISOString(),
      priority: 3,
      isArchived,
      frontmatter: { tags: [] },
      markdownContent: content
    };
  }
};

/**
 * Generate markdown content with new simplified frontmatter
 * Only includes tags field - all other metadata is in filename
 */
export const stringifyMarkdownWithMetadata = (frontmatter: TodoFrontmatter, markdownContent: string) => {
  const frontmatterYaml = yaml.dump(frontmatter);
  return `---\n${frontmatterYaml}---\n${markdownContent}`;
};

/**
 * LEGACY: Original frontmatter stringification - kept for backward compatibility
 */
export const stringifyMarkdownWithFrontmatter = (frontmatter: any, markdownContent: string) => {
  const frontmatterYaml = yaml.dump(frontmatter);
  return `---\n${frontmatterYaml}---\n${markdownContent}`;
};
