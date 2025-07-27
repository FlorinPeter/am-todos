#!/bin/bash
# TypeScript file checker

set -e

if [ $# -eq 0 ]; then
    echo "Error: No file path provided"
    exit 1
fi

FILE_PATH="$1"

if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File '$FILE_PATH' does not exist"
    exit 1
fi
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
    echo "✅ PASSED"
else
    echo "❌ FAILED"
    exit 1
fi
