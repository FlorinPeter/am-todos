# Scripts Graveyard

This directory contains development and prototype scripts that are no longer needed but are preserved for reference.

## Moved Scripts

### Test Scripts (Replaced by `test-migration-all.sh`)
- `focused-test.sh` - Early focused test for specific scenarios
- `simple-test.sh` - Simple test prototype
- `test-comprehensive.sh` - Intermediate comprehensive test version
- `test-migration.sh` - Original test script prototype
- `test-mixed-scenarios.sh` - Specific mixed scenario test
- `test-rollback-safe.sh` - Rollback test variant
- `test-rollback.sh` - Original rollback test

## Why These Scripts Were Replaced

All individual test scripts have been consolidated into `test-migration-all.sh`, which:
- Provides comprehensive coverage of all scenarios
- Has better error reporting and progress tracking  
- Follows the principle of having one authoritative test suite
- Automatically handles test environment setup and cleanup
- Provides detailed final reports

## Active Scripts (Still in scripts/)
- `migrate-v1-to-v2.sh` - Main migration script
- `test-migration-all.sh` - Comprehensive test suite
- `README.md` - Scripts documentation
- `analyze-dead-code.js` - Dead code analysis utility