#!/bin/bash

# ESLint file checker script
# 
# This script runs ESLint on a specific file with the project's
# configuration settings for consistent code quality checking.
#
# Features:
# - Runs ESLint with project configuration on individual files
# - Accepts file path as parameter with validation
# - Provides clear success/error feedback with emoji indicators
# - Distinguishes between warnings and errors
# - Includes comprehensive error handling and usage examples
# - Uses existing ESLint configuration from the project
#
# Usage: ./hack/eslint-file.sh <file-path>
# 
# Examples:
#   ./hack/eslint-file.sh src/components/GitHistory.tsx
#   ./hack/eslint-file.sh src/utils/markdown.ts
#   ./hack/eslint-file.sh src/services/githubService.ts
#
# For checking multiple files or entire directories, use:
#   npm run lint           # Check all files in src/
#   npm run lint:fix       # Check and auto-fix all files in src/

set -e

# Check if file parameter is provided
if [ $# -eq 0 ]; then
    echo "Error: No file path provided"
    echo "Usage: $0 <file-path>"
    echo "Example: $0 src/components/GitHistory.tsx"
    exit 1
fi

FILE_PATH="$1"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File '$FILE_PATH' does not exist"
    exit 1
fi

echo "🔍 Running ESLint check on: $FILE_PATH"

# Check if ESLint is available
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npx is not available. Please install Node.js and npm."
    exit 1
fi

# Run ESLint on the specified file
# Capture both stdout and stderr, and the exit code
ESLINT_OUTPUT=$(npx eslint "$FILE_PATH" 2>&1)
ESLINT_EXIT_CODE=$?

# Print the ESLint output
if [ -n "$ESLINT_OUTPUT" ]; then
    echo "$ESLINT_OUTPUT"
    echo ""
fi

# Handle the results based on exit code
if [ $ESLINT_EXIT_CODE -eq 0 ]; then
    if [ -z "$ESLINT_OUTPUT" ]; then
        echo "✅ ESLint check passed with no issues for: $FILE_PATH"
    else
        echo "⚠️  ESLint check passed with warnings for: $FILE_PATH"
    fi
elif [ $ESLINT_EXIT_CODE -eq 1 ]; then
    echo "❌ ESLint check failed with errors for: $FILE_PATH"
    exit 1
else
    echo "❌ ESLint encountered an unexpected error for: $FILE_PATH"
    exit 1
fi