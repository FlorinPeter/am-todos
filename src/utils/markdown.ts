import yaml from 'js-yaml';
import logger from './logger';
import { TodoFrontmatter } from '../types';

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
  if (priority < 1 || priority > 5 || !Number.isInteger(priority)) {
    logger.warn(`Priority value ${priority} out of range (1-5), defaulting to 3`);
    return 3;
  }
  
  return priority;
};

export const parseMarkdownWithFrontmatter = (content: string) => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatterYaml = match[1];
    const markdownContent = match[2];
    try {
      const rawFrontmatter = yaml.load(frontmatterYaml) as any;
      
      // Validate and sanitize the frontmatter
      const frontmatter: TodoFrontmatter = {
        title: String(rawFrontmatter?.title || ''),
        createdAt: String(rawFrontmatter?.createdAt || new Date().toISOString()),
        priority: validatePriority(rawFrontmatter?.priority),
        isArchived: Boolean(rawFrontmatter?.isArchived),
        chatHistory: Array.isArray(rawFrontmatter?.chatHistory) ? rawFrontmatter.chatHistory : []
      };
      
      return { frontmatter, markdownContent };
    } catch (e) {
      logger.error("Error parsing YAML frontmatter:", e);
      return { frontmatter: null, markdownContent: content };
    }
  } else {
    return { frontmatter: null, markdownContent: content };
  }
};

export const stringifyMarkdownWithFrontmatter = (frontmatter: TodoFrontmatter, markdownContent: string) => {
  const frontmatterYaml = yaml.dump(frontmatter);
  return `---\n${frontmatterYaml}---\n${markdownContent}`;
};
