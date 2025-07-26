#!/bin/bash

set -euo pipefail

echo "🧪 Rollback Functionality Test"
echo "=============================="
echo

# Clean up
rm -rf /tmp/test-rollback /tmp/.migration-backup /tmp/migration-*.log

# Create test directory and files
mkdir -p /tmp/test-rollback
cd /tmp/test-rollback

# Create V1 test file
cat > "2025-07-24-rollback-test.md" <<EOF
---
title: 'Rollback Test'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 2
isArchived: false
---

# Rollback Test

This tests rollback functionality.
EOF

echo "=== Step 1: Initial Migration ==="
echo "Running migration..."
/root/am-todos/scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

# Verify migration worked
if [[ -f "P2--2025-07-24--Rollback_Test.md" && ! -f "2025-07-24-rollback-test.md" ]]; then
    echo "✅ Migration successful"
else
    echo "❌ Migration failed"
    ls -la
    exit 1
fi

echo
echo "=== Step 2: Testing Rollback ==="
echo "Running rollback..."
/root/am-todos/scripts/migrate-v1-to-v2.sh --rollback . >/dev/null 2>&1

# Verify rollback worked
if [[ -f "2025-07-24-rollback-test.md" && ! -f "P2--2025-07-24--Rollback_Test.md" ]]; then
    echo "✅ Rollback successful"
    echo "    Original file restored: 2025-07-24-rollback-test.md"
else
    echo "❌ Rollback failed"
    echo "Current files:"
    ls -la
fi

# Clean up
cd /root/am-todos
rm -rf /tmp/test-rollback /tmp/.migration-backup /tmp/migration-*.log

echo
echo "🎉 Rollback test completed!"