#!/bin/bash

# Setup script for GitHub Container Registry
# This script helps configure the repository for container builds

set -e

echo "🐳 Setting up GitHub Container Registry for am-todos"
echo "=================================================="

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: This script must be run from within a git repository"
    exit 1
fi

# Get repository information
REPO_URL=$(git config --get remote.origin.url)
if [[ $REPO_URL == *"github.com"* ]]; then
    # Extract owner/repo from URL
    if [[ $REPO_URL == *".git" ]]; then
        REPO_INFO=$(echo $REPO_URL | sed 's/.*github\.com[\/:]//;s/\.git$//')
    else
        REPO_INFO=$(echo $REPO_URL | sed 's/.*github\.com[\/:]//;s/\/$//') 
    fi
    REPO_OWNER=$(echo $REPO_INFO | cut -d'/' -f1)
    REPO_NAME=$(echo $REPO_INFO | cut -d'/' -f2)
else
    echo "❌ Error: Repository must be hosted on GitHub"
    exit 1
fi

echo "📋 Repository Details:"
echo "   Owner: $REPO_OWNER"
echo "   Name: $REPO_NAME"
echo "   Full: $REPO_INFO"
echo ""

# Check if GitHub CLI is available
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found"
    
    # Check if authenticated
    if gh auth status &> /dev/null; then
        echo "✅ GitHub CLI authenticated"
    else
        echo "⚠️  GitHub CLI not authenticated. Run 'gh auth login' first"
        exit 1
    fi
else
    echo "⚠️  GitHub CLI not found. Install it for easier setup: https://cli.github.com/"
fi

echo ""
echo "🔧 Configuration Steps:"
echo "======================"

echo ""
echo "1. Enable GitHub Container Registry"
echo "   The workflows are already configured to push to ghcr.io"
echo "   No additional setup needed - GITHUB_TOKEN has required permissions"
echo ""

echo "2. Container Registry Settings"
echo "   • Registry: ghcr.io"
echo "   • Image name: ghcr.io/$REPO_INFO"
echo "   • Visibility: Public (can be changed in GitHub settings)"
echo ""

echo "3. Workflow Triggers"
echo "   • Push to main branch → Build and push 'latest' tag"
echo "   • Create version tag (v*) → Build and push versioned image"
echo "   • Create GitHub release → Build and push release image"
echo ""

echo "4. Available Images"
echo "   After the first build, images will be available at:"
echo "   • ghcr.io/$REPO_INFO:latest"
echo "   • ghcr.io/$REPO_INFO:main"
echo "   • ghcr.io/$REPO_INFO:sha-<commit-sha>"
echo "   • ghcr.io/$REPO_INFO:v<version> (for tags)"
echo ""

echo "🚀 Quick Start Commands:"
echo "======================="
echo ""
echo "# Pull and run the latest image:"
echo "docker pull ghcr.io/$REPO_INFO:latest"
echo "docker run -p 3001:3001 ghcr.io/$REPO_INFO:latest"
echo ""
echo "# Or use docker-compose:"
echo "docker-compose up -d"
echo ""

echo "📝 Next Steps:"
echo "============="
echo ""
echo "1. Commit and push the Docker files:"
echo "   git add ."
echo "   git commit -m 'feat: Add Docker support and GitHub workflows'"
echo "   git push origin main"
echo ""
echo "2. Create a release to trigger container build:"
echo "   git tag v1.0.0"
echo "   git push origin v1.0.0"
echo ""
echo "   Or create a release through GitHub UI"
echo ""
echo "3. Monitor the build process:"
echo "   • Check Actions tab: https://github.com/$REPO_INFO/actions"
echo "   • View packages: https://github.com/$REPO_OWNER?tab=packages"
echo ""

echo "✅ Setup complete! The repository is now configured for container builds."

# Create a summary file
cat > container-setup-summary.md << EOF
# Container Setup Summary

## Repository Information
- **Owner:** $REPO_OWNER  
- **Name:** $REPO_NAME
- **Full:** $REPO_INFO

## Container Registry
- **Registry:** ghcr.io
- **Base Image:** ghcr.io/$REPO_INFO

## Available Workflows
- **CI:** Runs tests and security scans
- **Docker Build:** Builds and pushes images on main branch
- **Release:** Creates versioned images for releases
- **Validate:** Validates Docker configuration

## Image Tags
- \`latest\` - Latest main branch build
- \`main\` - Main branch builds  
- \`sha-<hash>\` - Specific commit builds
- \`v<version>\` - Version tagged releases

## Quick Commands
\`\`\`bash
# Pull latest image
docker pull ghcr.io/$REPO_INFO:latest

# Run container
docker run -p 3001:3001 ghcr.io/$REPO_INFO:latest

# Using docker-compose
docker-compose up -d
\`\`\`

## Useful Links
- [Actions](https://github.com/$REPO_INFO/actions)
- [Packages](https://github.com/$REPO_OWNER?tab=packages)
- [Container Registry](https://github.com/$REPO_INFO/pkgs/container/$REPO_NAME)

Generated on: $(date)
EOF

echo ""
echo "📄 Summary saved to: container-setup-summary.md"