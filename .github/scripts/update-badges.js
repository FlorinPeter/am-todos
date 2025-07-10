#!/usr/bin/env node

/**
 * Update README badges with actual test count and coverage data
 * 
 * Usage:
 *   TEST_COUNT=<number> node .github/scripts/update-badges.js
 * 
 * Example:
 *   TEST_COUNT=377 node .github/scripts/update-badges.js
 * 
 * The TEST_COUNT should be extracted from actual test output, e.g.:
 *   TEST_COUNT=$(npm test -- --run 2>&1 | grep -oE '[0-9]+ passing' | grep -oE '[0-9]+')
 * 
 * This script will:
 * 1. Update the test count badge with the provided TEST_COUNT
 * 2. Update the coverage badge if coverage/coverage-summary.json exists
 * 3. Exit with error if TEST_COUNT is not provided
 */

const fs = require('fs');
const path = require('path');

// Run this script after tests to update README badges
async function updateBadges() {
  try {
    // Get test count from environment variable
    if (!process.env.TEST_COUNT) {
      console.error('ERROR: TEST_COUNT environment variable not set!');
      console.error('This script should be called with: TEST_COUNT=<number> node update-badges.js');
      console.error('The TEST_COUNT should be extracted from the actual test run output.');
      process.exit(1);
    }
    const testOutput = process.env.TEST_COUNT;
    
    // Get coverage if available
    let coverageText = 'check actions';
    let coverageFound = false;
    try {
      const coverageSummary = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../coverage/coverage-summary.json'), 'utf8')
      );
      const coverage = Math.round(coverageSummary.total.lines.pct);
      coverageText = `${coverage}%25`; // URL encode the % symbol
      coverageFound = true;
      console.log(`Found coverage data: ${coverage}%`);
    } catch (e) {
      console.warn('WARNING: Coverage summary not found at coverage/coverage-summary.json');
      console.warn('Coverage badge will show "check actions" instead of percentage');
    }

    // Read README
    const readmePath = path.join(__dirname, '../../README.md');
    let readme = fs.readFileSync(readmePath, 'utf8');

    // Update test badge
    readme = readme.replace(
      /\[!\[Tests\]\(https:\/\/img\.shields\.io\/badge\/tests-\d+%20passing-brightgreen\)\]/,
      `[![Tests](https://img.shields.io/badge/tests-${testOutput}%20passing-brightgreen)]`
    );

    // Update coverage badge if we have real data
    if (coverageText !== 'check actions') {
      const color = 
        parseInt(coverageText) >= 80 ? 'brightgreen' :
        parseInt(coverageText) >= 60 ? 'yellow' : 'red';
      
      readme = readme.replace(
        /\[!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]+\)\]/,
        `[![Coverage](https://img.shields.io/badge/coverage-${coverageText}-${color})]`
      );
    }

    // Write updated README
    fs.writeFileSync(readmePath, readme);
    
    console.log('\n✅ Badges updated successfully!');
    console.log(`   - Test count: ${testOutput} passing`);
    console.log(`   - Coverage: ${coverageFound ? coverageText.replace('%25', '%') : 'not available (will show "check actions")'}`);
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error updating badges:', error.message);
    process.exit(1);
  }
}

updateBadges();