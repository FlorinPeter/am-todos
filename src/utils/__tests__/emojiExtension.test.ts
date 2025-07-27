import { vi, describe, it, expect, beforeEach } from 'vitest';
import { emojiExtension, emojiCompletions } from '../emojiExtension';
import { search } from 'node-emoji';

// Mock node-emoji module - the only external dependency we need to mock
vi.mock('node-emoji', () => ({
  search: vi.fn(),
  get: vi.fn()
}));

const mockSearch = search as any;

// Helper function to create mock CompletionContext objects
function createMockContext(text: string, from: number, to: number, explicit: boolean = false) {
  return {
    matchBefore: vi.fn((regex: RegExp) => {
      const match = text.match(regex);
      if (match?.index !== undefined) {
        return {
          from: from,
          to: to,
          text: match[0]
        };
      }
      return null;
    }),
    explicit,
    state: {} as any,
    pos: to,
    tokenBefore: vi.fn(),
    aborted: false,
    addEventListener: vi.fn()
  } as any;
}

describe('emojiExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension Creation', () => {
    it('should create emoji extension without errors', () => {
      expect(emojiExtension).toBeDefined();
      expect(Array.isArray(emojiExtension)).toBe(true);
    });

    it('should export extension as default', async () => {
      const defaultExport = (await import('../emojiExtension')).default;
      expect(defaultExport).toBe(emojiExtension);
    });
  });

  describe('emojiCompletions Function', () => {
    describe('Context Matching', () => {
      it('should return null when no colon prefix is found', () => {
        const context = createMockContext('hello world', 0, 11);
        context.matchBefore.mockReturnValue(null);
        
        const result = emojiCompletions(context);
        
        expect(result).toBeNull();
        expect(context.matchBefore).toHaveBeenCalledWith(/:[a-zA-Z0-9_+-]*$/);
      });

      it('should return null when match is at cursor but not explicit', () => {
        // Create context where from === to (no actual content selected) and not explicit
        const context = createMockContext(':', 0, 0, false);
        
        const result = emojiCompletions(context);
        
        expect(result).toBeNull();
      });

      it('should proceed when match exists and has content', () => {
        const context = createMockContext(':smile', 0, 6);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
      });

      it('should handle explicit context with just colon', () => {
        const context = createMockContext(':', 0, 1, true);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options).toBeDefined();
        expect(result?.options.length).toBeGreaterThan(0);
      });
    });

    describe('Popular Emoji Handling', () => {
      it('should return popular emojis when query is empty', () => {
        const context = createMockContext(':', 0, 1, true);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.from).toBe(0);
        expect(result?.options).toBeDefined();
        expect(result?.options.length).toBeLessThanOrEqual(20);
        
        // Check for some expected popular emojis
        const labels = result?.options.map(opt => opt.label) || [];
        expect(labels).toContain(':thumbsup:');
        expect(labels).toContain(':heart:');
        expect(labels).toContain(':fire:');
      });

      it('should filter popular emojis by query', () => {
        const context = createMockContext(':fire', 0, 5);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.some(opt => opt.label === ':fire:')).toBe(true);
      });

      it('should handle case-insensitive popular emoji matching', () => {
        const context = createMockContext(':FIRE', 0, 5);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.some(opt => opt.label === ':fire:')).toBe(true);
      });

      it('should handle special characters like +1 and -1', () => {
        const context = createMockContext(':+1', 0, 3);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.some(opt => opt.label === ':+1:' || opt.label === ':thumbsup:')).toBe(true);
      });

      it('should provide correct emoji structure', () => {
        const context = createMockContext(':heart', 0, 6);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        const heartOption = result?.options.find(opt => opt.label === ':heart:');
        expect(heartOption).toBeDefined();
        expect(heartOption?.label).toBe(':heart:');
        expect(heartOption?.detail).toBe('❤️');
        expect(heartOption?.apply).toBe('❤️');
        expect(heartOption?.type).toBe('variable');
      });
    });

    describe('Node-Emoji Search Integration', () => {
      it('should use node-emoji search when no popular matches found', () => {
        const context = createMockContext(':unicorn', 0, 8);
        const mockResults = [
          { name: 'unicorn', emoji: '🦄' },
          { name: 'unicorn_face', emoji: '🦄' }
        ];
        mockSearch.mockReturnValue(mockResults);
        
        const result = emojiCompletions(context);
        
        expect(mockSearch).toHaveBeenCalledWith('unicorn');
        expect(result).not.toBeNull();
        expect(result?.options.some(opt => opt.label === ':unicorn:')).toBe(true);
        expect(result?.options.some(opt => opt.label === ':unicorn_face:')).toBe(true);
      });

      it('should limit node-emoji search results to 50', () => {
        const context = createMockContext(':test', 0, 5);
        // Create 100 mock results
        const manyResults = Array.from({ length: 100 }, (_, i) => ({
          name: `emoji${i}`,
          emoji: '😀'
        }));
        mockSearch.mockReturnValue(manyResults);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.length).toBeLessThanOrEqual(50);
      });

      it('should skip node-emoji search for queries with special regex characters', () => {
        const context = createMockContext(':test+', 0, 6);
        
        const result = emojiCompletions(context);
        
        expect(mockSearch).not.toHaveBeenCalled();
        // Since "test+" doesn't match any popular emojis, it should return null
        expect(result).toBeNull();
      });

      it('should handle node-emoji search errors gracefully', () => {
        const context = createMockContext(':test', 0, 5);
        mockSearch.mockImplementation(() => {
          throw new Error('Search failed');
        });
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const result = emojiCompletions(context);
        
        expect(consoleSpy).toHaveBeenCalledWith('Node-emoji search failed:', expect.any(Error));
        // Should still return result (popular matches or null)
        expect(result).toBeDefined();
        
        consoleSpy.mockRestore();
      });


      it('should convert search results to proper completion format', () => {
        const context = createMockContext(':cat', 0, 4);
        const mockResults = [
          { name: 'cat', emoji: '🐱' },
          { name: 'cat2', emoji: '🐈' }
        ];
        mockSearch.mockReturnValue(mockResults);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        const catOption = result?.options.find(opt => opt.label === ':cat:');
        expect(catOption).toBeDefined();
        expect(catOption?.label).toBe(':cat:');
        expect(catOption?.detail).toBe('🐱');
        expect(catOption?.apply).toBe('🐱');
        expect(catOption?.type).toBe('variable');
      });
    });

    describe('Result Processing', () => {
      it('should combine and deduplicate popular and search results', () => {
        const context = createMockContext(':fire', 0, 5);
        const mockResults = [
          { name: 'fire', emoji: '🔥' }, // This matches popular emoji
          { name: 'fireworks', emoji: '🎆' }
        ];
        mockSearch.mockReturnValue(mockResults);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        // Should only have one 'fire' entry despite being in both popular and search results
        const fireMatches = result?.options.filter(opt => opt.label === ':fire:') || [];
        expect(fireMatches.length).toBe(1);
      });

      it('should sort results by relevance', () => {
        const context = createMockContext(':star', 0, 5);
        const mockResults = [
          { name: 'superstar', emoji: '🌟' },
          { name: 'star', emoji: '⭐' }, // Exact match should be prioritized
          { name: 'starfish', emoji: '⭐' }
        ];
        mockSearch.mockReturnValue(mockResults);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        // Exact match should come first
        expect(result?.options[0].label).toBe(':star:');
      });

      it('should limit final results to 50', () => {
        const context = createMockContext(':e', 0, 2);
        // Create many search results that would exceed the limit
        const manyResults = Array.from({ length: 60 }, (_, i) => ({
          name: `emoji_${i}`,
          emoji: '😀'
        }));
        mockSearch.mockReturnValue(manyResults);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.length).toBeLessThanOrEqual(50);
      });

      it('should return null when no matches found', () => {
        const context = createMockContext(':nonexistent', 0, 12);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should handle general errors and fallback to popular emojis', () => {
        // Use a query that doesn't match popular emojis so node-emoji search is attempted
        const context = createMockContext(':unicorn', 0, 8);
        mockSearch.mockImplementation(() => {
          throw new Error('General error');
        });
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const result = emojiCompletions(context);
        
        // Node-emoji search error should be caught and warned about
        expect(consoleSpy).toHaveBeenCalledWith('Node-emoji search failed:', expect.any(Error));
        // Should return null since no popular matches and search failed
        expect(result).toBeNull();
        
        consoleSpy.mockRestore();
      });

      it('should return null when error occurs and no popular matches', () => {
        const context = createMockContext(':randomxyz', 0, 10);
        mockSearch.mockImplementation(() => {
          throw new Error('Search error');
        });
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const result = emojiCompletions(context);
        
        expect(result).toBeNull();
        
        consoleSpy.mockRestore();
      });

      it('should handle invalid context gracefully', () => {
        const invalidContext = {
          matchBefore: vi.fn().mockImplementation(() => {
            throw new Error('Context error');
          }),
          explicit: false
        };
        
        expect(() => emojiCompletions(invalidContext as any)).toThrow('Context error');
      });

      it('should handle main function errors and return null when no fallback matches (lines 144-145)', () => {
        // Create a scenario with a query that won't match any popular emojis
        const context = createMockContext(':nonexistentemojiquery', 0, 21);
        
        // Mock console.warn to capture the outer catch block warning
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        // Mock Array.prototype.filter to throw an error during popular emoji filtering
        // This will trigger the outer catch block but with no popular matches
        const originalFilter = Array.prototype.filter;
        let errorThrown = false;
        // eslint-disable-next-line no-extend-native
        Array.prototype.filter = function() {
          // Only trigger error for the popularEmojis.filter() call in the main try block
          if (!errorThrown && this.length > 0 && typeof this[0] === 'object' && this[0].name) {
            errorThrown = true;
            throw new Error('Simulated filter error in popular emoji processing');
          }
          return originalFilter.apply(this, arguments as any);
        };
        
        let result;
        try {
          result = emojiCompletions(context);
        } finally {
          // Restore original method
          // eslint-disable-next-line no-extend-native
          Array.prototype.filter = originalFilter;
        }
        
        // Should have caught the error and tried fallback but found no matches
        expect(consoleSpy).toHaveBeenCalledWith('Emoji search error:', expect.any(Error));
        
        // Should return null since no popular matches found (lines 144-145)
        expect(result).toBeNull();
        
        consoleSpy.mockRestore();
      });

    });

    describe('Edge Cases', () => {
      it('should handle empty string queries', () => {
        const context = createMockContext(':', 0, 1, true);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options.length).toBeGreaterThan(0);
        expect(result?.options.length).toBeLessThanOrEqual(20);
      });

      it('should handle very long queries', () => {
        const longQuery = ':' + 'a'.repeat(100);
        const context = createMockContext(longQuery, 0, longQuery.length);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        // Should not crash and should return null or empty results
        expect(result).toBeDefined();
      });

      it('should handle special unicode characters in query', () => {
        const context = createMockContext(':café', 0, 5);
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).toBeDefined();
      });

      it('should handle context with different from/to positions', () => {
        const context = createMockContext(':smi', 5, 9); // Starting at position 5
        mockSearch.mockReturnValue([]);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.from).toBe(5);
      });
    });

    describe('Popular Emoji List Coverage', () => {
      it('should include essential popular emojis', () => {
        const context = createMockContext(':', 0, 1, true);
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        const labels = result?.options.map(opt => opt.label) || [];
        
        // Test some essential emojis are included
        const expectedEmojis = [':thumbsup:', ':heart:', ':fire:', ':rocket:', ':star:'];
        expectedEmojis.forEach(emoji => {
          expect(labels.includes(emoji)).toBe(true);
        });
      });

      it('should include development-related emojis when searching', () => {
        // Search for 'bug' which should match the bug emoji in popular list
        const context = createMockContext(':bug', 0, 4);
        mockSearch.mockReturnValue([]); // No additional search results
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        const labels = result?.options.map(opt => opt.label) || [];
        
        // Should find the bug emoji when searching for 'bug'
        expect(labels).toContain(':bug:');
      });

      it('should cover popular matches map and return logic (lines 130-133, 137-141)', () => {
        // Search for a popular emoji to trigger the map function and return path
        const context = createMockContext(':heart', 0, 6);
        mockSearch.mockReturnValue([]); // No additional search results
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options).toBeDefined();
        expect(result?.options.length).toBeGreaterThan(0);
        
        // Verify the popular match structure (covers lines 130-133)
        const firstOption = result?.options[0];
        expect(firstOption?.label).toBeDefined();
        expect(firstOption?.detail).toBeDefined();
        expect(firstOption?.apply).toBeDefined();
        expect(firstOption?.type).toBe('variable');
      });

      it('should handle search errors and use fallback popular matches (lines 130-133, 137-141)', () => {
        // Mock search to throw an error to trigger catch block
        const context = createMockContext(':heart', 0, 6);
        mockSearch.mockImplementation(() => {
          throw new Error('Search failed');
        });
        
        const result = emojiCompletions(context);
        
        expect(result).not.toBeNull();
        expect(result?.options).toBeDefined();
        expect(result?.options.length).toBeGreaterThan(0);
        
        // Verify the fallback popular match structure (covers lines 130-133)
        const firstOption = result?.options[0];
        expect(firstOption?.label).toContain(':');
        expect(firstOption?.detail).toBeDefined();
        expect(firstOption?.apply).toBeDefined();
        expect(firstOption?.type).toBe('variable');
      });

      it('should return null when no popular matches found in error fallback (line 143)', () => {
        // Mock search to throw an error and search for something that won't match popular emojis
        const context = createMockContext(':zzzznonexistent', 0, 15);
        mockSearch.mockImplementation(() => {
          throw new Error('Search failed');
        });
        
        const result = emojiCompletions(context);
        
        expect(result).toBeNull(); // Should return null when no popular matches found
      });

      it('should execute fallback popular emoji mapping when search fails (lines 130-133, 137-141)', () => {
        // Use a query that will definitely match popular emojis (heart is in popularEmojis)
        const context = createMockContext(':heart', 0, 6);
        
        // Mock search to throw an error to trigger the catch block
        mockSearch.mockImplementation(() => {
          throw new Error('Forced search error for coverage');
        });
        
        const result = emojiCompletions(context);
        
        // Should hit the fallback and return popular matches
        expect(result).not.toBeNull();
        expect(result?.options).toBeDefined();
        expect(result?.options.length).toBeGreaterThan(0);
        
        // Verify the specific mapping structure (lines 130-133)
        const firstOption = result?.options[0];
        expect(firstOption?.label).toMatch(/^:.*:$/); // Should start and end with :
        expect(firstOption?.detail).toBeDefined(); // Should have emoji character
        expect(firstOption?.apply).toBeDefined(); // Should have apply character
        expect(firstOption?.type).toBe('variable'); // Should be variable type
        
        // Verify return structure (lines 137-141)
        expect(result?.from).toBe(0);
        expect(result?.options).toBeDefined();
      });

      it('should precisely trigger lines 130-133 and 137-141 in error fallback', () => {
        // Use 'smi' query which will match 'smile' in popularEmojis
        const context = createMockContext(':smi', 0, 4);
        
        // Mock search to throw an error to force fallback to popular emojis
        mockSearch.mockImplementation(() => {
          throw new Error('Simulated error to test fallback');
        });
        
        const result = emojiCompletions(context);
        
        // Should return popular matches (not null) even when search fails
        expect(result).not.toBeNull();
        expect(result?.options.length).toBeGreaterThan(0);
        
        // Verify the mapping done in lines 130-133
        const matchedOption = result?.options.find(opt => opt.label.includes('smile'));
        expect(matchedOption).toBeDefined();
        expect(matchedOption?.label).toBe(':smile:'); // Line 130: label: `:${name}:`
        expect(matchedOption?.detail).toBeDefined(); // Line 131: detail: char
        expect(matchedOption?.apply).toBeDefined(); // Line 132: apply: char  
        expect(matchedOption?.type).toBe('variable'); // Line 133: type: 'variable'
        
        // Verify the return structure from lines 137-141
        expect(result?.from).toBe(0); // Line 138: from: word.from
        expect(Array.isArray(result?.options)).toBe(true); // Line 139: options: popularMatches.slice(0, 20)
        expect(result?.options.length).toBeLessThanOrEqual(20); // Line 139: slice(0, 20)
      });

      it('should return null when error occurs and no popular emojis match query', () => {
        // Use a query that won't match any popular emojis to trigger line 143
        const context = createMockContext(':xyznomatch', 0, 11);
        
        // Mock search to throw an error to force fallback to popular emojis
        mockSearch.mockImplementation(() => {
          throw new Error('Simulated error to test fallback');
        });
        
        const result = emojiCompletions(context);
        
        // Should return null when no popular matches found in error fallback (line 143)
        expect(result).toBeNull();
      });

    });
  });
});