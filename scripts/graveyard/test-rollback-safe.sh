#!/bin/bash

set -euo pipefail

echo "🧪 Rollback Functionality Test"
echo "=============================="
echo

# Clean up from previous runs
rm -rf test-rollback .migration-backup migration-*.log

# Create test directory
mkdir -p test-rollback
cd test-rollback

echo "=== Step 1: Create Test Files ==="

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

echo "Created V1 test file: 2025-07-24-rollback-test.md"

echo
echo "=== Step 2: Run Initial Migration ==="
echo "Running migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git . >/dev/null 2>&1

# Verify migration worked
if [[ -f "P2--2025-07-24--Rollback_Test.md" && ! -f "2025-07-24-rollback-test.md" ]]; then
    echo "✅ Migration successful"
    echo "    Created: P2--2025-07-24--Rollback_Test.md"
else
    echo "❌ Migration failed"
    ls -la
    cd /root/am-todos
    rm -rf test-rollback .migration-backup migration-*.log
    exit 1
fi

echo
echo "=== Step 3: Test Rollback ==="
echo "Running rollback..."
../scripts/migrate-v1-to-v2.sh --rollback . >/dev/null 2>&1

# Verify rollback worked
if [[ -f "2025-07-24-rollback-test.md" && ! -f "P2--2025-07-24--Rollback_Test.md" ]]; then
    echo "✅ Rollback successful"
    echo "    Restored: 2025-07-24-rollback-test.md"
    
    # Verify content is intact
    if grep -q "This tests rollback functionality" "2025-07-24-rollback-test.md"; then
        echo "✅ File content preserved"
    else
        echo "❌ File content corrupted"
    fi
else
    echo "❌ Rollback failed"
    echo "Current files:"
    ls -la
fi

# Clean up
cd /root/am-todos
rm -rf test-rollback .migration-backup migration-*.log

echo
echo "🎉 Rollback test completed!"