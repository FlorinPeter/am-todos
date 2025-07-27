#!/bin/bash

# Comprehensive file checker script
# 
# This script runs both TypeScript type checking and ESLint code quality
# checks on a specific file, providing a complete validation suite.
#
# Features:
# - Runs both TypeScript and ESLint checks sequentially
# - Accepts file path as parameter with validation
# - Provides comprehensive feedback with emoji indicators
# - Shows overall pass/fail status for the file
# - Includes detailed error handling and usage examples
# - Leverages existing typecheck-file.sh and eslint-file.sh scripts
#
# Usage: ./hack/check.sh <file-path>
# 
# Examples:
#   ./hack/check.sh src/components/GitHistory.tsx
#   ./hack/check.sh src/utils/markdown.ts
#   ./hack/check.sh src/services/githubService.ts
#
# Exit codes:
#   0 - All checks passed (may include warnings)
#   1 - One or more checks failed with errors
#   2 - Invalid usage or file not found

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if file parameter is provided
if [ $# -eq 0 ]; then
    echo "Error: No file path provided"
    echo "Usage: $0 <file-path>"
    echo "Example: $0 src/components/GitHistory.tsx"
    exit 2
fi

FILE_PATH="$1"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File '$FILE_PATH' does not exist"
    exit 2
fi

# Check if required scripts exist
if [ ! -x "$SCRIPT_DIR/typecheck-file.sh" ]; then
    echo "❌ Error: typecheck-file.sh not found or not executable in $SCRIPT_DIR"
    exit 2
fi

if [ ! -x "$SCRIPT_DIR/eslint-file.sh" ]; then
    echo "❌ Error: eslint-file.sh not found or not executable in $SCRIPT_DIR"
    exit 2
fi

echo "🔍 Running comprehensive checks on: $FILE_PATH"
echo "=================================================="

# Track overall success
TYPESCRIPT_SUCCESS=0
ESLINT_SUCCESS=0
OVERALL_SUCCESS=0

# Run TypeScript check
echo ""
echo "📘 TypeScript Check:"
echo "-------------------"
if "$SCRIPT_DIR/typecheck-file.sh" "$FILE_PATH"; then
    TYPESCRIPT_SUCCESS=1
else
    echo "❌ TypeScript check failed"
    OVERALL_SUCCESS=1
fi

echo ""
echo "📋 ESLint Check:"
echo "---------------"
# Run ESLint check
if "$SCRIPT_DIR/eslint-file.sh" "$FILE_PATH"; then
    ESLINT_SUCCESS=1
else
    echo "❌ ESLint check failed"
    OVERALL_SUCCESS=1
fi

# Summary
echo ""
echo "=================================================="
echo "📊 Check Summary for: $FILE_PATH"
echo "=================================================="

if [ $TYPESCRIPT_SUCCESS -eq 1 ]; then
    echo "✅ TypeScript: PASSED"
else
    echo "❌ TypeScript: FAILED"
fi

if [ $ESLINT_SUCCESS -eq 1 ]; then
    echo "✅ ESLint: PASSED"
else
    echo "❌ ESLint: FAILED"
fi

echo ""
if [ $OVERALL_SUCCESS -eq 0 ]; then
    echo "🎉 Overall Result: ALL CHECKS PASSED"
    echo "File is ready for commit!"
else
    echo "🚨 CRITICAL: CHECKS FAILED - IMMEDIATE ACTION REQUIRED"
    echo ""
    echo "❌ YOU MUST FIX ALL ISSUES ABOVE BEFORE PROCEEDING ❌"
    echo "   → TypeScript errors prevent compilation"
    echo "   → ESLint warnings are treated as failures in this project"
    echo "   → Zero tolerance policy - ALL issues must be resolved"
    echo ""
    echo "🔧 Quick fixes for common issues:"
    echo "   → react-hooks/exhaustive-deps: Add missing dependencies"
    echo "   → @typescript-eslint/no-unused-vars: Remove or prefix with _"
    echo "   → testing-library warnings: Use proper Testing Library methods"
    echo ""
    echo "⚠️  PostToolUse Hook will BLOCK further work until this is resolved!"
fi

echo "=================================================="

exit $OVERALL_SUCCESS