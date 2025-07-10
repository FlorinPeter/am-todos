# Dynamic Badge Setup Guide

This guide explains how to set up dynamic test count and coverage badges using shields.io.

## Option 1: Using GitHub Gist (Recommended)

### Step 1: Create a GitHub Gist
1. Go to https://gist.github.com
2. Create a new **public** gist with two files:
   - `am-todos-tests.json`
   ```json
   {
     "schemaVersion": 1,
     "label": "tests",
     "message": "0 passing",
     "color": "lightgrey"
   }
   ```
   - `am-todos-coverage.json`
   ```json
   {
     "schemaVersion": 1,
     "label": "coverage",
     "message": "unknown",
     "color": "lightgrey"
   }
   ```
3. Save the gist and copy the Gist ID from the URL (e.g., `https://gist.github.com/YOUR_USERNAME/GIST_ID`)

### Step 2: Create a Personal Access Token
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a new token with `gist` scope
3. Copy the token

### Step 3: Add Secrets to Repository
1. Go to your repository settings → Secrets and variables → Actions
2. Add two secrets:
   - `GIST_SECRET`: Your personal access token
   - `GIST_ID`: The ID of your gist

### Step 4: Update README.md
Replace the static badges with:
```markdown
[![Tests](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_USERNAME/GIST_ID/raw/am-todos-tests.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/YOUR_USERNAME/GIST_ID/raw/am-todos-coverage.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
```

## Option 2: Using GitHub Branch (Simpler, No External Services)

The workflow will automatically create a `badges` branch with JSON files.

### Update README.md
Replace the static badges with:
```markdown
[![Tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FlorinPeter/am-todos/badges/test-badge.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/FlorinPeter/am-todos/badges/coverage-badge.json)](https://github.com/FlorinPeter/am-todos/actions/workflows/ci.yml)
```

## How It Works

1. After each successful CI run on main branch:
   - The workflow extracts test count from test output
   - The workflow calculates coverage percentage
   - Updates the JSON files in either Gist or branch
   - shields.io reads these JSON files and displays dynamic badges

2. Badge colors:
   - Tests: Green if passing, red if 0
   - Coverage: Green ≥80%, Yellow ≥60%, Red <60%

## Manual Trigger

You can manually trigger the badge update:
1. Go to Actions → Update Badges
2. Click "Run workflow" → Run workflow

## Troubleshooting

- If badges show "invalid": Check if JSON files are accessible
- If not updating: Check workflow logs for errors
- For Gist option: Ensure token has gist scope
- For branch option: Ensure badges branch exists