import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView, keymap } from '@codemirror/view';
import { insertNewlineContinueMarkup, deleteMarkupBackward } from '@codemirror/lang-markdown';
import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { history } from '@codemirror/commands';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { emojiExtension } from '../utils/emojiExtension';

// Custom theme to match the current design
const customDarkTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#111827', // gray-900
    backgroundImage: '',
    foreground: '#f9fafb', // gray-50
    caret: '#60a5fa', // blue-400
    selection: '#3b82f6cc', // blue-500 with better opacity
    selectionMatch: '#1d4ed880', // blue-700 with transparency
    lineHighlight: '#1f2937', // gray-800
    gutterBackground: '#111827', // gray-900
    gutterForeground: '#6b7280', // gray-500
    gutterActiveForeground: '#9ca3af', // gray-400
    gutterBorder: '#374151', // gray-700
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  styles: [
    { tag: t.comment, color: '#6b7280' }, // gray-500
    { tag: t.variableName, color: '#ddd6fe' }, // purple-200
    { tag: [t.string, t.special(t.brace)], color: '#86efac' }, // green-300
    { tag: t.number, color: '#fbbf24' }, // yellow-400
    { tag: t.bool, color: '#f87171' }, // red-400
    { tag: t.null, color: '#f87171' }, // red-400
    { tag: t.keyword, color: '#60a5fa' }, // blue-400
    { tag: t.operator, color: '#e5e7eb' }, // gray-200
    { tag: t.className, color: '#fbbf24' }, // yellow-400
    { tag: t.definition(t.typeName), color: '#c084fc' }, // purple-400
    { tag: t.typeName, color: '#c084fc' }, // purple-400
    { tag: t.angleBracket, color: '#9ca3af' }, // gray-400
    { tag: t.tagName, color: '#60a5fa' }, // blue-400
    { tag: t.attributeName, color: '#34d399' }, // emerald-400
    { tag: t.heading, color: '#f9fafb', fontWeight: 'bold' }, // white, bold
    { tag: t.link, color: '#60a5fa', textDecoration: 'underline' }, // blue-400
    { tag: t.emphasis, color: '#e5e7eb', fontStyle: 'italic' }, // gray-200, italic
    { tag: t.strong, color: '#f9fafb', fontWeight: 'bold' }, // white, bold
    { tag: t.strikethrough, textDecoration: 'line-through' },
  ],
});

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  readOnly?: boolean;
}

const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  placeholder,
  className,
  height = '24rem', // 384px, equivalent to h-96
  readOnly = false,
}) => {
  // Create extensions for CodeMirror
  const extensions = React.useMemo(() => {
    return [
      markdown({ 
        base: markdownLanguage, 
        codeLanguages: languages,
        addKeymap: true // Enable markdown-specific keymaps
      }),
      history(),
      emojiExtension, // Re-enabled using LanguageSupport approach
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        // Custom markdown keymaps
        {
          key: 'Enter',
          run: insertNewlineContinueMarkup
        },
        {
          key: 'Backspace',
          run: deleteMarkupBackward
        }
      ]),
      EditorView.theme({
        '&': {
          fontSize: '14px',
        },
        '.cm-focused': {
          outline: '2px solid #60a5fa', // blue-500
          outlineOffset: '2px',
        },
        '.cm-editor': {
          borderRadius: '6px',
          border: '1px solid #4b5563', // gray-600
        },
        '.cm-editor.cm-focused': {
          borderColor: '#60a5fa', // blue-500
        },
        '.cm-scroller': {
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          lineHeight: '1.5',
        },
        '.cm-content': {
          padding: '16px', // p-4
          minHeight: '100%',
        },
        '.cm-placeholder': {
          color: '#9ca3af', // gray-400
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: 'rgba(59, 130, 246, 0.4) !important', // blue-500 with proper opacity
        },
        '&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
          backgroundColor: 'rgba(59, 130, 246, 0.4) !important',
        },
        // Emoji autocomplete dropdown styling
        '.cm-tooltip': {
          backgroundColor: '#1f2937 !important', // gray-800
          border: '1px solid #374151 !important', // gray-700
          borderRadius: '6px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
        '.cm-tooltip.cm-tooltip-autocomplete': {
          backgroundColor: '#1f2937 !important', // gray-800
        },
        '.cm-completionLabel': {
          color: '#f9fafb !important', // gray-50
          fontSize: '14px',
        },
        '.cm-completionDetail': {
          color: '#9ca3af !important', // gray-400
          fontSize: '12px',
        },
        '.cm-completionIcon': {
          display: 'none', // Hide default icons since we have emoji
        },
        '.cm-tooltip-autocomplete ul': {
          maxHeight: '200px',
          overflow: 'auto',
        },
        '.cm-tooltip-autocomplete li': {
          padding: '4px 8px',
          borderRadius: '4px',
          margin: '1px',
        },
        '.cm-tooltip-autocomplete li[aria-selected]': {
          backgroundColor: '#374151 !important', // gray-700
          color: '#f9fafb !important', // gray-50
        }
      }),
      EditorView.lineWrapping,
      readOnly ? EditorView.editable.of(false) : [],
      placeholder ? EditorView.theme({
        '.cm-placeholder': {
          color: '#9ca3af',
        }
      }) : [],
    ].flat().filter(Boolean);
  }, [readOnly, placeholder]);

  const handleChange = React.useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  return (
    <div className={className} data-testid="codemirror-editor">
      <CodeMirror
        value={value || ''}
        height={height}
        theme={customDarkTheme}
        extensions={extensions}
        onChange={handleChange}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false, // Disabled since we're using custom emoji extension
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          searchKeymap: false, // Disabled to avoid conflict with task list search (Ctrl/Cmd+F)
          tabSize: 2,
          rectangularSelection: true,
          crosshairCursor: true,
        }}
        style={{
          fontSize: '14px',
          backgroundColor: '#111827',
        }}
      />
    </div>
  );
};

export default CodeMirrorEditor;