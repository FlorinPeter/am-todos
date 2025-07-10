#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Run this script after tests to update README badges
async function updateBadges() {
  try {
    // Get test count from last test run
    const testOutput = process.env.TEST_COUNT || '377'; // fallback to current count
    
    // Get coverage if available
    let coverageText = 'check actions';
    try {
      const coverageSummary = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../coverage/coverage-summary.json'), 'utf8')
      );
      const coverage = Math.round(coverageSummary.total.lines.pct);
      coverageText = `${coverage}%25`; // URL encode the % symbol
    } catch (e) {
      console.log('Coverage summary not found, using default');
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
    console.log('Badges updated successfully');
  } catch (error) {
    console.error('Error updating badges:', error);
    process.exit(1);
  }
}

updateBadges();