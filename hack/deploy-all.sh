#!/bin/bash

# Complete deployment script: Pull existing image, retag, push, and deploy to Cloud Run
# This is a one-command deployment that handles everything

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Complete AM-Todos deployment to Google Cloud Run${NC}"
echo -e "${GREEN}   This will pull, retag, push, and deploy the application${NC}"
echo ""

# Check required environment variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo -e "${RED}❌ Error: GOOGLE_CLOUD_PROJECT environment variable is required${NC}"
    echo "Export it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}Step 1/2: Pulling and pushing image to Artifact Registry${NC}"
echo "----------------------------------------"
$SCRIPT_DIR/pull-and-push.sh

# Extract the tag from SOURCE_IMAGE to use for deployment
if [ -z "$TAG" ]; then
    TAG=$(echo ${SOURCE_IMAGE:-ghcr.io/your-username/am-todos:v1.0.0} | cut -d':' -f2)
    if [ "$TAG" = "${SOURCE_IMAGE:-ghcr.io/your-username/am-todos:v1.0.0}" ]; then
        TAG="latest"
    fi
fi

# Set the IMAGE variable for the deployment script
export IMAGE="europe-west4-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:$TAG"

# Pass through custom domain if set
if [ -n "$CUSTOM_DOMAIN" ]; then
  export CUSTOM_DOMAIN="$CUSTOM_DOMAIN"
fi

echo ""
echo -e "${GREEN}Step 2/2: Deploying to Cloud Run${NC}"
echo "----------------------------------------"
$SCRIPT_DIR/deploy-to-cloud-run.sh

echo ""
echo -e "${GREEN}🎉 Complete deployment finished!${NC}"
echo -e "${GREEN}Your AM-Todos application is now running on Google Cloud Run${NC}"