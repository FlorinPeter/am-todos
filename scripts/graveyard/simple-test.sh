#!/bin/bash

set -euo pipefail

cd /root/am-todos

# Test basic functionality
echo "=== Testing Basic Migration ==="
mkdir -p test-basic
cd test-basic

# Create a V1 file
cat > "2025-07-24-basic-test.md" <<EOF
---
title: 'Basic Test'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 3
isArchived: false
---

# Basic Test

This is a basic test.
EOF

# Test dry run first
echo "Running dry run..."
../scripts/migrate-v1-to-v2.sh --dry-run .

# Run actual migration
echo "Running migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git .

# Check results
echo "Checking results..."
if [[ -f "P3--2025-07-24--Basic_Test.md" ]]; then
    echo "✅ Migration successful - V2 file created"
else
    echo "❌ Migration failed - V2 file not found"
    ls -la
fi

if [[ -f "2025-07-24-basic-test.md" ]]; then
    echo "❌ Migration incomplete - V1 file still exists"
else
    echo "✅ Migration complete - V1 file removed"
fi

# Check content
if grep -q "tags: \[\]" "P3--2025-07-24--Basic_Test.md" 2>/dev/null; then
    echo "✅ Content format correct"
else
    echo "❌ Content format incorrect"
fi

cd ..
rm -rf test-basic .migration-backup migration-*.log

echo "=== Testing Archive Handling ==="
mkdir -p test-archive/archive
cd test-archive

# Create V1 file that should be archived
cat > "2025-07-24-should-archive.md" <<EOF
---
title: 'Should Archive'
createdAt: '2025-07-24T10:00:00.000Z'
priority: 4
isArchived: true
---

# Should Archive

This should move to archive.
EOF

# Create V1 file already in archive
cat > "archive/2025-07-23-already-archived.md" <<EOF
---
title: 'Already Archived'
createdAt: '2025-07-23T10:00:00.000Z'
priority: 5
isArchived: false
---

# Already Archived

This is already in archive.
EOF

echo "Running archive migration..."
../scripts/migrate-v1-to-v2.sh --force --no-git .

# Check results
echo "Checking archive results..."
if [[ -f "archive/P4--2025-07-24--Should_Archive.md" ]]; then
    echo "✅ Archive migration successful - archived file moved"
else
    echo "❌ Archive migration failed - archived file not moved"
    find . -name "*.md" -type f
fi

if [[ -f "archive/P5--2025-07-23--Already_Archived.md" ]]; then
    echo "✅ Archive conversion successful - existing archive file converted"
else
    echo "❌ Archive conversion failed - existing archive file not converted"
    find . -name "*.md" -type f
fi

cd ..
rm -rf test-archive .migration-backup migration-*.log

echo "=== All tests completed ==="