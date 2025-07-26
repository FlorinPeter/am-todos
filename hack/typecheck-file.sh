#!/bin/bash

# TypeScript file checker script
# 
# This script runs TypeScript compilation check on a specific file with
# React-compatible settings optimized for component development.
#
# Features:
# - Runs TypeScript check without emitting output files (--noEmit)
# - Skips type checking of declaration files for performance (--skipLibCheck)
# - Configured for React JSX syntax (--jsx react-jsx)
# - Targets ES2015 for modern browser compatibility
# - Enables synthetic default imports for better module interop
# - Uses Node.js module resolution strategy
#
# Usage: ./hack/typecheck-file.sh <file-path>
# 
# Examples:
#   ./hack/typecheck-file.sh src/components/GitHistory.tsx
#   ./hack/typecheck-file.sh src/utils/markdown.ts
#   ./hack/typecheck-file.sh src/services/githubService.ts

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

echo "🔍 Running TypeScript check on: $FILE_PATH"

# Run TypeScript compiler with proven working parameters
# These parameters ensure zero TypeScript errors for both regular and test files
# Includes vitest globals for test files and skips lib checks for performance
npx tsc \
    --noEmit \
    --skipLibCheck \
    --esModuleInterop \
    --allowSyntheticDefaultImports \
    --jsx react-jsx \
    --target es2020 \
    --module esnext \
    --moduleResolution node \
    --types "vitest/globals" \
    "$FILE_PATH"

if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed for: $FILE_PATH"
else
    echo "❌ TypeScript check failed for: $FILE_PATH"
    exit 1
fi
