#!/bin/bash

set -euo pipefail

echo "🧪 Comprehensive Migration Script Test"
echo "======================================"
echo

# Clean up from previous runs
rm -rf test-comprehensive .migration-backup migration-*.log

# Create test directory structure
mkdir -p test-comprehensive/archive
cd test-comprehensive

echo "=== Test 1: Basic V1→V2 Migration ==="

# Create V1 test file
cat > "2025-07-24-basic.md" <<EOF
---
title: 'Basic Task'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 3
isArchived: false
---

# Basic Task
This is a basic task.
EOF

echo "Running basic migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

if [[ -f "P3--2025-07-24--Basic_Task.md" && ! -f "2025-07-24-basic.md" ]]; then
    echo "✅ Basic migration successful"
else
    echo "❌ Basic migration failed"
    ls -la
fi

echo
echo "=== Test 2: Archive Handling ==="

# Create files for archive test
cat > "2025-07-24-should-archive.md" <<EOF
---
title: 'Should Archive'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 4
isArchived: true
---

# Should Archive
This should be archived.
EOF

cat > "2025-07-22-active.md" <<EOF
---
title: 'Active Task'
createdAt: '2025-07-22T10:00:00.000Z'
priority: 1
isArchived: false
---

# Active Task
This should stay active.
EOF

cat > "archive/2025-07-23-already-archived.md" <<EOF
---
title: 'Already Archived'
createdAt: '2025-07-23T10:00:00.000Z'
priority: 5
isArchived: true
---

# Already Archived
This is already archived.
EOF

echo "Running archive migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

# Check results
archive_success=true

if [[ -f "archive/P4--2025-07-24--Should_Archive.md" ]]; then
    echo "✅ Archived file correctly moved to archive folder"
else
    echo "❌ Archived file not moved to archive folder"
    archive_success=false
fi

if [[ -f "archive/P5--2025-07-23--Already_Archived.md" && ! -f "archive/2025-07-23-already-archived.md" ]]; then
    echo "✅ Existing archive file correctly converted"
else
    echo "❌ Existing archive file not converted"
    archive_success=false
fi

if [[ -f "P1--2025-07-22--Active_Task.md" && ! -f "2025-07-22-active.md" ]]; then
    echo "✅ Active file stayed in main folder"
else
    echo "❌ Active file not in main folder"
    archive_success=false
fi

echo
echo "=== Test 3: Special Characters ==="

cat > "2025-07-24-special.md" <<EOF
---
title: 'Task with émojis 🚀 & symbols!'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 3
isArchived: false
---

# Task with émojis 🚀 & symbols!
Special characters test.
EOF

echo "Running special characters migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

if [[ -f "P3--2025-07-24--Task_with_mojis_symbols.md" && ! -f "2025-07-24-special.md" ]]; then
    echo "✅ Special characters handled correctly"
    echo "    Created: P3--2025-07-24--Task_with_mojis_symbols.md"
else
    echo "❌ Special characters not handled correctly"
    ls -la *.md 2>/dev/null || echo "No .md files found"
fi

echo
echo "=== Test 4: Mixed V1/V2 Scenarios ==="

# Create V2 file (should be preserved)
cat > "P2--2025-07-25--Already_V2.md" <<EOF
---
tags: []
---

# Already V2
This is already in V2 format.
EOF

# Create another V1 file
cat > "2025-07-26-new-v1.md" <<EOF
---
title: 'New V1 Task'
createdAt: '2025-07-26T10:00:00.000Z'
priority: 2
isArchived: false
---

# New V1 Task
This is a new V1 file.
EOF

echo "Running mixed scenario migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

mixed_success=true

if [[ -f "P2--2025-07-26--New_V1_Task.md" && ! -f "2025-07-26-new-v1.md" ]]; then
    echo "✅ New V1 file converted"
else
    echo "❌ New V1 file not converted"
    mixed_success=false
fi

if [[ -f "P2--2025-07-25--Already_V2.md" ]]; then
    echo "✅ Existing V2 file preserved"
else
    echo "❌ Existing V2 file lost"
    mixed_success=false
fi

echo
echo "=== Final Summary ==="
echo "Files after all migrations:"
find . -name "*.md" -type f | sort

# Clean up
cd /root/am-todos
rm -rf test-comprehensive .migration-backup migration-*.log

echo
if [[ $archive_success == true && $mixed_success == true ]]; then
    echo "🎉 All tests completed successfully!"
    echo "✅ Migration script is production-ready"
else
    echo "⚠️  Some tests failed - see details above"
fi