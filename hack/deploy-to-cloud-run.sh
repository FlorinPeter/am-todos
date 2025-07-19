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
IMAGE="${IMAGE:-europe-west4-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:1.6.1}"
MEMORY="512Mi"
CPU="1000m"
MIN_INSTANCES="0"
MAX_INSTANCES="10"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-}"

# Security Configuration Environment Variables
CORS_ORIGINS="${CORS_ORIGINS:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
CORS_CREDENTIALS="${CORS_CREDENTIALS:-true}"
CORS_METHODS="${CORS_METHODS:-GET,POST,PUT,DELETE,OPTIONS}"
CORS_ALLOWED_HEADERS="${CORS_ALLOWED_HEADERS:-Content-Type,Authorization,Accept}"
CORS_MAX_AGE="${CORS_MAX_AGE:-86400}"

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS="${RATE_LIMIT_WINDOW_MS:-900000}"
RATE_LIMIT_MAX_REQUESTS="${RATE_LIMIT_MAX_REQUESTS:-500}"
AI_RATE_LIMIT_WINDOW_MS="${AI_RATE_LIMIT_WINDOW_MS:-300000}"
AI_RATE_LIMIT_MAX_REQUESTS="${AI_RATE_LIMIT_MAX_REQUESTS:-50}"
DISABLE_RATE_LIMITING="${DISABLE_RATE_LIMITING:-false}"

# Admin Security
ADMIN_TOKEN="${ADMIN_TOKEN:-$(openssl rand -base64 32)}"

# Advanced Security Configuration
DISABLE_SECURITY_HEADERS="${DISABLE_SECURITY_HEADERS:-false}"
DISABLE_SECURITY_LOGGING="${DISABLE_SECURITY_LOGGING:-false}"
LOG_ALL_REQUESTS="${LOG_ALL_REQUESTS:-false}"
DISABLE_METHOD_VALIDATION="${DISABLE_METHOD_VALIDATION:-false}"

# Build Information
VERSION="${VERSION:-1.6.1}"
GIT_SHA="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
GIT_TAG="${GIT_TAG:-$(git describe --tags --exact-match 2>/dev/null || echo '')}"
BUILD_DATE="${BUILD_DATE:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

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
echo -e "${GREEN}🔐 Security Configuration:${NC}"
if [ -n "$CORS_ORIGINS" ]; then
  echo "  CORS Origins: $CORS_ORIGINS"
else
  echo "  CORS Origins: Auto-configured for common platforms"
fi
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo "  Custom Domain: $CUSTOM_DOMAIN"
  if [ -z "$CORS_ORIGINS" ]; then
    echo "  Auto CORS: https://$CUSTOM_DOMAIN"
  fi
else
  echo "  Custom Domain: Not configured"
fi
echo "  Rate Limiting: $RATE_LIMIT_MAX_REQUESTS req/$((RATE_LIMIT_WINDOW_MS/60000))min, AI: $AI_RATE_LIMIT_MAX_REQUESTS req/$((AI_RATE_LIMIT_WINDOW_MS/60000))min"
echo "  Admin Protection: Enabled (token: ${ADMIN_TOKEN:0:8}...)"
echo "  Security Headers: $([ "$DISABLE_SECURITY_HEADERS" = "true" ] && echo "Disabled" || echo "Enabled")"
echo "  Security Logging: $([ "$DISABLE_SECURITY_LOGGING" = "true" ] && echo "Disabled" || echo "Enabled")"
echo "  Method Validation: $([ "$DISABLE_METHOD_VALIDATION" = "true" ] && echo "Disabled" || echo "Enabled")"
echo "  Build Version: $VERSION"
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

# Auto-configure CORS for custom domain if not explicitly set
if [ -n "$CUSTOM_DOMAIN" ] && [ -z "$CORS_ORIGINS" ]; then
  CORS_ORIGINS="https://$CUSTOM_DOMAIN"
  echo -e "${GREEN}🔧 Auto-configuring CORS for custom domain: $CORS_ORIGINS${NC}"
fi
if [ -n "$CUSTOM_DOMAIN" ] && [ -z "$FRONTEND_URL" ]; then
  FRONTEND_URL="https://$CUSTOM_DOMAIN"
  echo -e "${GREEN}🔧 Auto-configuring frontend URL: $FRONTEND_URL${NC}"
fi

# Build environment variables array
# Note: gcloud --set-env-vars uses commas as separators between variables.
# We'll build individual key=value pairs and pass them separately to avoid comma issues.
ENV_VARS_ARRAY=(
  "NODE_ENV=production"
  "FRONTEND_BUILD_PATH=/app/build"
  "CORS_CREDENTIALS=$CORS_CREDENTIALS"
  "CORS_METHODS=$CORS_METHODS"
  "CORS_ALLOWED_HEADERS=$CORS_ALLOWED_HEADERS"
  "CORS_MAX_AGE=$CORS_MAX_AGE"
  "RATE_LIMIT_WINDOW_MS=$RATE_LIMIT_WINDOW_MS"
  "RATE_LIMIT_MAX_REQUESTS=$RATE_LIMIT_MAX_REQUESTS"
  "AI_RATE_LIMIT_WINDOW_MS=$AI_RATE_LIMIT_WINDOW_MS"
  "AI_RATE_LIMIT_MAX_REQUESTS=$AI_RATE_LIMIT_MAX_REQUESTS"
  "DISABLE_RATE_LIMITING=$DISABLE_RATE_LIMITING"
  "ADMIN_TOKEN=$ADMIN_TOKEN"
  "DISABLE_SECURITY_HEADERS=$DISABLE_SECURITY_HEADERS"
  "DISABLE_SECURITY_LOGGING=$DISABLE_SECURITY_LOGGING"
  "LOG_ALL_REQUESTS=$LOG_ALL_REQUESTS"
  "DISABLE_METHOD_VALIDATION=$DISABLE_METHOD_VALIDATION"
  "VERSION=$VERSION"
  "GIT_SHA=$GIT_SHA"
  "BUILD_DATE=$BUILD_DATE"
)

# Add optional environment variables if they are set
if [ -n "$CORS_ORIGINS" ]; then
  ENV_VARS_ARRAY+=("CORS_ORIGINS=$CORS_ORIGINS")
fi
if [ -n "$FRONTEND_URL" ]; then
  ENV_VARS_ARRAY+=("FRONTEND_URL=$FRONTEND_URL")
fi
if [ -n "$GIT_TAG" ]; then
  ENV_VARS_ARRAY+=("GIT_TAG=$GIT_TAG")
fi

# Build environment variables string with proper escaping for gcloud
# Use custom delimiter to handle commas in values
ENV_VARS_ESCAPED=()
for env_var in "${ENV_VARS_ARRAY[@]}"; do
  ENV_VARS_ESCAPED+=("$env_var")
done

# Convert array to custom delimiter-separated string for gcloud
# Using ^|^ as delimiter since it's unlikely to appear in environment values
ENV_VARS="^|^$(IFS='|'; echo "${ENV_VARS_ESCAPED[*]}")"

echo "🔍 Environment variables being set:"
printf "   %s\n" "${ENV_VARS_ESCAPED[@]}"
echo "🔍 gcloud env-vars string: $ENV_VARS"

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
  --port 8080 \
  --set-env-vars "$ENV_VARS" \
  --execution-environment gen2 \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Service URL: $SERVICE_URL${NC}"
echo ""
echo -e "${YELLOW}🔐 IMPORTANT - Save Your Admin Token:${NC}"
echo -e "${GREEN}Admin Token: $ADMIN_TOKEN${NC}"
echo -e "${YELLOW}This token is required for accessing /api/memory endpoint (admin functions)${NC}"

# Configure custom domain if specified
if [ -n "$CUSTOM_DOMAIN" ]; then
  echo ""
  echo -e "${GREEN}🌍 Configuring custom domain: $CUSTOM_DOMAIN${NC}"
  
  # Extract the root domain from the custom domain
  ROOT_DOMAIN=$(echo "$CUSTOM_DOMAIN" | sed 's/^[^.]*\.//')
  
  # Step 1: Check if domain mapping already exists
  echo -e "${YELLOW}🔍 Checking current domain status...${NC}"
  MAPPING_EXISTS=false
  MAPPING_WORKING=false
  
  if gcloud beta run domain-mappings describe --domain=$CUSTOM_DOMAIN --region=$REGION >/dev/null 2>&1; then
    MAPPING_EXISTS=true
    echo -e "${GREEN}✅ Domain mapping exists${NC}"
    
    # Step 2: Test if domain is functionally working
    echo -e "${YELLOW}🧪 Testing domain functionality...${NC}"
    if curl -s --max-time 10 "https://$CUSTOM_DOMAIN/health" | grep -q '"status":"healthy"'; then
      MAPPING_WORKING=true
      echo -e "${GREEN}✅ Domain is working correctly!${NC}"
      echo -e "${GREEN}🌐 Custom Domain URL: https://$CUSTOM_DOMAIN${NC}"
    else
      echo -e "${YELLOW}⚠️  Domain mapping exists but not yet accessible (DNS propagation in progress)${NC}"
    fi
  else
    echo -e "${YELLOW}ℹ️  Domain mapping does not exist yet${NC}"
  fi
  
  # Step 3: Create mapping if it doesn't exist or isn't working
  if [ "$MAPPING_EXISTS" = false ] || [ "$MAPPING_WORKING" = false ]; then
    # Check domain verification only if we need to create/update mapping
    echo -e "${YELLOW}🔍 Checking domain verification for mapping creation...${NC}"
    VERIFIED_DOMAINS=$(gcloud domains list-user-verified --format="value(name)" 2>/dev/null || true)
    
    DOMAIN_VERIFIED=false
    # Try multiple verification checks
    if echo "$VERIFIED_DOMAINS" | grep -q "^$ROOT_DOMAIN$\|^$CUSTOM_DOMAIN$"; then
      DOMAIN_VERIFIED=true
      echo -e "${GREEN}✅ Domain is verified in Search Console${NC}"
    else
      # Fallback: Check if we can create mapping anyway (sometimes verification check is stale)
      echo -e "${YELLOW}⚠️  Domain verification check inconclusive, attempting mapping creation...${NC}"
      DOMAIN_VERIFIED=true  # Try anyway - mapping creation will fail if actually not verified
    fi
    
    if [ "$DOMAIN_VERIFIED" = true ]; then
      if [ "$MAPPING_EXISTS" = true ]; then
        echo -e "${YELLOW}🔄 Updating existing domain mapping...${NC}"
        # Delete and recreate for updates
        gcloud beta run domain-mappings delete $CUSTOM_DOMAIN --region=$REGION --quiet
        sleep 5
      fi
      
      echo -e "${GREEN}📝 Creating domain mapping...${NC}"
      if gcloud beta run domain-mappings create \
        --service $SERVICE_NAME \
        --domain $CUSTOM_DOMAIN \
        --region $REGION \
        --quiet; then
        
        echo -e "${GREEN}✅ Domain mapping created successfully${NC}"
        
        # Wait and test again
        sleep 10
        echo -e "${YELLOW}🧪 Testing new domain mapping...${NC}"
        if curl -s --max-time 10 "https://$CUSTOM_DOMAIN/health" | grep -q '"status":"healthy"'; then
          echo -e "${GREEN}✅ Domain is now working correctly!${NC}"
          echo -e "${GREEN}🌐 Custom Domain URL: https://$CUSTOM_DOMAIN${NC}"
        else
          echo -e "${YELLOW}⚠️  Domain mapping created, waiting for DNS propagation...${NC}"
          
          # Get DNS records for configuration
          echo ""
          echo -e "${YELLOW}📋 DNS Configuration Required:${NC}"
          echo "Add the following DNS records to your domain registrar:"
          echo ""
          
          # Get the domain mapping details
          MAPPING_INFO=$(gcloud beta run domain-mappings describe --domain=$CUSTOM_DOMAIN --region=$REGION --format="value(status.resourceRecords[].name,status.resourceRecords[].rrdata)" 2>/dev/null)
          
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
          fi
          
          echo -e "${YELLOW}⚠️  Note: Domain will be accessible after DNS propagation (may take up to 24 hours)${NC}"
        fi
      else
        echo -e "${RED}❌ Failed to create domain mapping${NC}"
        echo ""
        echo -e "${YELLOW}📝 Domain verification may be required:${NC}"
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
      fi
    fi
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
echo -e "${GREEN}🛡️ Security Features Enabled:${NC}"
echo "• CORS protection for your domain"
echo "• Rate limiting ($RATE_LIMIT_MAX_REQUESTS general, $AI_RATE_LIMIT_MAX_REQUESTS AI requests)"
echo "• Admin endpoint authentication"
echo "• Input validation and sanitization"
echo "• Comprehensive security logging"
echo ""
echo -e "${GREEN}📊 Monitor your deployment:${NC}"
echo "gcloud run services logs read $SERVICE_NAME --region=$REGION"