import yaml from 'js-yaml';
import logger from './logger';
import { TodoFrontmatter } from '../types';
import { parseFilenameMetadata } from './filenameMetadata';

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
 * Parse markdown with new format only: P{priority}--{date}--{title}.md
 * Returns null for files that don't match the new format (will be ignored)
 */
export const parseMarkdownWithMetadata = (content: string, filename: string, isArchived: boolean = false) => {
  logger.log('parseMarkdownWithMetadata: Starting parse', { filename, isArchived });
  
  // Only support new format: P{priority}--{date}--{title}.md
  const filenameMetadata = parseFilenameMetadata(filename);
  
  if (!filenameMetadata) {
    logger.log('parseMarkdownWithMetadata: File does not match new format, ignoring', filename);
    return null; // Ignore files that don't match new format
  }
  
  logger.log('parseMarkdownWithMetadata: Using filename metadata', filenameMetadata);
  
  // Parse frontmatter for tags
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (frontmatterMatch) {
    const frontmatterYaml = frontmatterMatch[1];
    const markdownContent = frontmatterMatch[2];
    
    try {
      const rawFrontmatter = yaml.load(frontmatterYaml) as any;
      const frontmatter: TodoFrontmatter = {
        tags: Array.isArray(rawFrontmatter?.tags) ? rawFrontmatter.tags : [],
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
        frontmatter: { tags: [],  },
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
      frontmatter: { tags: [],  },
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

