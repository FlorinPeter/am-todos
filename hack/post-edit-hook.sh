#!/bin/bash

# PostToolUse hook for Edit, MultiEdit, and Write tools
# This script runs after file modifications and executes check.sh on the modified file
# 
# The hook receives JSON input containing tool_input and tool_response information
# We extract the file_path from the tool_input and run our check script on it

# Debug: Log the input to help troubleshoot
echo "🔍 PostToolUse Hook: Started" >&2

# Read the JSON input from stdin
input=$(cat)

# Debug: Show what we received (first 200 chars)
echo "📥 Received input: ${input:0:200}..." >&2

# Try multiple ways to extract the file path
file_path=""
if command -v jq >/dev/null 2>&1; then
    # Try with jq first
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    
    # If that didn't work, try other possible locations
    if [ -z "$file_path" ] || [ "$file_path" = "null" ]; then
        file_path=$(echo "$input" | jq -r '.file_path // empty' 2>/dev/null)
    fi
else
    # Fallback: simple grep-based extraction
    file_path=$(echo "$input" | grep -o '"file_path":\s*"[^"]*"' | sed 's/.*"file_path":\s*"\([^"]*\)".*/\1/')
fi

echo "📄 Extracted file_path: '$file_path'" >&2

# Check if we got a valid file path
if [ -n "$file_path" ] && [ "$file_path" != "null" ] && [ "$file_path" != "empty" ]; then
    echo "🔍 PostToolUse Hook: Running check on modified file: $file_path" >&2
    
    # Get the directory where this script is located
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Run the check script on the modified file
    if [ -x "$SCRIPT_DIR/check.sh" ]; then
        "$SCRIPT_DIR/check.sh" "$file_path" 2>&1
        exit_code=$?
        echo "✅ Check completed with exit code: $exit_code" >&2
        exit 0
    else
        echo "❌ Error: check.sh not found or not executable in $SCRIPT_DIR" >&2
        exit 1
    fi
else
    echo "⚠️  PostToolUse Hook: No valid file path found in tool input, skipping check" >&2
    echo "   Raw input was: $input" >&2
    exit 0
fi