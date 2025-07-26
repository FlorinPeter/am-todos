#!/bin/bash

# =============================================================================
# Comprehensive Migration Script Test Suite
# =============================================================================
# 
# This script creates various test scenarios to verify the migration script
# handles all edge cases properly before production use.
#
# =============================================================================

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly TEST_DIR="test-scenarios"
readonly MIGRATION_SCRIPT="$SCRIPT_DIR/migrate-v1-to-v2.sh"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

log() {
    local level="$1"
    shift
    local message="$*"
    
    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "TEST")  echo -e "${BLUE}[TEST]${NC} $message" ;;
        "PASS")  echo -e "${GREEN}[PASS]${NC} $message" ;;
        "FAIL")  echo -e "${RED}[FAIL]${NC} $message" ;;
        *)       echo -e "$message" ;;
    esac
}

setup_test_environment() {
    log "INFO" "Setting up comprehensive test environment..."
    
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR" .migration-backup migration-*.log
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
}

create_v1_file() {
    local filename="$1"
    local title="$2"
    local priority="$3"
    local created_at="$4"
    local is_archived="$5"
    local content="$6"
    local has_chat="${7:-false}"
    
    # Create parent directory if it doesn't exist
    mkdir -p "$(dirname "$filename")"
    
    local chat_history=""
    if [ "$has_chat" = "true" ]; then
        chat_history='
chatHistory:
  - role: "user"
    content: "Test chat message"
    timestamp: "2025-07-24T10:00:00.000Z"
  - role: "assistant" 
    content: "AI response with special chars: éñ中文🚀"
    timestamp: "2025-07-24T10:01:00.000Z"'
    fi
    
    cat > "$filename" <<EOF
---
title: '$title'
createdAt: '$created_at'
priority: $priority
isArchived: $is_archived$chat_history
---

$content
EOF
}

test_basic_functionality() {
    log "TEST" "Testing basic V1 to V2 migration..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario1
    cd scenario1
    
    # Create basic V1 files
    create_v1_file "2025-07-24-basic-task.md" "Basic Task" 3 "2025-07-24T10:00:00.000Z" false "# Basic Task\n\n- [ ] Item 1\n- [ ] Item 2"
    create_v1_file "2025-07-23-high-priority.md" "High Priority Task" 2 "2025-07-23T15:30:00.000Z" false "# High Priority\n\nUrgent task content."
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario1 > /dev/null 2>&1; then
        # Verify results
        if [[ -f "scenario1/P3--2025-07-24--Basic_Task.md" && -f "scenario1/P2--2025-07-23--High_Priority_Task.md" ]]; then
            log "PASS" "Basic migration successful"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log "FAIL" "Basic migration files not created correctly"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "Basic migration script failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_archive_folder_scenarios() {
    log "TEST" "Testing archive folder handling..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario2/{archive}
    cd scenario2
    
    # Create files that should be archived (isArchived: true)
    create_v1_file "2025-07-20-should-archive.md" "Should Archive" 4 "2025-07-20T12:00:00.000Z" true "# Archived Task\n\nThis should move to archive folder."
    
    # Create files already in archive folder
    create_v1_file "archive/2025-07-19-already-archived.md" "Already Archived" 5 "2025-07-19T09:00:00.000Z" false "# Already in Archive\n\nThis is already in archive."
    
    # Create active file
    create_v1_file "2025-07-22-active-task.md" "Active Task" 1 "2025-07-22T14:00:00.000Z" false "# Active Task\n\nThis should stay active."
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario2 > /dev/null 2>&1; then
        local pass=true
        
        # Check archived file moved to archive with V2 format
        if [[ ! -f "scenario2/archive/P4--2025-07-20--Should_Archive.md" ]]; then
            log "FAIL" "Archived file not moved to archive folder correctly"
            pass=false
        fi
        
        # Check already archived file converted in place
        if [[ ! -f "scenario2/archive/P5--2025-07-19--Already_Archived.md" ]]; then
            log "FAIL" "Already archived file not converted correctly"
            pass=false
        fi
        
        # Check active file stays in main folder
        if [[ ! -f "scenario2/P1--2025-07-22--Active_Task.md" ]]; then
            log "FAIL" "Active file not converted correctly"
            pass=false
        fi
        
        # Check old files are removed
        if [[ -f "scenario2/2025-07-20-should-archive.md" || -f "scenario2/archive/2025-07-19-already-archived.md" ]]; then
            log "FAIL" "Old V1 files not removed"
            pass=false
        fi
        
        if [ "$pass" = true ]; then
            log "PASS" "Archive folder handling successful"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "Archive folder migration script failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_special_characters() {
    log "TEST" "Testing special characters and unicode..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario3
    cd scenario3
    
    # Create files with challenging titles
    create_v1_file "2025-07-24-special-chars.md" "Task with émojis 🚀 & symbols!" 3 "2025-07-24T10:00:00.000Z" false "# Special Characters\n\nContent with unicode: 中文 español français"
    create_v1_file "2025-07-23-very-long-title.md" "This is a very long title that exceeds the normal length limits and should be truncated properly during filename generation to avoid filesystem issues" 2 "2025-07-23T10:00:00.000Z" false "# Long Title Test"
    create_v1_file "2025-07-22-symbols.md" "Title/with\\various:symbols*and?chars" 4 "2025-07-22T10:00:00.000Z" false "# Symbol Test"
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario3 > /dev/null 2>&1; then
        local pass=true
        
        # Check files were created (exact names may vary due to sanitization)
        local v2_files=$(find scenario3 -name "P*--*--*.md" | wc -l)
        if [ "$v2_files" -ne 3 ]; then
            log "FAIL" "Expected 3 V2 files, found $v2_files"
            pass=false
        fi
        
        # Check no V1 files remain
        local v1_files=$(find scenario3 -name "20*-*-*.md" | wc -l)
        if [ "$v1_files" -ne 0 ]; then
            log "FAIL" "V1 files still exist after migration"
            pass=false
        fi
        
        # Check file contents are preserved
        local content_ok=true
        for file in scenario3/P*--*--*.md; do
            if [ -f "$file" ]; then
                if ! grep -q "tags: \[\]" "$file"; then
                    content_ok=false
                    break
                fi
            fi
        done
        
        if [ "$content_ok" = false ]; then
            log "FAIL" "V2 file structure not correct"
            pass=false
        fi
        
        if [ "$pass" = true ]; then
            log "PASS" "Special characters handling successful"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "Special characters migration script failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_mixed_v1_v2_scenarios() {
    log "TEST" "Testing mixed V1/V2 file scenarios..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario4
    cd scenario4
    
    # Create V1 files
    create_v1_file "2025-07-24-v1-file.md" "V1 File" 3 "2025-07-24T10:00:00.000Z" false "# V1 File\n\nNeed to migrate."
    
    # Create V2 files (already migrated)
    cat > "P2--2025-07-23--Existing_V2_File.md" <<EOF
---
tags: []
---

# Existing V2 File

This file is already in V2 format and should be skipped.
EOF
    
    # Create non-markdown files (should be ignored)
    echo "This is a text file" > "notes.txt"
    echo "# Not a todo" > "README.md"
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario4 > /dev/null 2>&1; then
        local pass=true
        
        # Check V1 file was migrated
        if [[ ! -f "P3--2025-07-24--V1_File.md" ]]; then
            log "FAIL" "V1 file not migrated"
            pass=false
        fi
        
        # Check V2 file was preserved
        if [[ ! -f "P2--2025-07-23--Existing_V2_File.md" ]]; then
            log "FAIL" "Existing V2 file not preserved"
            pass=false
        fi
        
        # Check non-markdown files were ignored
        if [[ ! -f "notes.txt" || ! -f "README.md" ]]; then
            log "FAIL" "Non-markdown files were affected"
            pass=false
        fi
        
        # Check old V1 file was removed
        if [[ -f "2025-07-24-v1-file.md" ]]; then
            log "FAIL" "Old V1 file not removed"
            pass=false
        fi
        
        if [ "$pass" = true ]; then
            log "PASS" "Mixed V1/V2 scenarios successful"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "Mixed scenarios migration script failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_edge_cases() {
    log "TEST" "Testing edge cases and error conditions..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario5
    cd scenario5
    
    # File with missing frontmatter fields
    cat > "scenario5/2025-07-24-incomplete.md" <<EOF
---
title: 'Incomplete Frontmatter'
# Missing priority, createdAt, isArchived
---

# Incomplete File

This file has incomplete frontmatter.
EOF
    
    # File with invalid priority
    cat > "scenario5/2025-07-23-invalid-priority.md" <<EOF
---
title: 'Invalid Priority'
createdAt: '2025-07-23T10:00:00.000Z'
priority: 99
isArchived: false
---

# Invalid Priority

This file has an invalid priority value.
EOF
    
    # File with malformed frontmatter
    cat > "scenario5/2025-07-22-malformed.md" <<EOF
---
title: Unquoted Title
createdAt: not-a-date
priority: "not-a-number"
isArchived: maybe
chatHistory: broken yaml [
---

# Malformed Frontmatter

This file has malformed YAML.
EOF
    
    # Empty file
    touch "scenario5/2025-07-21-empty.md"
    
    # Run migration (should handle errors gracefully)
    local migration_result=0
    "$MIGRATION_SCRIPT" --force --no-git scenario5 > /dev/null 2>&1 || migration_result=$?
    
    # Migration should complete (possibly with warnings) but not crash
    if [ $migration_result -eq 0 ] || [ $migration_result -eq 1 ]; then
        log "PASS" "Edge cases handled gracefully"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log "FAIL" "Edge cases caused script to crash"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_rollback_functionality() {
    log "TEST" "Testing rollback functionality..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario6
    cd scenario6
    
    # Create V1 files
    create_v1_file "2025-07-24-rollback-test.md" "Rollback Test" 3 "2025-07-24T10:00:00.000Z" false "# Rollback Test\n\nThis should be restored."
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario6 > /dev/null 2>&1; then
        # Verify migration worked
        if [[ -f "scenario6/P3--2025-07-24--Rollback_Test.md" ]]; then
            # Now test rollback
            if "$MIGRATION_SCRIPT" --rollback --force --no-git scenario6 > /dev/null 2>&1; then
                # Check original file was restored
                if [[ -f "scenario6/2025-07-24-rollback-test.md" && ! -f "scenario6/P3--2025-07-24--Rollback_Test.md" ]]; then
                    log "PASS" "Rollback functionality successful"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                else
                    log "FAIL" "Rollback did not restore files correctly"
                    TESTS_FAILED=$((TESTS_FAILED + 1))
                fi
            else
                log "FAIL" "Rollback command failed"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            fi
        else
            log "FAIL" "Initial migration failed, cannot test rollback"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "Migration failed, cannot test rollback"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

test_chathistory_handling() {
    log "TEST" "Testing chatHistory removal..."
    TESTS_RUN=$((TESTS_RUN + 1))
    
    mkdir -p scenario7
    cd scenario7
    
    # Create file with complex chatHistory
    create_v1_file "2025-07-24-with-chat.md" "Task with Chat" 3 "2025-07-24T10:00:00.000Z" false "# Task with Chat History\n\nThis file has chat history that should be removed." true
    
    # Run migration
    if "$MIGRATION_SCRIPT" --force --no-git scenario7 > /dev/null 2>&1; then
        # Check V2 file was created
        if [[ -f "scenario7/P3--2025-07-24--Task_with_Chat.md" ]]; then
            # Check chatHistory was removed
            if ! grep -q "chatHistory" "scenario7/P3--2025-07-24--Task_with_Chat.md"; then
                # Check only tags remain in frontmatter
                if grep -q "^tags: \[\]$" "scenario7/P3--2025-07-24--Task_with_Chat.md"; then
                    log "PASS" "ChatHistory removal successful"
                    TESTS_PASSED=$((TESTS_PASSED + 1))
                else
                    log "FAIL" "Frontmatter not simplified correctly"
                    TESTS_FAILED=$((TESTS_FAILED + 1))
                fi
            else
                log "FAIL" "ChatHistory not removed"
                TESTS_FAILED=$((TESTS_FAILED + 1))
            fi
        else
            log "FAIL" "V2 file not created"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log "FAIL" "ChatHistory migration failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    cd ..
}

cleanup_test_environment() {
    log "INFO" "Cleaning up test environment..."
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR" .migration-backup migration-*.log
}

show_test_results() {
    echo
    echo -e "${WHITE}🧪 Migration Script Test Results${NC}"
    echo -e "${WHITE}=================================${NC}"
    echo -e "📊 Tests run: ${CYAN}$TESTS_RUN${NC}"
    echo -e "✅ Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "❌ Tests failed: ${RED}$TESTS_FAILED${NC}"
    
    local success_rate=0
    if [ $TESTS_RUN -gt 0 ]; then
        success_rate=$((TESTS_PASSED * 100 / TESTS_RUN))
    fi
    
    echo -e "📈 Success rate: ${CYAN}${success_rate}%${NC}"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! Migration script is ready for production.${NC}"
        return 0
    else
        echo -e "${RED}⚠️  Some tests failed. Please review and fix issues before production use.${NC}"
        return 1
    fi
}

main() {
    echo -e "${WHITE}🧪 Comprehensive Migration Script Test Suite${NC}"
    echo -e "${WHITE}=============================================${NC}"
    echo
    
    setup_test_environment
    
    # Run all test scenarios
    test_basic_functionality
    test_archive_folder_scenarios  
    test_special_characters
    test_mixed_v1_v2_scenarios
    test_edge_cases
    test_rollback_functionality
    test_chathistory_handling
    
    show_test_results
    local result=$?
    
    cleanup_test_environment
    
    exit $result
}

main "$@"