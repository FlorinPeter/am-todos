#!/bin/bash
# ESLint file checker

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

set +e
ESLINT_OUTPUT=$(npx eslint "$FILE_PATH" --format=stylish --no-error-on-unmatched-pattern 2>&1)
ESLINT_EXIT_CODE=$?
set -e

if [ -n "$ESLINT_OUTPUT" ]; then
    echo "$ESLINT_OUTPUT"
    echo ""
fi

if [ $ESLINT_EXIT_CODE -eq 0 ]; then
    if [ -z "$ESLINT_OUTPUT" ]; then
        echo "✅ PASSED"
    else
        if echo "$ESLINT_OUTPUT" | grep -q "warning"; then
            echo "❌ FAILED"
            exit 1
        else
            echo "✅ PASSED"
        fi
    fi
elif [ $ESLINT_EXIT_CODE -eq 1 ]; then
    echo "❌ FAILED"
    exit 1
elif [ $ESLINT_EXIT_CODE -eq 2 ]; then
    echo "❌ FATAL ERROR"
    exit 1
else
    echo "❌ ERROR (code $ESLINT_EXIT_CODE)"
    exit 1
fi