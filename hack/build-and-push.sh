#!/bin/bash

# Build and push AM-Todos to Google Artifact Registry
# This script builds the Docker image and pushes it to Frankfurt region

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔨 Building and pushing AM-Todos to Artifact Registry${NC}"

# Check required environment variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo -e "${RED}❌ Error: GOOGLE_CLOUD_PROJECT environment variable is required${NC}"
    echo "Export it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

# Configuration
REGION="europe-west4"  # Netherlands (supports custom domains)
TAG="${TAG:-v1.0.0}"
IMAGE="europe-west4-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:$TAG"
DOCKERFILE_PATH="../Dockerfile"

echo -e "${GREEN}📋 Build Configuration:${NC}"
echo "  Project: $GOOGLE_CLOUD_PROJECT"
echo "  Region: $REGION"
echo "  Image: $IMAGE"
echo "  Tag: $TAG"
echo ""

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    echo -e "${RED}❌ Dockerfile not found at $DOCKERFILE_PATH${NC}"
    exit 1
fi

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

# Get build information
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=$(grep '"version"' ../package.json | cut -d'"' -f4 2>/dev/null || echo "0.1.0")

echo -e "${GREEN}📋 Version Information:${NC}"
echo "  Version: $VERSION"
echo "  Git SHA: $GIT_SHA"
echo "  Git Tag: $GIT_TAG"
echo "  Build Date: $BUILD_DATE"
echo ""

# Build the Docker image with version information
echo -e "${GREEN}🔨 Building Docker image...${NC}"
docker build \
  -f $DOCKERFILE_PATH \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg GIT_TAG="$GIT_TAG" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg VERSION="$VERSION" \
  -t $IMAGE \
  ..

# Push the image
echo -e "${GREEN}📤 Pushing image to Artifact Registry...${NC}"
docker push $IMAGE

echo -e "${GREEN}✅ Build and push completed successfully!${NC}"
echo -e "${GREEN}🐳 Image: $IMAGE${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Run the deployment script: ./deploy-to-cloud-run.sh"
echo "2. Or set custom image: export IMAGE=$IMAGE && ./deploy-to-cloud-run.sh"