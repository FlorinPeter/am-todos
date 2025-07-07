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

Production-ready deployment scripts for AM-Todos to Google Cloud Run with custom domain support.

## Quick Start

```bash
# Set your project ID and source image
export GOOGLE_CLOUD_PROJECT="my-project-123"
export SOURCE_IMAGE="ghcr.io/your-username/am-todos:v1.0.0"

# Optional: Set custom domain (requires domain verification)
export CUSTOM_DOMAIN="todo.yourdomain.com"

# One-command deployment
./deploy-all.sh
```

## Environment Variables

### Required
- `GOOGLE_CLOUD_PROJECT` - Your Google Cloud project ID

### Optional
- `SOURCE_IMAGE` - Source container image (default: "ghcr.io/your-username/am-todos:v1.0.0")
- `SERVICE_NAME` - Cloud Run service name (default: "am-todos")
- `CUSTOM_DOMAIN` - Custom domain for the service (e.g., "todo.yourdomain.com")
- `MEMORY` - Memory allocation (default: "1Gi")
- `CPU` - CPU allocation (default: "1")
- `MIN_INSTANCES` - Minimum instances (default: "0")
- `MAX_INSTANCES` - Maximum instances (default: "10")

## Deployment Options

### Option 1: Complete deployment (Recommended)
```bash
./deploy-all.sh
```
Pulls existing image, retags it, pushes to Artifact Registry, and deploys with optional custom domain.

### Option 2: Step-by-step deployment
```bash
./pull-and-push.sh      # Pull and retag image
./deploy-to-cloud-run.sh # Deploy to Cloud Run
```

### Option 3: Build from source
```bash
./build-and-push.sh     # Build from local source
./deploy-to-cloud-run.sh # Deploy to Cloud Run
```

## Custom Domain Setup

The deployment script automatically handles custom domain configuration:

1. **Domain Verification Required**: Verify your domain in [Google Search Console](https://search.google.com/search-console) first
2. **DNS Configuration**: The script provides the DNS records you need to add to your domain registrar
3. **SSL Certificate**: Google automatically provisions SSL certificates for custom domains
4. **Region**: Uses europe-west4 (Netherlands) which supports custom domain mapping

### Example DNS Configuration
```
Type: CNAME
Name: todo (or your subdomain)
Value: ghs.googlehosted.com.
```

**Important**: Disable proxy mode in Cloudflare (gray cloud, not orange) to avoid redirect loops.

## Production Notes

- **Region**: europe-west4 (Netherlands) for custom domain support
- **Registry**: Google Artifact Registry for container storage  
- **SSL**: Automatic HTTPS with Google-managed certificates
- **Scaling**: Scales to zero when not in use (min-instances=0)
- **Environment**: Production builds with optimized React frontend