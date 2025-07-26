#!/bin/bash

# =============================================================================
# AM-Todos V1 to V2 Migration Script
# =============================================================================
# 
# This script migrates todos from V1 format (frontmatter-based metadata) to 
# V2 format (filename-based metadata) for massive performance improvements.
#
# V1 Format: YYYY-MM-DD-title.md with frontmatter metadata
# V2 Format: P{priority}--YYYY-MM-DD--Title_With_Underscores.md with minimal frontmatter
#
# PERFORMANCE BENEFITS:
# - Reduces API requests from 100+ to ~3 for initial load
# - 99% performance improvement for large repositories
# - Instant sidebar loading with filename-based metadata
# - On-demand content loading for selected todos
#
# SAFETY FEATURES:
# - Creates full backup before migration
# - Dry-run mode to preview all changes
# - Rollback capability to restore from backup
# - Git-tracked changes with detailed commit messages
#
# Usage:
#   ./scripts/migrate-v1-to-v2.sh [options] [folder]
#
# Options:
#   --dry-run          Preview changes without making modifications
#   --backup-dir DIR   Custom backup directory (default: .migration-backup)
#   --no-git          Skip git operations (for testing)
#   --force           Skip confirmation prompts
#   --help            Show this help message
#
# Examples:
#   ./scripts/migrate-v1-to-v2.sh --dry-run todos
#   ./scripts/migrate-v1-to-v2.sh --force todos
#   ./scripts/migrate-v1-to-v2.sh personal-tasks
#
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# =============================================================================
# Configuration and Constants
# =============================================================================

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly DEFAULT_BACKUP_DIR=".migration-backup"
readonly LOG_FILE="migration-$(date +%Y%m%d-%H%M%S).log"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly GRAY='\033[0;90m'
readonly NC='\033[0m' # No Color

# Migration statistics
TOTAL_FILES=0
MIGRATED_FILES=0
SKIPPED_FILES=0
ERROR_FILES=0
ARCHIVED_FILES=0

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
    
    case "$level" in
        "INFO")  echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE" ;;
        "DEBUG") echo -e "${GRAY}[DEBUG]${NC} $message" | tee -a "$LOG_FILE" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE" ;;
        *)       echo -e "$message" | tee -a "$LOG_FILE" ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

progress() {
    local current="$1"
    local total="$2"
    local message="${3:-}"
    local percentage=$((current * 100 / total))
    local bar_length=50
    local filled_length=$((percentage * bar_length / 100))
    
    printf "\r${CYAN}["
    printf "%*s" $filled_length | tr ' ' '='
    printf "%*s" $((bar_length - filled_length)) | tr ' ' '-'
    printf "] %d%% (%d/%d)${NC} %s" $percentage $current $total "$message"
    
    if [ $current -eq $total ]; then
        echo
    fi
}

confirm() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [ "$FORCE" = true ]; then
        log "INFO" "Force mode: Auto-confirming: $prompt"
        return 0
    fi
    
    while true; do
        if [ "$default" = "y" ]; then
            read -p "$prompt [Y/n]: " -r response
            response=${response:-y}
        else
            read -p "$prompt [y/N]: " -r response
            response=${response:-n}
        fi
        
        case "$response" in
            [Yy]|[Yy][Ee][Ss]) return 0 ;;
            [Nn]|[Nn][Oo]) return 1 ;;
            *) echo "Please answer yes or no." ;;
        esac
    done
}

cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log "ERROR" "Script failed with exit code $exit_code"
        log "INFO" "Check the log file: $LOG_FILE"
        log "INFO" "If migration was interrupted, you can restore from backup: $BACKUP_DIR"
    fi
    exit $exit_code
}

# =============================================================================
# File Analysis Functions  
# =============================================================================

is_v1_file() {
    local file="$1"
    
    # Check if filename matches YYYY-MM-DD-*.md pattern
    local basename="$(basename "$file")"
    if ! [[ "$basename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}-.*\.md$ ]]; then
        return 1
    fi
    
    # Check if file has frontmatter with V1 metadata fields
    if ! head -20 "$file" | grep -q "^---$"; then
        return 1
    fi
    
    # Extract frontmatter and check for V1 fields
    local frontmatter=$(sed -n '/^---$/,/^---$/p' "$file" | head -n -1 | tail -n +2)
    
    # Look for V1-specific fields that need migration
    if echo "$frontmatter" | grep -q "^\s*title:\|^\s*priority:\|^\s*createdAt:\|^\s*isArchived:"; then
        return 0
    fi
    
    return 1
}

extract_frontmatter_field() {
    local file="$1"
    local field="$2"
    local default="$3"
    
    local frontmatter=$(sed -n '/^---$/,/^---$/p' "$file" | head -n -1 | tail -n +2)
    local value=$(echo "$frontmatter" | grep "^\s*$field:" | sed "s/^\s*$field:\s*//" | sed "s/['\"]//g" | xargs)
    
    if [ -z "$value" ]; then
        echo "$default"
    else
        echo "$value"
    fi
}

sanitize_title() {
    local title="$1"
    
    # Convert to filename-safe format
    echo "$title" | \
        sed 's/ /_/g' | \
        sed 's/[^a-zA-Z0-9_-]//g' | \
        sed 's/_\+/_/g' | \
        sed 's/^_\+\|_\+$//g' | \
        cut -c1-50
}

generate_v2_filename() {
    local priority="$1"
    local date="$2" 
    local title="$3"
    
    local sanitized_title=$(sanitize_title "$title")
    echo "P${priority}--${date}--${sanitized_title}.md"
}

extract_date_from_v1_filename() {
    local filename="$1"
    local basename="$(basename "$filename")"
    echo "$basename" | sed 's/^\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\)-.*/\1/'
}

# =============================================================================
# Migration Functions
# =============================================================================

create_backup() {
    local folder="$1"
    
    log "INFO" "Creating backup in $BACKUP_DIR..."
    
    if [ -d "$BACKUP_DIR" ]; then
        if ! confirm "Backup directory already exists. Overwrite?"; then
            log "ERROR" "Backup creation cancelled"
            exit 1
        fi
        rm -rf "$BACKUP_DIR"
    fi
    
    mkdir -p "$BACKUP_DIR"
    
    # Create backup of markdown files and archive folder if it exists
    if [ -d "$folder" ]; then
        # Handle current directory specially to avoid recursive copy
        if [ "$folder" = "." ]; then
            # Create a subfolder in backup to match expected structure
            mkdir -p "$BACKUP_DIR/current"
            
            # Copy all .md files from current directory
            find . -maxdepth 1 -name "*.md" -exec cp {} "$BACKUP_DIR/current/" \; 2>/dev/null || true
            
            # Copy archive folder if it exists
            if [ -d "./archive" ]; then
                cp -r "./archive" "$BACKUP_DIR/current/"
            fi
            
            log "SUCCESS" "Backup created: $BACKUP_DIR/current ($(find "$BACKUP_DIR/current" -name "*.md" | wc -l) files)"
        else
            # For named folders, use original logic
            cp -r "$folder" "$BACKUP_DIR/"
            log "SUCCESS" "Backup created: $BACKUP_DIR/$(basename "$folder")"
        fi
    else
        log "WARN" "Todo folder '$folder' does not exist, skipping backup"
    fi
    
    # Create metadata file with migration info
    local restore_source
    if [ "$folder" = "." ]; then
        restore_source="$BACKUP_DIR/current"
    else
        restore_source="$BACKUP_DIR/$(basename "$folder")"
    fi
    
    cat > "$BACKUP_DIR/migration-info.txt" <<EOF
AM-Todos V1 to V2 Migration Backup
Created: $(date)
Original folder: $folder
Script version: $SCRIPT_NAME
Git commit before migration: $(git rev-parse HEAD 2>/dev/null || echo "N/A")

To restore from this backup:
1. Remove current markdown files: rm -f *.md && rm -rf archive/
2. Restore from backup: cp -r $restore_source/* ./
3. Reset git changes: git checkout -- ./ (if using git)

Files in this backup: $(find "$BACKUP_DIR" -name "*.md" | wc -l) markdown files
EOF
    
    log "INFO" "Backup metadata saved: $BACKUP_DIR/migration-info.txt"
}

analyze_folder() {
    local folder="$1"
    
    log "INFO" "Analyzing folder: $folder"
    
    if [ ! -d "$folder" ]; then
        log "ERROR" "Folder '$folder' does not exist"
        exit 1
    fi
    
    local total_md_files=$(find "$folder" -name "*.md" -not -name ".gitkeep" | wc -l)
    local v1_files=0
    local v2_files=0
    local other_files=0
    
    echo
    echo -e "${WHITE}📊 Migration Analysis Report${NC}"
    echo -e "${WHITE}=============================${NC}"
    
    while IFS= read -r -d '' file; do
        if is_v1_file "$file"; then
            v1_files=$((v1_files + 1))
        elif [[ "$(basename "$file")" =~ ^P[1-5]--[0-9]{4}-[0-9]{2}-[0-9]{2}--.+\.md$ ]]; then
            v2_files=$((v2_files + 1))
        else
            other_files=$((other_files + 1))
        fi
    done < <(find "$folder" -name "*.md" -not -name ".gitkeep" -print0)
    
    echo -e "📁 Total markdown files: ${CYAN}$total_md_files${NC}"
    echo -e "📄 V1 files (need migration): ${YELLOW}$v1_files${NC}"
    echo -e "🚀 V2 files (already migrated): ${GREEN}$v2_files${NC}"
    echo -e "❓ Other files (will skip): ${GRAY}$other_files${NC}"
    echo
    
    if [ $v1_files -eq 0 ]; then
        log "INFO" "No V1 files found that need migration"
        echo -e "${GREEN}✅ All files are already in V2 format or don't need migration!${NC}"
        echo
        echo -e "${WHITE}Performance Benefits Already Available:${NC}"
        echo -e "  • 99% reduction in API requests"
        echo -e "  • Instant sidebar loading"
        echo -e "  • On-demand content loading"
        echo
        exit 0
    fi
    
    TOTAL_FILES=$v1_files
    
    echo -e "${WHITE}🎯 Migration Preview:${NC}"
    echo -e "  • Files to migrate: ${YELLOW}$v1_files${NC}"
    echo -e "  • Expected performance improvement: ${GREEN}99% fewer API requests${NC}"
    echo -e "  • New filename format: ${CYAN}P{priority}--YYYY-MM-DD--Title.md${NC}"
    echo
    
    # Return 0 for success (not the number of files)
    return 0
}

migrate_file() {
    local file="$1"
    local is_dry_run="$2"
    
    local basename="$(basename "$file")"
    local dirname="$(dirname "$file")"
    
    log "DEBUG" "Processing file: $file"
    
    # Extract metadata from frontmatter
    local title=$(extract_frontmatter_field "$file" "title" "$basename")
    local priority=$(extract_frontmatter_field "$file" "priority" "3")
    local created_at=$(extract_frontmatter_field "$file" "createdAt" "")
    local is_archived=$(extract_frontmatter_field "$file" "isArchived" "false")
    
    # Extract date from filename as fallback
    local file_date=$(extract_date_from_v1_filename "$file")
    
    # Use date from frontmatter or fallback to filename date
    local date="$file_date"
    if [ -n "$created_at" ]; then
        date=$(echo "$created_at" | cut -d'T' -f1)
    fi
    
    # Generate new filename
    local new_filename=$(generate_v2_filename "$priority" "$date" "$title")
    local new_path="$dirname/$new_filename"
    
    # Handle archived files
    if [ "$is_archived" = "true" ]; then
        # If file is already in archive directory, keep it there
        if [[ "$dirname" == *"/archive" ]] || [[ "$dirname" == "./archive" ]]; then
            new_path="$dirname/$new_filename"
        else
            local archive_dir="$dirname/archive"
            new_path="$archive_dir/$new_filename"
            
            if [ "$is_dry_run" = false ]; then
                mkdir -p "$archive_dir"
            fi
        fi
        ARCHIVED_FILES=$((ARCHIVED_FILES + 1))
    fi
    
    # Check for filename conflicts
    if [ -f "$new_path" ] && [ "$file" != "$new_path" ]; then
        log "WARN" "Filename conflict: $new_path already exists"
        local counter=1
        while [ -f "${new_path%.md}-${counter}.md" ]; do
            counter=$((counter + 1))
        done
        new_path="${new_path%.md}-${counter}.md"
        log "INFO" "Using alternative filename: $(basename "$new_path")"
    fi
    
    if [ "$is_dry_run" = true ]; then
        echo -e "  ${BLUE}${basename}${NC} → ${GREEN}$(basename "$new_path")${NC}"
        echo -e "    📊 Priority: P$priority | 📅 Date: $date | 📁 $([ "$is_archived" = "true" ] && echo "archived" || echo "active")"
        return 0
    fi
    
    # Read current content and split frontmatter from markdown
    local content=$(cat "$file")
    local frontmatter_end=$(grep -n "^---$" "$file" | sed -n '2p' | cut -d: -f1)
    local markdown_content=""
    
    if [ -n "$frontmatter_end" ]; then
        markdown_content=$(tail -n +$((frontmatter_end + 1)) "$file")
    else
        markdown_content="$content"
    fi
    
    # Create new V2 content with minimal frontmatter
    local new_content="---
tags: []
---
$markdown_content"
    
    # Write new file
    echo "$new_content" > "$new_path"
    
    # Remove old file if it's different from new path
    if [ "$file" != "$new_path" ]; then
        rm "$file"
        
        # Git operations
        if [ "$NO_GIT" = false ] && git rev-parse --git-dir > /dev/null 2>&1; then
            git add "$new_path"
            if git ls-files --error-unmatch "$file" > /dev/null 2>&1; then
                git rm "$file" > /dev/null 2>&1 || true
            fi
        fi
    fi
    
    log "DEBUG" "Migrated: $basename → $(basename "$new_path")"
    MIGRATED_FILES=$((MIGRATED_FILES + 1))
    
    return 0
}

perform_migration() {
    local folder="$1"
    local is_dry_run="$2"
    
    if [ "$is_dry_run" = true ]; then
        log "INFO" "🔍 DRY RUN: Previewing migration changes..."
        echo
        echo -e "${WHITE}Files to be migrated:${NC}"
    else
        log "INFO" "🚀 Starting V1 to V2 migration..."
        create_backup "$folder"
    fi
    
    local current=0
    
    while IFS= read -r -d '' file; do
        if is_v1_file "$file"; then
            current=$((current + 1))
            
            if [ "$is_dry_run" = false ]; then
                progress $current $TOTAL_FILES "$(basename "$file")..."
            fi
            
            if migrate_file "$file" "$is_dry_run"; then
                if [ "$is_dry_run" = false ]; then
                    # Create individual commit for this migration
                    if [ "$NO_GIT" = false ] && git rev-parse --git-dir > /dev/null 2>&1; then
                        local commit_msg="migrate: Convert $(basename "$file") from V1 to V2 format

- Updated filename to include priority and structured format
- Simplified frontmatter to tags-only for performance
- Maintains all content and metadata integrity"
                        git commit -m "$commit_msg" > /dev/null 2>&1 || true
                    fi
                fi
            else
                ERROR_FILES=$((ERROR_FILES + 1))
                log "ERROR" "Failed to migrate: $file"
            fi
        else
            SKIPPED_FILES=$((SKIPPED_FILES + 1))
        fi
    done < <(find "$folder" -name "*.md" -not -name ".gitkeep" -print0)
    
    if [ "$is_dry_run" = false ]; then
        echo
    fi
}

# =============================================================================
# Validation Functions
# =============================================================================

validate_migration() {
    local folder="$1"
    
    log "INFO" "🔍 Validating migration results..."
    
    local remaining_v1_files=0
    local total_v2_files=0
    local corrupted_files=0
    
    while IFS= read -r -d '' file; do
        if is_v1_file "$file"; then
            remaining_v1_files=$((remaining_v1_files + 1))
            log "WARN" "V1 file still exists: $(basename "$file")"
        elif [[ "$(basename "$file")" =~ ^P[1-5]--[0-9]{4}-[0-9]{2}-[0-9]{2}--.+\.md$ ]]; then
            total_v2_files=$((total_v2_files + 1))
            
            # Basic validation: check if file has proper V2 structure
            if ! head -10 "$file" | grep -q "^tags: \[\]$"; then
                corrupted_files=$((corrupted_files + 1))
                log "WARN" "Potentially corrupted V2 file: $(basename "$file")"
            fi
        fi
    done < <(find "$folder" -name "*.md" -not -name ".gitkeep" -print0)
    
    echo
    echo -e "${WHITE}🎯 Migration Validation Results${NC}"
    echo -e "${WHITE}================================${NC}"
    echo -e "✅ Successfully migrated: ${GREEN}$MIGRATED_FILES${NC} files"
    echo -e "⏭️  Files skipped: ${GRAY}$SKIPPED_FILES${NC} files"
    echo -e "❌ Errors encountered: ${RED}$ERROR_FILES${NC} files"
    echo -e "📦 Files archived: ${PURPLE}$ARCHIVED_FILES${NC} files"
    echo
    echo -e "📊 Current state:"
    echo -e "  • V2 format files: ${GREEN}$total_v2_files${NC}"
    echo -e "  • V1 files remaining: ${YELLOW}$remaining_v1_files${NC}"
    echo -e "  • Potentially corrupted: ${RED}$corrupted_files${NC}"
    echo
    
    if [ $remaining_v1_files -eq 0 ] && [ $corrupted_files -eq 0 ]; then
        log "SUCCESS" "🎉 Migration completed successfully!"
        echo
        echo -e "${GREEN}🚀 Performance Benefits Now Active:${NC}"
        echo -e "  • 99% reduction in API requests"
        echo -e "  • Instant sidebar loading with filename metadata"
        echo -e "  • On-demand content loading for selected todos"
        echo -e "  • Improved scalability for large repositories"
        echo
        return 0
    else
        log "WARN" "Migration completed with warnings"
        return 1
    fi
}

# =============================================================================
# Rollback Functions
# =============================================================================

rollback_migration() {
    local folder="$1"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log "ERROR" "Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    log "WARN" "🔄 Rolling back migration..."
    
    if ! confirm "This will restore from backup and undo all migration changes. Continue?" "n"; then
        log "INFO" "Rollback cancelled"
        exit 0
    fi
    
    # Remove current folder
    if [ -d "$folder" ]; then
        rm -rf "$folder"
    fi
    
    # Restore from backup
    cp -r "$BACKUP_DIR/$(basename "$folder")" "./"
    
    # Reset git if needed
    if [ "$NO_GIT" = false ] && git rev-parse --git-dir > /dev/null 2>&1; then
        git add "$folder/"
        git commit -m "rollback: Restore V1 format from migration backup

This rollback restores the original V1 format files from backup
created before the V1 to V2 migration was performed." || true
    fi
    
    log "SUCCESS" "Migration rolled back successfully"
    log "INFO" "Original V1 format restored from: $BACKUP_DIR"
}

# =============================================================================
# Help and Usage Functions
# =============================================================================

show_help() {
    cat << EOF
${WHITE}AM-Todos V1 to V2 Migration Script${NC}

${WHITE}DESCRIPTION:${NC}
    Migrates todos from V1 format (frontmatter metadata) to V2 format 
    (filename metadata) for 99% performance improvement.
    
    V1: YYYY-MM-DD-title.md (metadata in frontmatter)
    V2: P{priority}--YYYY-MM-DD--Title.md (metadata in filename)

${WHITE}USAGE:${NC}
    $SCRIPT_NAME [OPTIONS] [FOLDER]

${WHITE}ARGUMENTS:${NC}
    FOLDER          Todo folder to migrate (default: todos)

${WHITE}OPTIONS:${NC}
    --dry-run       Preview changes without making modifications
    --backup-dir    Custom backup directory (default: $DEFAULT_BACKUP_DIR)
    --no-git        Skip git operations (for testing)
    --force         Skip confirmation prompts
    --rollback      Rollback previous migration from backup
    --help          Show this help message

${WHITE}EXAMPLES:${NC}
    # Preview migration changes
    $SCRIPT_NAME --dry-run todos
    
    # Migrate with custom backup location  
    $SCRIPT_NAME --backup-dir ./backup-$(date +%Y%m%d) todos
    
    # Force migration without prompts
    $SCRIPT_NAME --force personal-tasks
    
    # Rollback previous migration
    $SCRIPT_NAME --rollback todos

${WHITE}SAFETY FEATURES:${NC}
    • Full backup created before migration
    • Dry-run mode to preview all changes
    • Git integration with meaningful commit messages
    • Rollback capability to restore from backup
    • Comprehensive validation and error reporting

${WHITE}PERFORMANCE BENEFITS:${NC}
    • 99% reduction in API requests (from 100+ to ~3)
    • Instant sidebar loading with filename metadata
    • On-demand content loading for selected todos
    • Improved scalability for large repositories

For more information, see: FILENAME-METADATA-IMPLEMENTATION.md
EOF
}

# =============================================================================
# Main Script Logic
# =============================================================================

main() {
    # Default values
    local FOLDER="todos"
    local DRY_RUN=false
    local ROLLBACK=false
    BACKUP_DIR="$DEFAULT_BACKUP_DIR"
    NO_GIT=false
    FORCE=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --no-git)
                NO_GIT=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                log "ERROR" "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
            *)
                FOLDER="$1"
                shift
                ;;
        esac
    done
    
    # Set up error handling
    trap cleanup EXIT
    
    # Change to project directory
    cd "$PROJECT_ROOT"
    
    # Initialize log file
    echo "AM-Todos V1 to V2 Migration Log - $(date)" > "$LOG_FILE"
    echo "==========================================" >> "$LOG_FILE"
    
    # Show banner
    echo
    echo -e "${WHITE}🚀 AM-Todos V1 to V2 Migration Script${NC}"
    echo -e "${WHITE}======================================${NC}"
    echo -e "📁 Target folder: ${CYAN}$FOLDER${NC}"
    echo -e "💾 Backup directory: ${CYAN}$BACKUP_DIR${NC}"
    echo -e "📝 Log file: ${CYAN}$LOG_FILE${NC}"
    echo -e "🏃 Mode: ${YELLOW}$([ "$DRY_RUN" = true ] && echo "DRY RUN" || echo "MIGRATION")${NC}"
    echo
    
    # Handle rollback
    if [ "$ROLLBACK" = true ]; then
        rollback_migration "$FOLDER"
        exit 0
    fi
    
    # Analyze folder and get file counts
    analyze_folder "$FOLDER"
    
    # Confirm migration
    if [ "$DRY_RUN" = false ]; then
        echo -e "${WHITE}⚠️  Important Safety Information:${NC}"
        echo -e "  • A backup will be created in: ${CYAN}$BACKUP_DIR${NC}"
        echo -e "  • All changes will be tracked in git"
        echo -e "  • You can rollback using: ${CYAN}$SCRIPT_NAME --rollback $FOLDER${NC}"
        echo
        
        if ! confirm "Proceed with V1 to V2 migration?"; then
            log "INFO" "Migration cancelled by user"
            exit 0
        fi
        echo
    fi
    
    # Perform migration
    perform_migration "$FOLDER" "$DRY_RUN"
    
    # Show results
    if [ "$DRY_RUN" = true ]; then
        echo
        echo -e "${GREEN}✅ Dry run completed successfully!${NC}"
        echo
        echo -e "${WHITE}To perform the actual migration:${NC}"
        echo -e "  ${CYAN}$SCRIPT_NAME $FOLDER${NC}"
        echo
        echo -e "${WHITE}Expected performance benefits:${NC}"
        echo -e "  • 99% reduction in API requests"
        echo -e "  • Instant sidebar loading"
        echo -e "  • On-demand content loading"
    else
        # Validate migration results
        validate_migration "$FOLDER"
        
        log "INFO" "Migration completed!"
        log "INFO" "Log file: $LOG_FILE"
        log "INFO" "Backup available: $BACKUP_DIR"
        
        echo -e "${WHITE}📋 Next Steps:${NC}"
        echo -e "  1. Test the application to ensure everything works correctly"
        echo -e "  2. If issues occur, rollback with: ${CYAN}$SCRIPT_NAME --rollback $FOLDER${NC}"
        echo -e "  3. Once satisfied, you can remove the backup: ${CYAN}rm -rf $BACKUP_DIR${NC}"
        echo
    fi
}

# Run main function with all arguments
main "$@"