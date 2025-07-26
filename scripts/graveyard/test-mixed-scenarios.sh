#!/bin/bash

set -euo pipefail

echo "🧪 Mixed V1/V2 Scenarios Test"
echo "============================="
echo

# Clean up
rm -rf /tmp/test-mixed /tmp/.migration-backup /tmp/migration-*.log

# Create test directory
mkdir -p /tmp/test-mixed/archive
cd /tmp/test-mixed

echo "=== Creating Mixed V1/V2 Files ==="

# Create V1 files
cat > "2025-07-24-v1-file.md" <<EOF
---
title: 'V1 File'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 3
isArchived: false
---

# V1 File
This is a V1 format file.
EOF

# Create V2 file (already migrated)
cat > "P1--2025-07-23--V2_File.md" <<EOF
---
tags: []
---

# V2 File
This is already in V2 format.
EOF

# Create archived V1 file
cat > "archive/2025-07-22-archived-v1.md" <<EOF
---
title: 'Archived V1'
createdAt: '2025-07-22T10:00:00.000Z'
priority: 4
isArchived: true
---

# Archived V1
This is an archived V1 file.
EOF

echo "Created files:"
echo "  V1 files: 2 (1 active, 1 archived)"
echo "  V2 files: 1 (already migrated)"

echo
echo "=== Running Migration on Mixed Scenario ==="
/root/am-todos/scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

echo
echo "=== Verifying Results ==="

# Check V1 file was converted
if [[ -f "P3--2025-07-24--V1_File.md" && ! -f "2025-07-24-v1-file.md" ]]; then
    echo "✅ V1 file converted to V2"
else
    echo "❌ V1 file conversion failed"
fi

# Check V2 file remained unchanged
if [[ -f "P1--2025-07-23--V2_File.md" ]]; then
    echo "✅ Existing V2 file preserved"
else
    echo "❌ Existing V2 file lost"
fi

# Check archived V1 file was converted and stayed in archive
if [[ -f "archive/P4--2025-07-22--Archived_V1.md" && ! -f "archive/2025-07-22-archived-v1.md" ]]; then
    echo "✅ Archived V1 file converted and stayed in archive folder"
else
    echo "❌ Archived V1 file handling failed"
fi

echo
echo "Final file structure:"
find . -name "*.md" -type f | sort

# Clean up
cd /root/am-todos
rm -rf /tmp/test-mixed /tmp/.migration-backup /tmp/migration-*.log

echo
echo "🎉 Mixed scenarios test completed!"