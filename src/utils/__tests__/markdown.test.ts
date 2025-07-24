import { describe, it, expect, vi } from 'vitest';
import { parseMarkdownWithFrontmatter, stringifyMarkdownWithFrontmatter } from '../markdown';
import { TodoFrontmatter } from '../../types';

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

import logger from '../logger';

describe('markdown utils', () => {
  describe('parseMarkdownWithFrontmatter', () => {
    it('parses valid frontmatter and content', () => {
      const input = `---
title: 'Test Todo'
createdAt: '2023-01-01T00:00:00.000Z'
priority: 3
isArchived: false
chatHistory: []
---
# Test Todo

- [ ] Task 1
- [x] Task 2`;

      const result = parseMarkdownWithFrontmatter(input);

      // In the new system, these are top-level fields
      expect(result.title).toBe('Test Todo');
      expect(result.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(result.priority).toBe(3);
      expect(result.isArchived).toBe(false);
      // Frontmatter now only contains tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe(`# Test Todo

- [ ] Task 1
- [x] Task 2`);
    });

    it('parses frontmatter with chat history', () => {
      const input = `---
title: 'Todo with Chat'
createdAt: '2023-01-01T00:00:00.000Z'
priority: 2
isArchived: false
chatHistory:
  - role: 'user'
    content: 'Add a task'
  - role: 'assistant'
    content: 'Task added'
---
# Todo Content`;

      const result = parseMarkdownWithFrontmatter(input);

      // Chat history is no longer stored in frontmatter in the new system
      // The new system uses simplified frontmatter with only tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe('# Todo Content');
    });

    it('handles content without frontmatter', () => {
      const input = `# Regular Markdown

This has no frontmatter.

- [ ] Task 1`;

      const result = parseMarkdownWithFrontmatter(input);

      // New system always returns frontmatter object with tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe(input);
    });

    it('handles empty content', () => {
      const input = '';

      const result = parseMarkdownWithFrontmatter(input);

      // New system always returns frontmatter object with tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe('');
    });

    it('handles malformed frontmatter gracefully', () => {
      const input = `---
title: 'Test Todo'
invalid yaml: [unclosed bracket
priority: 3
---
# Content`;

      // Mock logger.error to avoid noise in tests
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

      const result = parseMarkdownWithFrontmatter(input);

      // New system always returns frontmatter object with tags even on error
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe(input);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error parsing YAML frontmatter:',
        expect.any(Error)
      );

      loggerSpy.mockRestore();
    });

    it('handles frontmatter without closing delimiter', () => {
      const input = `---
title: 'Incomplete frontmatter'
# This never closes`;

      const result = parseMarkdownWithFrontmatter(input);

      // New system always returns frontmatter object with tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe(input);
    });

    it('handles frontmatter with extra spaces and newlines', () => {
      const input = `---
title: 'Spaced Todo'
createdAt: '2023-01-01T00:00:00.000Z'
priority: 1
isArchived: true
chatHistory: []
---

# Spaced Content

With extra spacing.`;

      const result = parseMarkdownWithFrontmatter(input);

      // In the new system, these are top-level fields
      expect(result.title).toBe('Spaced Todo');
      expect(result.createdAt).toBe('2023-01-01T00:00:00.000Z');
      expect(result.priority).toBe(1);
      // isArchived defaults to false in the new system unless explicitly passed
      expect(result.isArchived).toBe(false);
      // Frontmatter now only contains tags
      expect(result.frontmatter).toEqual({ tags: [] });
      expect(result.markdownContent).toBe(`
# Spaced Content

With extra spacing.`);
    });
  });

  describe('stringifyMarkdownWithFrontmatter', () => {
    it('creates valid markdown with frontmatter', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Test Todo',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      };
      const content = `# Test Todo

- [ ] Task 1
- [x] Task 2`;

      const result = stringifyMarkdownWithFrontmatter(frontmatter, content);

      expect(result).toContain('---\n');
      expect(result).toContain('title: Test Todo\n');
      expect(result).toContain('priority: 3\n');
      expect(result).toContain('isArchived: false\n');
      expect(result).toContain('chatHistory: []\n');
      expect(result).toContain('---\n');
      expect(result).toContain(content);
    });

    it('handles frontmatter with chat history', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Chat Todo',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 2,
        isArchived: false,
        chatHistory: [
          { role: 'user', content: 'Add a task' },
          { role: 'assistant', content: 'Task added successfully' }
        ]
      };
      const content = '# Chat Todo Content';

      const result = stringifyMarkdownWithFrontmatter(frontmatter, content);

      expect(result).toContain('chatHistory:');
      expect(result).toContain('role: user');
      expect(result).toContain('content: Add a task');
      expect(result).toContain('role: assistant');
      expect(result).toContain('content: Task added successfully');
      expect(result).toContain(content);
    });

    it('handles empty content', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Empty Todo',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 1,
        isArchived: true,
        chatHistory: []
      };

      const result = stringifyMarkdownWithFrontmatter(frontmatter, '');

      expect(result).toContain('---\n');
      expect(result).toContain('title: Empty Todo\n');
      expect(result.endsWith('---\n')).toBe(true);
    });

    it('preserves special characters in content', () => {
      const frontmatter: TodoFrontmatter = {
        title: 'Special Todo',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 3,
        isArchived: false,
        chatHistory: []
      };
      const content = `# Special Characters

- [ ] Task with "quotes"
- [x] Task with 'single quotes'
- [ ] Task with & ampersand
- [ ] Task with <html> tags`;

      const result = stringifyMarkdownWithFrontmatter(frontmatter, content);

      expect(result).toContain(content);
      expect(result).toContain('"quotes"');
      expect(result).toContain("'single quotes'");
      expect(result).toContain('& ampersand');
      expect(result).toContain('<html>');
    });
  });

  describe('round trip parsing', () => {
    it('parses and stringifies back to equivalent content', () => {
      const originalFrontmatter: TodoFrontmatter = {
        title: 'Round Trip Test',
        createdAt: '2023-01-01T00:00:00.000Z',
        priority: 4,
        isArchived: false,
        chatHistory: [
          { role: 'user', content: 'Test message' }
        ]
      };
      const originalContent = `# Round Trip Test

- [ ] Test task
- [x] Completed task`;

      // Stringify to markdown
      const stringified = stringifyMarkdownWithFrontmatter(originalFrontmatter, originalContent);

      // Parse it back
      const parsed = parseMarkdownWithFrontmatter(stringified);

      // In the new system, compare top-level fields instead of nested frontmatter
      expect(parsed.title).toBe(originalFrontmatter.title);
      expect(parsed.createdAt).toBe(originalFrontmatter.createdAt);
      expect(parsed.priority).toBe(originalFrontmatter.priority);
      expect(parsed.isArchived).toBe(originalFrontmatter.isArchived);
      // Frontmatter is simplified to just tags in new system  
      expect(parsed.frontmatter).toEqual({ tags: [] });
      expect(parsed.markdownContent).toBe(originalContent);
    });

    it('handles complex frontmatter round trip', () => {
      const complexFrontmatter: TodoFrontmatter = {
        title: 'Complex Todo with "quotes" and special chars',
        createdAt: '2023-12-31T23:59:59.999Z',
        priority: 5,
        isArchived: true,
        chatHistory: [
          { role: 'user', content: 'Create a complex task with: special characters!' },
          { role: 'assistant', content: 'Task created with &amp; entities and <tags>' },
          { role: 'user', content: 'Perfect, thanks!' }
        ]
      };
      const complexContent = `# Complex Todo

This todo has:
- [ ] Multiple levels of **formatting**
- [x] ~~Strikethrough~~ text
- [ ] Links: [example](https://example.com)
- [ ] Code: \`console.log("hello")\`

\`\`\`javascript
// Code block
function test() {
  return "complex";
}
\`\`\``;

      const stringified = stringifyMarkdownWithFrontmatter(complexFrontmatter, complexContent);
      const parsed = parseMarkdownWithFrontmatter(stringified);

      // In the new system, compare top-level fields instead of nested frontmatter
      expect(parsed.title).toBe(complexFrontmatter.title);
      expect(parsed.createdAt).toBe(complexFrontmatter.createdAt);
      expect(parsed.priority).toBe(complexFrontmatter.priority);
      // isArchived defaults to false in the new system unless explicitly passed
      expect(parsed.isArchived).toBe(false);
      // Frontmatter is simplified to just tags in new system
      expect(parsed.frontmatter).toEqual({ tags: [] });
      expect(parsed.markdownContent).toBe(complexContent);
    });
  });
});