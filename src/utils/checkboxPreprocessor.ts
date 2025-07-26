import logger from './logger';

export interface CheckboxData {
  line: number;
  char: number;
  content: string;
  isChecked: boolean;
  cleanContent: string;
}

export interface PreprocessResult {
  processedContent: string;
  checkboxRegistry: CheckboxData[];
}

/**
 * Preprocesses markdown content to replace checkbox syntax with placeholder tokens
 * and creates a registry mapping tokens to checkbox data.
 */
export function preprocessMarkdownCheckboxes(content: string): PreprocessResult {
  if (!content || typeof content !== 'string') {
    return { processedContent: '', checkboxRegistry: [] };
  }
  const lines = content.split('\n');
  const checkboxRegistry: CheckboxData[] = [];
  const processedLines: string[] = [];

  lines.forEach((line, lineIndex) => {
    const checkboxMatch = line.match(/^(\s*-\s*)\[([x ])\](.*)$/i);
    
    if (checkboxMatch) {
      const charIndex = line.indexOf('[');
      const content = checkboxMatch[3].trim();
      const isChecked = checkboxMatch[2].toLowerCase() === 'x';
      const cleanContent = content.replace(/[^\w\s]/g, '').toLowerCase().trim();
      
      // Create registry entry
      const checkboxIndex = checkboxRegistry.length;
      checkboxRegistry.push({
        line: lineIndex,
        char: charIndex,
        content,
        isChecked,
        cleanContent
      });
      
      // Replace checkbox syntax with a unique text token that won't be processed by markdown
      const token = `XCHECKBOXX${checkboxIndex}XENDX`;
      const processedLine = `${checkboxMatch[1]}${token}`;
      processedLines.push(processedLine);
      
    } else {
      // Keep non-checkbox lines unchanged
      processedLines.push(line);
    }
  });

  const processedContent = processedLines.join('\n');
  
  return {
    processedContent,
    checkboxRegistry
  };
}

/**
 * Updates the original content with new checkbox states from the registry
 */
export function updateContentWithCheckboxStates(
  originalContent: string, 
  checkboxRegistry: CheckboxData[]
): string {
  if (!originalContent || typeof originalContent !== 'string') {
    return '';
  }
  const lines = originalContent.split('\n');
  
  checkboxRegistry.forEach((checkbox) => {
    const line = lines[checkbox.line];
    if (line && checkbox.char >= 0) {
      const checkboxMatch = line.match(/^(\s*-\s*)\[([x ])\](.*)$/i);
      if (checkboxMatch) {
        const newState = checkbox.isChecked ? 'x' : ' ';
        const newLine = `${checkboxMatch[1]}[${newState}]${checkboxMatch[3]}`;
        lines[checkbox.line] = newLine;
      }
    }
  });
  
  return lines.join('\n');
}