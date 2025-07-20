const fs = require('fs');

// List of files to fix
const filesToFix = [
  'src/services/__tests__/aiService.integration.test.ts',
  'src/services/__tests__/githubService.errorHandling.test.ts',
  'src/services/__tests__/versionService.test.ts'
];

filesToFix.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix AI service tests - add timeout and signal to expectations
    content = content.replace(
      /expect\(mockFetch\)\.toHaveBeenCalledWith\('\/api\/ai',\s*\{([^}]+)\}\)/g,
      (match, props) => {
        if (props.includes('timeout:') || props.includes('signal:')) {
          return match; // Already fixed
        }
        return `expect(mockFetch).toHaveBeenCalledWith('/api/ai', {${props},
        timeout: 120000,
        signal: expect.any(AbortSignal)
      })`;
      }
    );
    
    // Fix GitHub service tests - add timeout and signal
    content = content.replace(
      /expect\(mockFetch\)\.toHaveBeenCalledWith\(\s*'\/api\/file-at-commit',\s*\{([^}]+)\}\)/g,
      (match, props) => {
        if (props.includes('timeout:') || props.includes('signal:')) {
          return match; // Already fixed
        }
        return `expect(mockFetch).toHaveBeenCalledWith(
        '/api/file-at-commit',
        {${props},
          timeout: 30000,
          signal: expect.any(AbortSignal)
        }
      )`;
      }
    );
    
    // Fix version service tests - add timeout and signal
    content = content.replace(
      /expect\(mockFetch\)\.toHaveBeenCalledWith\('\/api\/version'\)/g,
      "expect(mockFetch).toHaveBeenCalledWith('/api/version', {\n      timeout: 10000,\n      signal: expect.any(AbortSignal)\n    })"
    );
    
    // Fix error messages
    content = content.replace(
      /\.rejects\.toThrow\('AI API error: Too Many Requests'\)/g,
      ".rejects.toThrow('HTTP error! status: 429')"
    );
    
    content = content.replace(
      /\.rejects\.toThrow\('AI API error: Payload Too Large'\)/g,
      ".rejects.toThrow('HTTP error! status: 413')"
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  } catch (error) {
    console.log(`Error fixing ${filePath}:`, error.message);
  }
});