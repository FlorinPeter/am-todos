# Operational Scripts

Scripts for AM-Todos development and deployment operations.

## Development Scripts

### restart-dev.sh
Restart development servers (frontend + backend) for local development.

```bash
./hack/restart-dev.sh
```

This will:
- Stop any existing React and Node.js processes
- Start backend server on port 3001
- Start frontend development server on port 3000
- Show access URLs and log file locations

## Deployment Scripts

Quick deployment scripts for AM-Todos to Google Cloud Run.

## Setup

1. **Create environment file:**
   ```bash
   cp env-template.sh env.sh
   # Edit env.sh with your values
   ```

2. **Load environment variables:**
   ```bash
   source env.sh
   ```

3. **Deploy to Cloud Run:**
   ```bash
   ./deploy-to-cloud-run.sh
   ```

## Required Environment Variables

- `GOOGLE_CLOUD_PROJECT` - Your Google Cloud project ID

## Optional Environment Variables

- `SERVICE_NAME` - Cloud Run service name (default: "am-todos")
- `IMAGE` - Container image (default: "ghcr.io/your-username/am-todos:v1.0.0")
- `MEMORY` - Memory allocation (default: "1Gi")
- `CPU` - CPU allocation (default: "1")
- `MIN_INSTANCES` - Minimum instances (default: "0")
- `MAX_INSTANCES` - Maximum instances (default: "10")

## Quick Start

```bash
# Set your project ID and source image
export GOOGLE_CLOUD_PROJECT="my-project-123"
export SOURCE_IMAGE="ghcr.io/your-username/am-todos:v1.0.0"

# One-command deployment
./deploy-all.sh
```

## Deployment Options

### Option 1: Complete deployment (Recommended)
```bash
./deploy-all.sh
```
This pulls the existing image, retags it, pushes to Artifact Registry, and deploys.

### Option 2: Pull and retag existing image
```bash
./pull-and-push.sh
./deploy-to-cloud-run.sh
```

### Option 3: Build from source
```bash
./build-and-push.sh
./deploy-to-cloud-run.sh
```

The scripts will deploy to the Frankfurt region (europe-west3) using Google Artifact Registry.