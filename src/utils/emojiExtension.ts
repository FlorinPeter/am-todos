// Working emoji autocompletion extension for CodeMirror 6
import { Extension } from '@codemirror/state';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { search } from 'node-emoji';

// Define popular emojis as a static list
const popularEmojis = [
  { name: 'thumbsup', char: '👍' },
  { name: '+1', char: '👍' },
  { name: 'thumbsdown', char: '👎' },
  { name: '-1', char: '👎' },
  { name: 'heart', char: '❤️' },
  { name: 'fire', char: '🔥' },
  { name: 'rocket', char: '🚀' },
  { name: 'star', char: '⭐' },
  { name: 'smile', char: '😄' },
  { name: 'laughing', char: '😆' },
  { name: 'wink', char: '😉' },
  { name: 'grin', char: '😁' },
  { name: 'joy', char: '😂' },
  { name: 'heart_eyes', char: '😍' },
  { name: 'sunglasses', char: '😎' },
  { name: 'thinking_face', char: '🤔' },
  { name: 'tada', char: '🎉' },
  { name: 'clap', char: '👏' },
  { name: 'raised_hands', char: '🙌' },
  { name: 'ok_hand', char: '👌' },
  { name: 'muscle', char: '💪' },
  { name: 'wave', char: '👋' },
  { name: 'point_right', char: '👉' },
  { name: 'point_left', char: '👈' },
  { name: 'point_up', char: '👆' },
  { name: 'point_down', char: '👇' },
  { name: 'check', char: '✅' },
  { name: 'x', char: '❌' },
  { name: 'warning', char: '⚠️' },
  { name: 'exclamation', char: '❗' },
  { name: 'question', char: '❓' },
  { name: 'heavy_check_mark', char: '✔️' },
  { name: 'bug', char: '🐛' },
  { name: 'wrench', char: '🔧' },
  { name: 'gear', char: '⚙️' },
  { name: 'hammer', char: '🔨' },
  { name: 'computer', char: '💻' },
  { name: 'phone', char: '📱' },
  { name: 'email', char: '📧' }
];

// Create a completion source function
export function emojiCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/:[a-zA-Z0-9_+-]*$/);
  if (!word) return null;
  if (word.from === word.to && !context.explicit) return null;

  const query = word.text.slice(1); // Remove the ':' prefix
  
  // If query is empty, show popular emojis first
  if (query === '') {
    const popularMatches = popularEmojis.map(({ name, char }) => ({
      label: `:${name}:`,
      detail: char,
      apply: char,
      type: 'variable'
    }));
    
    return {
      from: word.from,
      options: popularMatches.slice(0, 20) // Limit to 20 popular emojis
    };
  }

  try {
    // Check popular emojis for matches first (this handles special cases like +1, -1)
    const popularMatches = popularEmojis
      .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
      .map(({ name, char }) => ({
        label: `:${name}:`,
        detail: char,
        apply: char,
        type: 'variable'
      }));

    let searchMatches: any[] = [];
    
    // Only use node-emoji search if query doesn't contain regex special characters
    // or if popular matches didn't find anything
    if (popularMatches.length === 0 && !/[+\-.*?^${}()|[\]\\]/.test(query)) {
      try {
        const searchResults = search(query);
        searchMatches = searchResults.slice(0, 50).map(result => ({
          label: `:${result.name}:`,
          detail: result.emoji,
          apply: result.emoji,
          type: 'variable'
        }));
      } catch (searchError) {
        console.warn('Node-emoji search failed:', searchError);
        // Continue with just popular matches
      }
    }

    // Combine and deduplicate results
    const allMatches = [...popularMatches, ...searchMatches];
    const uniqueMatches = allMatches.filter((match, index, arr) => 
      arr.findIndex(m => m.label === match.label) === index
    );

    if (uniqueMatches.length === 0) return null;

    return {
      from: word.from,
      options: uniqueMatches.sort((a, b) => {
        // Sort by relevance: exact match first, then alphabetical
        const aName = a.label.slice(1, -1); // Remove colons
        const bName = b.label.slice(1, -1);
        
        if (aName === query) return -1;
        if (bName === query) return 1;
        if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
        if (bName.startsWith(query) && !aName.startsWith(query)) return 1;
        return aName.localeCompare(bName);
      }).slice(0, 50) // Limit to 50 results
    };
  } catch (error) {
    console.warn('Emoji search error:', error);
    // Fallback to just popular emoji matching
    const popularMatches = popularEmojis
      .filter(({ name }) => name.toLowerCase().includes(query.toLowerCase()))
      .map(({ name, char }) => ({
        label: `:${name}:`,
        detail: char,
        apply: char,
        type: 'variable'
      }));
    
    if (popularMatches.length > 0) {
      return {
        from: word.from,
        options: popularMatches.slice(0, 20)
      };
    }
    
    return null;
  }
}

// Create the emoji extension
export const emojiExtension: Extension = [
  autocompletion({
    override: [emojiCompletions],
    maxRenderedOptions: 20,
    closeOnBlur: true,
    defaultKeymap: true
  })
];

export default emojiExtension;