#!/bin/bash

# Pull existing image from GitHub Container Registry and push to Google Artifact Registry
# This avoids rebuilding and reuses the existing v1.0.0 image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Pulling and retagging AM-Todos image${NC}"

# Check required environment variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo -e "${RED}❌ Error: GOOGLE_CLOUD_PROJECT environment variable is required${NC}"
    echo "Export it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

# Configuration
REGION="europe-west4"  # Netherlands (supports custom domains)
SOURCE_IMAGE="${SOURCE_IMAGE:-ghcr.io/your-username/am-todos:v1.0.0}"

# Extract tag from source image if not explicitly set
if [ -z "$TAG" ]; then
    TAG=$(echo $SOURCE_IMAGE | cut -d':' -f2)
    if [ "$TAG" = "$SOURCE_IMAGE" ]; then
        TAG="latest"
    fi
fi

TARGET_IMAGE="europe-west4-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:$TAG"

echo -e "${GREEN}📋 Image Migration Configuration:${NC}"
echo "  Project: $GOOGLE_CLOUD_PROJECT"
echo "  Region: $REGION"
echo "  Source: $SOURCE_IMAGE"
echo "  Target: $TARGET_IMAGE"
echo ""

# Set the project
echo -e "${GREEN}🏗️  Setting project...${NC}"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable required APIs
echo -e "${GREEN}🔧 Enabling required APIs...${NC}"
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo -e "${GREEN}🏗️  Setting up Artifact Registry...${NC}"
if ! gcloud artifacts repositories describe am-todos --location=$REGION >/dev/null 2>&1; then
    echo -e "${GREEN}📦 Creating Artifact Registry repository...${NC}"
    gcloud artifacts repositories create am-todos \
        --repository-format=docker \
        --location=$REGION \
        --description="AM-Todos container registry"
else
    echo -e "${GREEN}✅ Artifact Registry repository already exists${NC}"
fi

# Configure Docker authentication
echo -e "${GREEN}🔐 Configuring Docker authentication...${NC}"
gcloud auth configure-docker europe-west4-docker.pkg.dev

# Pull the source image
echo -e "${GREEN}📥 Pulling source image...${NC}"
if ! docker pull $SOURCE_IMAGE; then
    echo -e "${RED}❌ Failed to pull source image: $SOURCE_IMAGE${NC}"
    echo -e "${YELLOW}💡 Make sure the image exists and is publicly accessible${NC}"
    echo -e "${YELLOW}💡 Or update SOURCE_IMAGE environment variable with the correct image${NC}"
    exit 1
fi

# Tag the image for Google Artifact Registry
echo -e "${GREEN}🏷️  Tagging image for Artifact Registry...${NC}"
docker tag $SOURCE_IMAGE $TARGET_IMAGE

# Push the image
echo -e "${GREEN}📤 Pushing image to Artifact Registry...${NC}"
docker push $TARGET_IMAGE

# Clean up local images (optional)
echo -e "${GREEN}🧹 Cleaning up local images...${NC}"
docker rmi $SOURCE_IMAGE $TARGET_IMAGE 2>/dev/null || true

echo -e "${GREEN}✅ Image migration completed successfully!${NC}"
echo -e "${GREEN}🐳 Image: $TARGET_IMAGE${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Run the deployment script: ./deploy-to-cloud-run.sh"
echo "2. Or set custom image: export IMAGE=$TARGET_IMAGE && ./deploy-to-cloud-run.sh"