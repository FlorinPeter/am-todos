import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock node-emoji module
vi.mock('node-emoji', () => ({
  search: vi.fn(),
  get: vi.fn()
}));

// Mock CodeMirror dependencies
vi.mock('@codemirror/autocomplete', () => ({
  autocompletion: vi.fn(),
  completionKeymap: vi.fn(),
  CompletionContext: vi.fn(),
  CompletionResult: vi.fn()
}));

vi.mock('@codemirror/state', () => ({
  Extension: class Extension {}
}));

vi.mock('@codemirror/view', () => ({
  ViewPlugin: vi.fn(),
  EditorView: vi.fn()
}));

// Import after mocks are set up
import { emojiExtension } from '../emojiExtension';

describe('emojiExtension', () => {
  let mockAutocompletion: any;
  let mockSearch: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get mocked functions after clearing
    const autocompleteMod = await vi.importMock('@codemirror/autocomplete');
    const nodeEmojiMod = await vi.importMock('node-emoji');
    
    mockAutocompletion = autocompleteMod.autocompletion;
    mockSearch = nodeEmojiMod.search;
    
    mockAutocompletion.mockReturnValue(['mocked-extension']);
  });

  describe('Extension Creation', () => {
    it('should create emoji extension with autocompletion configuration', () => {
      expect(emojiExtension).toBeDefined();
      expect(mockAutocompletion).toHaveBeenCalledWith({
        override: [expect.any(Function)],
        maxRenderedOptions: 20,
        closeOnBlur: true,
        defaultKeymap: true
      });
    });

    it('should export extension as default', async () => {
      const defaultExport = (await import('../emojiExtension')).default;
      expect(defaultExport).toBe(emojiExtension);
    });
  });

  describe('emojiCompletions Function', () => {
    // Get the completion function that was passed to autocompletion
    let emojiCompletions: Function;

    beforeEach(() => {
      // Extract the completion function from the mock call
      const autocompletionCalls = mockAutocompletion.mock.calls;
      if (autocompletionCalls.length > 0) {
        emojiCompletions = autocompletionCalls[0][0].override[0];
      }
    });

    describe('Context Matching', () => {
      it('should return null when no colon prefix is found', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue(null),
          explicit: false
        };

        const result = emojiCompletions(mockContext);

        expect(result).toBeNull();
        expect(mockContext.matchBefore).toHaveBeenCalledWith(/:[a-zA-Z0-9_+-]*$/);
      });

      it('should return null when match is at cursor but not explicit', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 5, text: ':' }),
          explicit: false
        };

        const result = emojiCompletions(mockContext);

        expect(result).toBeNull();
      });

      it('should proceed when match exists and has content', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 8, text: ':smi' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result).not.toBeNull();
      });
    });

    describe('Popular Emoji Handling', () => {
      it('should return popular emojis when query is empty', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 6, text: ':' }),
          explicit: true
        };

        const result = emojiCompletions(mockContext);

        expect(result).toEqual({
          from: 5,
          options: expect.arrayContaining([
            expect.objectContaining({
              label: ':thumbsup:',
              detail: '👍',
              apply: '👍',
              type: 'variable'
            }),
            expect.objectContaining({
              label: ':heart:',
              detail: '❤️',
              apply: '❤️',
              type: 'variable'
            })
          ])
        });

        // Should limit to 20 popular emojis
        expect(result.options.length).toBeLessThanOrEqual(20);
      });

      it('should filter popular emojis by query', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 9, text: ':thu' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result).toEqual({
          from: 5,
          options: expect.arrayContaining([
            expect.objectContaining({
              label: ':thumbsup:',
              detail: '👍',
              apply: '👍',
              type: 'variable'
            }),
            expect.objectContaining({
              label: ':thumbsdown:',
              detail: '👎',
              apply: '👎',
              type: 'variable'
            })
          ])
        });
      });

      it('should handle case-insensitive popular emoji matching', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 9, text: ':THU' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result.options.some(option => 
          option.label === ':thumbsup:' || option.label === ':thumbsdown:'
        )).toBe(true);
      });
    });

    describe('Node-Emoji Search Integration', () => {
      it('should use node-emoji search when no popular matches found', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 12, text: ':unicorn' }),
          explicit: false
        };

        const mockSearchResults = [
          { key: 'unicorn', emoji: '🦄' },
          { key: 'unicorn_face', emoji: '🦄' }
        ];
        mockSearch.mockReturnValue(mockSearchResults);

        const result = emojiCompletions(mockContext);

        expect(mockSearch).toHaveBeenCalledWith('unicorn');
        expect(result).toEqual({
          from: 5,
          options: expect.arrayContaining([
            expect.objectContaining({
              label: ':unicorn:',
              detail: '🦄',
              apply: '🦄',
              type: 'variable'
            }),
            expect.objectContaining({
              label: ':unicorn_face:',
              detail: '🦄',
              apply: '🦄',
              type: 'variable'
            })
          ])
        });
      });

      it('should limit node-emoji search results to 50', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 12, text: ':common' }),
          explicit: false
        };

        // Create 100 mock results
        const manyResults = Array.from({ length: 100 }, (_, i) => ({
          key: `emoji${i}`,
          emoji: '😀'
        }));
        mockSearch.mockReturnValue(manyResults);

        const result = emojiCompletions(mockContext);

        expect(result.options.length).toBeLessThanOrEqual(50);
      });

      it('should skip node-emoji search for regex special characters', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 12, text: ':test+1' }),
          explicit: false
        };

        const result = emojiCompletions(mockContext);

        expect(mockSearch).not.toHaveBeenCalled();
      });

      it('should handle node-emoji search errors gracefully', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 12, text: ':search' }),
          explicit: false
        };

        mockSearch.mockImplementation(() => {
          throw new Error('Search failed');
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = emojiCompletions(mockContext);

        expect(consoleSpy).toHaveBeenCalledWith('Node-emoji search failed:', expect.any(Error));
        expect(result).toBeDefined(); // Should still return popular matches

        consoleSpy.mockRestore();
      });
    });

    describe('Result Processing', () => {
      it('should combine and deduplicate popular and search results', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 10, text: ':fire' }),
          explicit: false
        };

        const mockSearchResults = [
          { key: 'fire', emoji: '🔥' }, // This matches popular emoji
          { key: 'fireworks', emoji: '🎆' }
        ];
        mockSearch.mockReturnValue(mockSearchResults);

        const result = emojiCompletions(mockContext);

        // Should only have one 'fire' entry despite being in both popular and search results
        const fireMatches = result.options.filter(option => option.label === ':fire:');
        expect(fireMatches.length).toBe(1);
      });

      it('should sort results by relevance', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 10, text: ':star' }),
          explicit: false
        };

        const mockSearchResults = [
          { key: 'superstar', emoji: '🌟' },
          { key: 'star', emoji: '⭐' }, // Exact match should come first
          { key: 'starfish', emoji: '⭐' }
        ];
        mockSearch.mockReturnValue(mockSearchResults);

        const result = emojiCompletions(mockContext);

        // Exact match should be first, then prefix matches, then alphabetical
        expect(result.options[0].label).toBe(':star:');
      });

      it('should limit final results to 50', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 7, text: ':e' }),
          explicit: false
        };

        // Create many search results
        const manyResults = Array.from({ length: 60 }, (_, i) => ({
          key: `emoji_${i}`,
          emoji: '😀'
        }));
        mockSearch.mockReturnValue(manyResults);

        const result = emojiCompletions(mockContext);

        expect(result.options.length).toBeLessThanOrEqual(50);
      });

      it('should return null when no matches found', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 15, text: ':nonexist' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should handle general errors and fallback to popular emojis', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 10, text: ':fire' }),
          explicit: false
        };

        // Mock a general error (not just search error)
        mockSearch.mockImplementation(() => {
          throw new Error('General error');
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = emojiCompletions(mockContext);

        expect(consoleSpy).toHaveBeenCalledWith('Emoji search error:', expect.any(Error));
        
        // Should still return popular emoji matches
        expect(result).toEqual({
          from: 5,
          options: expect.arrayContaining([
            expect.objectContaining({
              label: ':fire:',
              detail: '🔥',
              apply: '🔥',
              type: 'variable'
            })
          ])
        });

        consoleSpy.mockRestore();
      });

      it('should return null when error occurs and no popular matches', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 15, text: ':randomxyz' }),
          explicit: false
        };

        mockSearch.mockImplementation(() => {
          throw new Error('Search error');
        });

        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = emojiCompletions(mockContext);

        expect(result).toBeNull();

        consoleSpy.mockRestore();
      });
    });

    describe('Special Character Handling', () => {
      it('should handle +1 popular emoji correctly', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 8, text: ':+1' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result.options.some(option => 
          option.label === ':+1:' || option.label === ':thumbsup:'
        )).toBe(true);
      });

      it('should handle -1 popular emoji correctly', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 8, text: ':-1' }),
          explicit: false
        };

        mockSearch.mockReturnValue([]);

        const result = emojiCompletions(mockContext);

        expect(result.options.some(option => 
          option.label === ':-1:' || option.label === ':thumbsdown:'
        )).toBe(true);
      });

      it('should not call node-emoji search for queries with special regex characters', () => {
        const specialChars = ['+', '-', '*', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'];
        
        specialChars.forEach(char => {
          const mockContext = {
            matchBefore: vi.fn().mockReturnValue({ from: 5, to: 8, text: `:${char}` }),
            explicit: false
          };

          mockSearch.mockClear();
          emojiCompletions(mockContext);

          expect(mockSearch).not.toHaveBeenCalled();
        });
      });
    });

    describe('Popular Emoji List', () => {
      it('should include essential popular emojis', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 6, text: ':' }),
          explicit: true
        };

        const result = emojiCompletions(mockContext);

        const expectedEmojis = [
          ':thumbsup:', ':thumbsdown:', ':heart:', ':fire:', ':rocket:',
          ':star:', ':smile:', ':tada:', ':check:', ':x:'
        ];

        expectedEmojis.forEach(emoji => {
          expect(result.options.some(option => option.label === emoji)).toBe(true);
        });
      });

      it('should include development-related emojis', () => {
        const mockContext = {
          matchBefore: vi.fn().mockReturnValue({ from: 5, to: 6, text: ':' }),
          explicit: true
        };

        const result = emojiCompletions(mockContext);

        const devEmojis = [':bug:', ':wrench:', ':gear:', ':hammer:', ':computer:'];

        devEmojis.forEach(emoji => {
          expect(result.options.some(option => option.label === emoji)).toBe(true);
        });
      });
    });
  });

  describe('Integration', () => {
    it('should work with CodeMirror autocompletion system', () => {
      expect(mockAutocompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          override: expect.arrayContaining([expect.any(Function)]),
          maxRenderedOptions: 20,
          closeOnBlur: true,
          defaultKeymap: true
        })
      );
    });

    it('should provide completion function that returns proper structure', () => {
      const autocompletionConfig = mockAutocompletion.mock.calls[0][0];
      const completionFunction = autocompletionConfig.override[0];

      const mockContext = {
        matchBefore: vi.fn().mockReturnValue({ from: 5, to: 6, text: ':' }),
        explicit: true
      };

      const result = completionFunction(mockContext);

      expect(result).toEqual(
        expect.objectContaining({
          from: expect.any(Number),
          options: expect.arrayContaining([
            expect.objectContaining({
              label: expect.any(String),
              detail: expect.any(String),
              apply: expect.any(String),
              type: 'variable'
            })
          ])
        })
      );
    });
  });
});