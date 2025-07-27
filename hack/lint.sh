#!/bin/bash

# lint.sh - Run TypeScript and ESLint checks on all test files in src/*/__tests__/ folders

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL=0
PASSED=0
FAILED=0
FAILED_FILES=()

echo -e "${BLUE}🔍 Linting all test files in src/*/__tests__/ folders${NC}"
echo "================================================================"

# Find all test files
TEST_FILES=$(find src -path "*/__tests__/*" \( -name "*.test.ts" -o -name "*.test.tsx" \))

if [ -z "$TEST_FILES" ]; then
    echo "No test files found"
    exit 0
fi

# Check each file
while IFS= read -r file; do
    if [ -n "$file" ]; then
        echo "Checking $file..."
        TOTAL=$((TOTAL + 1))
        
        if ./hack/check.sh "$file" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}❌ FAILED${NC}"
            FAILED=$((FAILED + 1))
            FAILED_FILES+=("$file")
        fi
        echo
    fi
done <<< "$TEST_FILES"

# Summary
echo "================================================================"
echo -e "${BLUE}📊 SUMMARY${NC}"
echo "Total files: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo
    echo -e "${RED}Failed files:${NC}"
    for file in "${FAILED_FILES[@]}"; do
        echo "  ❌ $file"
    done
    echo
    echo "Run './hack/check.sh <filename>' to see specific errors"
    exit 1
else
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
fi