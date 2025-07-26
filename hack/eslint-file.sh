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
# - Distinguishes between warnings and errors with improved detection
# - Shows detailed warning messages including TypeScript ESLint rules
# - Uses stylish formatter for better readability
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

# Run ESLint on the specified file with better formatting
# Capture both stdout and stderr, and the exit code
# Temporarily disable set -e to capture ESLint output even when it returns non-zero exit code
set +e
ESLINT_OUTPUT=$(npx eslint "$FILE_PATH" --format=stylish --no-error-on-unmatched-pattern 2>&1)
ESLINT_EXIT_CODE=$?
set -e

# Print the ESLint output
if [ -n "$ESLINT_OUTPUT" ]; then
    echo "$ESLINT_OUTPUT"
    echo ""
fi

# Handle the results based on exit code
# Note: ESLint exit codes: 0 = no issues, 1 = linting errors, 2 = fatal errors
if [ $ESLINT_EXIT_CODE -eq 0 ]; then
    if [ -z "$ESLINT_OUTPUT" ]; then
        echo "✅ ESLint check passed with no issues for: $FILE_PATH"
    else
        # Check if output contains warnings (but no errors since exit code is 0)
        if echo "$ESLINT_OUTPUT" | grep -q "warning"; then
            echo "❌ ESLint check failed with warnings for: $FILE_PATH"
            exit 1
        else
            echo "✅ ESLint check passed with no issues for: $FILE_PATH"
        fi
    fi
elif [ $ESLINT_EXIT_CODE -eq 1 ]; then
    # Check if we have both errors and warnings or just errors
    if echo "$ESLINT_OUTPUT" | grep -q "error"; then
        echo "❌ ESLint check failed with errors for: $FILE_PATH"
    else
        echo "❌ ESLint check failed for: $FILE_PATH"
    fi
    exit 1
elif [ $ESLINT_EXIT_CODE -eq 2 ]; then
    echo "❌ ESLint encountered a fatal error for: $FILE_PATH"
    exit 1
else
    echo "❌ ESLint encountered an unexpected error (exit code $ESLINT_EXIT_CODE) for: $FILE_PATH"
    exit 1
fi