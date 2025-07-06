#!/bin/bash

# Install Docker and other required dependencies on Debian/Ubuntu
# This script installs Docker, Google Cloud CLI, and other tools needed for deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Installing dependencies for AM-Todos deployment${NC}"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Update package list
echo -e "${GREEN}📦 Updating package list...${NC}"
apt-get update

# Install basic dependencies
echo -e "${GREEN}🔧 Installing basic dependencies...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    wget \
    unzip

# Install Docker
echo -e "${GREEN}🐳 Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package list again
    apt-get update
    
    # Install Docker
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start and enable Docker service
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker installed successfully${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Install Google Cloud CLI
echo -e "${GREEN}☁️  Installing Google Cloud CLI...${NC}"
if ! command -v gcloud &> /dev/null; then
    # Add Google Cloud CLI repository
    curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
    
    echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
    
    # Update package list
    apt-get update
    
    # Install Google Cloud CLI
    apt-get install -y google-cloud-cli
    
    echo -e "${GREEN}✅ Google Cloud CLI installed successfully${NC}"
else
    echo -e "${GREEN}✅ Google Cloud CLI already installed${NC}"
fi

# Add current user to docker group (if not root)
if [[ -n "$SUDO_USER" ]]; then
    echo -e "${GREEN}👤 Adding $SUDO_USER to docker group...${NC}"
    usermod -aG docker $SUDO_USER
    echo -e "${YELLOW}⚠️  Please log out and log back in for docker group changes to take effect${NC}"
fi

# Verify installations
echo -e "${GREEN}🔍 Verifying installations...${NC}"
echo "Docker version:"
docker --version

echo "Google Cloud CLI version:"
gcloud --version

echo ""
echo -e "${GREEN}✅ All dependencies installed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Log out and log back in (or restart your session)"
echo "2. Run: gcloud auth login"
echo "3. Set your project: export GOOGLE_CLOUD_PROJECT=your-project-id"
echo "4. Run deployment: ./deploy-all.sh"
echo ""
echo -e "${GREEN}🎉 Ready to deploy AM-Todos to Google Cloud Run!${NC}"