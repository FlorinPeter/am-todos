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
            echo "🔍 PostToolUse: Running check on modified file: $file_path" >&2
            
            # Get the directory where this script is located
            SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            
            # Run the check script on the modified file
            if [ -x "$SCRIPT_DIR/check.sh" ]; then
                # Capture the output so we can show it to Claude
                check_output=$("$SCRIPT_DIR/check.sh" "$file_path" 2>&1)
                exit_code=$?
                
                # Always show the detailed output to Claude
                echo "$check_output"
                
                # Don't exit with error - just show the results to Claude
                # This allows Claude to see what needs to be fixed
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
