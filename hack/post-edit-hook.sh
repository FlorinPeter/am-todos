#!/bin/bash

# PostToolUse hook for Edit, MultiEdit, and Write tools
# This script runs after file modifications and executes check.sh on TypeScript/JavaScript files only
# 
# The hook receives JSON input containing tool_input and tool_response information
# We extract the file_path from the tool_input and run our check script on it

# Read the JSON input from stdin
input=$(cat)

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

# Check if we got a valid file path
if [ -n "$file_path" ] && [ "$file_path" != "null" ] && [ "$file_path" != "empty" ]; then
    # Check if the file is a TypeScript or JavaScript file
    case "$file_path" in
        *.ts|*.tsx|*.js|*.jsx)
            echo "🔍 PostToolUse Hook: Running check on modified file: $file_path" >&2
            echo "==================================================" >&2
            
            # Get the directory where this script is located
            SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            
            # Run the check script on the modified file
            if [ -x "$SCRIPT_DIR/check.sh" ]; then
                "$SCRIPT_DIR/check.sh" "$file_path" 2>&1
                exit_code=$?
                echo "==================================================" >&2
                
                # CRITICAL: Exit with the actual check result to enforce error correction
                if [ $exit_code -ne 0 ]; then
                    echo "🚨 CRITICAL: PostToolUse Hook FAILED - YOU MUST fix all errors and warnings before proceeding!" >&2
                    echo "   → Run: ./hack/check.sh $(basename "$file_path")" >&2
                    echo "   → Fix ALL issues shown above" >&2
                    echo "   → YOU must address every error and warning immediately" >&2
                    exit 1
                fi
                exit 0
            else
                echo "❌ Error: check.sh not found or not executable in $SCRIPT_DIR" >&2
                exit 1
            fi
            ;;
        *)
            # Silently skip non-TypeScript/JavaScript files
            exit 0
            ;;
    esac
else
    # Silently exit if no valid file path found
    exit 0
fi