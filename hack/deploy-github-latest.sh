#!/bin/bash

# Deploy the latest GitHub-built image to Cloud Run
# This waits for the latest GitHub build and deploys it

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying latest GitHub-built image to Cloud Run${NC}"

# Check required environment variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo -e "${RED}❌ Error: GOOGLE_CLOUD_PROJECT environment variable is required${NC}"
    exit 1
fi

# Use the latest tag from the main branch
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:main"

echo -e "${YELLOW}📋 Make sure you have pushed your changes to GitHub and the build is complete!${NC}"
echo -e "${YELLOW}   You can check the build status at: https://github.com/florinpeter/am-todos/actions${NC}"
echo ""

read -p "Press Enter to continue with deployment (Ctrl+C to cancel)..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}Step 1/2: Pulling latest GitHub image and pushing to Artifact Registry${NC}"
echo "----------------------------------------"
$SCRIPT_DIR/pull-and-push.sh

# Extract the tag from SOURCE_IMAGE to use for deployment
if [ -z "$TAG" ]; then
    TAG=$(echo $SOURCE_IMAGE | cut -d':' -f2)
    if [ "$TAG" = "$SOURCE_IMAGE" ]; then
        TAG="latest"
    fi
fi

# Set the IMAGE variable for the deployment script
export IMAGE="europe-west3-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:$TAG"

echo ""
echo -e "${GREEN}Step 2/2: Deploying to Cloud Run${NC}"
echo "----------------------------------------"
$SCRIPT_DIR/deploy-to-cloud-run.sh

echo ""
echo -e "${GREEN}🎉 GitHub image deployment completed!${NC}"
echo -e "${GREEN}Your AM-Todos application should now be running with the latest fixes${NC}"