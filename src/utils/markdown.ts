import yaml from 'js-yaml';
import logger from './logger';
import { TodoFrontmatter } from '../types';

export const parseMarkdownWithFrontmatter = (content: string) => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatterYaml = match[1];
    const markdownContent = match[2];
    try {
      const frontmatter = yaml.load(frontmatterYaml) as TodoFrontmatter;
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
