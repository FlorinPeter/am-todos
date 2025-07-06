#!/bin/bash

# Deploy AM-Todos to Google Cloud Run (Frankfurt region)
# This script uses the GitHub container image v1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying AM-Todos to Google Cloud Run (Frankfurt)${NC}"

# Check required environment variables
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo -e "${RED}❌ Error: GOOGLE_CLOUD_PROJECT environment variable is required${NC}"
    echo "Export it with: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

if [ -z "$SERVICE_NAME" ]; then
    echo -e "${YELLOW}⚠️  SERVICE_NAME not set, using default: am-todos${NC}"
    SERVICE_NAME="am-todos"
fi

# Configuration
REGION="europe-west3"  # Frankfurt
IMAGE="${IMAGE:-europe-west3-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:v1.0.0}"
MEMORY="1Gi"
CPU="1"
MIN_INSTANCES="0"
MAX_INSTANCES="10"

echo -e "${GREEN}📋 Deployment Configuration:${NC}"
echo "  Project: $GOOGLE_CLOUD_PROJECT"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Image: $IMAGE"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Port: Dynamic (set by Cloud Run)"
echo "  Container Port: Auto-detected"
echo ""

# Check if user is authenticated
echo -e "${GREEN}🔐 Checking authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not authenticated with Google Cloud${NC}"
    echo "Run: gcloud auth login"
    exit 1
fi

# Set the project
echo -e "${GREEN}🏗️  Setting project...${NC}"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable required APIs
echo -e "${GREEN}🔧 Enabling required APIs...${NC}"
gcloud services enable run.googleapis.com
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

# Deploy to Cloud Run
echo -e "${GREEN}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory $MEMORY \
  --cpu $CPU \
  --min-instances $MIN_INSTANCES \
  --max-instances $MAX_INSTANCES \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,FRONTEND_BUILD_PATH=/app/build" \
  --execution-environment gen2 \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Visit the service URL to configure your GitHub token and AI API keys"
echo "2. Set up your repository and folder preferences"
echo "3. Start creating AI-powered todos!"
echo ""
echo -e "${GREEN}🔧 To update the deployment with a new image:${NC}"
echo "export IMAGE=ghcr.io/your-username/am-todos:v1.0.1"
echo "./deploy-to-cloud-run.sh"