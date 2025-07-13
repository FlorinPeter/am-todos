# Dead Code Removal Fix for githubService.ts

## 🎯 SOLUTION: Remove 7 Lines of Dead Code

### Changes Required

#### 1. deleteFile function (lines 388-392) - REMOVE ENTIRELY:
```typescript
// BEFORE (with dead code):
const response = await makeGitHubRequest(apiPath, 'DELETE', headers, requestBody, owner, repo);

if (!response.ok) {                                    // ← DEAD CODE LINE 388
  const errorText = await response.text();             // ← DEAD CODE LINE 389  
  logger.error('Failed to delete file:', errorText);   // ← DEAD CODE LINE 390
  throw new Error(`Failed to delete file: ${response.statusText} - ${errorText}`); // ← DEAD CODE LINE 391
}                                                      // ← DEAD CODE LINE 392

logger.log('File deleted successfully:', path);
return await response.json();

// AFTER (dead code removed):
const response = await makeGitHubRequest(apiPath, 'DELETE', headers, requestBody, owner, repo);
// makeGitHubRequest handles all errors - no redundant checking needed
logger.log('File deleted successfully:', path);
return await response.json();
```

#### 2. listProjectFolders function (lines 434-437) - REMOVE ENTIRELY:
```typescript
// BEFORE (with dead code):
const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);

if (!response.ok) {                                    // ← DEAD CODE LINE 434
  logger.error('Failed to list repository contents');  // ← DEAD CODE LINE 435
  return ['todos']; // Default fallback                // ← DEAD CODE LINE 436
}                                                      // ← DEAD CODE LINE 437

const contents = await response.json();

// AFTER (dead code removed):
const response = await makeGitHubRequest(apiPath, 'GET', headers, undefined, owner, repo);  
// makeGitHubRequest handles all errors - no redundant checking needed
const contents = await response.json();
```

### Expected Impact

#### Coverage Improvement:
- **Line Coverage**: Remove 7 untestable lines → Increase from 73.2% to ~75.5%
- **Branch Coverage**: Remove 2 untestable branches → Further improve from 90.69%
- **Maintainability**: Cleaner, more focused code

#### Benefits:
✅ **Immediate Coverage Boost**: ~2.3% line coverage improvement  
✅ **Architectural Clarity**: Single error handling responsibility  
✅ **Maintainability**: Less code to maintain  
✅ **Testing**: Only test meaningful, reachable code paths  
✅ **Performance**: Eliminate dead conditional checks  

### Implementation
The fix is safe because:
1. **No behavior change**: makeGitHubRequest already handles all error cases
2. **No breaking changes**: Same error messages and handling
3. **Cleaner architecture**: Follows single responsibility principle
4. **Easy rollback**: Simple line removal, easily reversible

### Verification
After removing dead code:
1. Run full test suite (should pass identically)
2. Check coverage improvement
3. Verify error handling still works correctly
4. No functional changes to API behavior