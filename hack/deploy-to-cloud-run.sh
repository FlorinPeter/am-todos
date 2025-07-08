#!/bin/bash

# Deploy AM-Todos to Google Cloud Run (Netherlands region)
# This script uses the GitHub container image v1.1.0
# Optimized for gen2 execution environment with 1 CPU and 512Mi memory

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
REGION="europe-west4"  # Netherlands (supports custom domains)
IMAGE="${IMAGE:-europe-west4-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:v1.1.0}"
MEMORY="512Mi"
CPU="1000m"
MIN_INSTANCES="0"
MAX_INSTANCES="10"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-}"

echo -e "${GREEN}📋 Deployment Configuration:${NC}"
echo "  Project: $GOOGLE_CLOUD_PROJECT"
echo "  Service: $SERVICE_NAME"
echo "  Region: $REGION"
echo "  Image: $IMAGE"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Port: Dynamic (set by Cloud Run)"
echo "  Container Port: Auto-detected"
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo "  Custom Domain: $CUSTOM_DOMAIN"
else
  echo "  Custom Domain: Not configured"
fi
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

# Configure custom domain if specified
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo ""
  echo -e "${GREEN}🌍 Configuring custom domain: $CUSTOM_DOMAIN${NC}"
  
  # Extract the root domain from the custom domain
  ROOT_DOMAIN=$(echo "$CUSTOM_DOMAIN" | sed 's/^[^.]*\.//')
  
  # Check if domain is verified
  echo -e "${YELLOW}🔍 Checking domain verification...${NC}"
  VERIFIED_DOMAINS=$(gcloud domains list-user-verified --format="value(name)" 2>/dev/null || true)
  
  DOMAIN_VERIFIED=false
  if echo "$VERIFIED_DOMAINS" | grep -q "^$ROOT_DOMAIN$\|^$CUSTOM_DOMAIN$"; then
    DOMAIN_VERIFIED=true
    echo -e "${GREEN}✅ Domain is verified${NC}"
  else
    echo -e "${RED}❌ Domain '$ROOT_DOMAIN' is not verified${NC}"
    echo ""
    echo -e "${YELLOW}📝 Domain verification required:${NC}"
    echo "Choose one of these methods:"
    echo ""
    echo -e "${GREEN}Method 1: Google Cloud Console${NC}"
    echo "1. Visit: https://console.cloud.google.com/run/domains?project=$GOOGLE_CLOUD_PROJECT"
    echo "2. Click 'Add mapping' and enter: $CUSTOM_DOMAIN"
    echo "3. Follow the domain verification steps"
    echo ""
    echo -e "${GREEN}Method 2: Google Search Console (Easier)${NC}"
    echo "1. Visit: https://search.google.com/search-console"
    echo "2. Add property for: $ROOT_DOMAIN"
    echo "3. Verify using DNS TXT record or HTML file"
    echo "4. Once verified in Search Console, the domain is automatically available in Cloud Run"
    echo ""
    echo -e "${YELLOW}After verification, run the deployment again${NC}"
    echo ""
    DOMAIN_VERIFIED=false
  fi
  
  if [ "$DOMAIN_VERIFIED" = true ]; then
    # Check if domain mapping already exists
    if gcloud beta run domain-mappings describe $CUSTOM_DOMAIN --region=$REGION >/dev/null 2>&1; then
      echo -e "${YELLOW}⚠️  Domain mapping already exists, updating...${NC}"
      # For updates, we need to delete and recreate
      gcloud beta run domain-mappings delete $CUSTOM_DOMAIN --region=$REGION --quiet
      sleep 5
    fi
    
    echo -e "${GREEN}📝 Creating new domain mapping...${NC}"
    gcloud beta run domain-mappings create \
      --service $SERVICE_NAME \
      --domain $CUSTOM_DOMAIN \
      --region $REGION \
      --quiet
  
    # Wait a moment for the mapping to be created
    sleep 10
    
    # Get DNS records for verification
    echo ""
    echo -e "${YELLOW}📋 DNS Configuration Required:${NC}"
    echo "Add the following DNS records to your domain registrar:"
    echo ""
    
    # Get the domain mapping details
    MAPPING_INFO=$(gcloud beta run domain-mappings describe $CUSTOM_DOMAIN --region=$REGION --format="value(status.resourceRecords[].name,status.resourceRecords[].rrdata)" 2>/dev/null)
    
    if [ -n "$MAPPING_INFO" ]; then
      echo "$MAPPING_INFO" | while IFS=$'\t' read -r name rrdata; do
        if [ -n "$name" ] && [ -n "$rrdata" ]; then
          echo "  Type: CNAME"
          echo "  Name: $name"
          echo "  Value: $rrdata"
          echo ""
        fi
      done
    else
      echo "  Could not retrieve DNS records automatically."
      echo "  Please check the Google Cloud Console for DNS configuration details:"
      echo "  https://console.cloud.google.com/run/domains?project=$GOOGLE_CLOUD_PROJECT"
      echo ""
    fi
    
    echo -e "${GREEN}🌐 Custom Domain URL: https://$CUSTOM_DOMAIN${NC}"
    echo -e "${YELLOW}⚠️  Note: Domain will be accessible after DNS propagation (may take up to 24 hours)${NC}"
  fi
fi

echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo "1. Configure DNS records as shown above"
  echo "2. Wait for DNS propagation"
  echo "3. Visit https://$CUSTOM_DOMAIN to configure your GitHub token and AI API keys"
else
  echo "1. Visit the service URL to configure your GitHub token and AI API keys"
fi
echo "2. Set up your repository and folder preferences"
echo "3. Start creating AI-powered todos!"
echo ""
echo -e "${GREEN}🔧 To deploy with a custom domain:${NC}"
echo "export CUSTOM_DOMAIN=\"your-domain.com\""
echo "./deploy-to-cloud-run.sh"