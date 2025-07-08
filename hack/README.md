# Deployment and Monitoring Scripts

This directory contains scripts for deploying and monitoring the AM-Todos application.

## 🔒 Security Notice

**IMPORTANT**: Never commit Google Cloud project IDs or other sensitive information to the repository!

## 🌍 Environment Setup

Before using these scripts, set your Google Cloud project:

```bash
# Set environment variable (recommended)
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Or configure gcloud
gcloud config set project your-project-id
```

For convenience, you can create a `.env` file (which is gitignored):

```bash
# Copy the example
cp .env.example .env

# Edit with your values
nano .env

# Source it
source .env
```

## 📊 Memory Monitoring

### Quick Memory Check
```bash
./hack/cloudrun-memory.sh
```

This script provides:
- Current service configuration
- Direct links to Cloud Console metrics
- Command-line monitoring options
- Health check results

### Monitoring Options

1. **Cloud Console** (Recommended)
   - Real-time graphs and historical data
   - Multiple metrics in one dashboard

2. **Command Line** (Advanced)
   ```bash
   gcloud monitoring read \
     --project="$GOOGLE_CLOUD_PROJECT" \
     --freshness="5m" \
     --window="5m" \
     'metric.type="run.googleapis.com/container/memory/utilization" resource.type="cloud_run_revision" resource.label."service_name"="am-todos"'
   ```

3. **Application Endpoint**
   ```bash
   curl https://your-service-url/api/memory
   ```

## 🚀 Deployment Scripts

- `build-with-version.sh` - Local build with version info
- `build-and-push.sh` - Build and push to Artifact Registry
- `deploy-to-cloud-run.sh` - Deploy to Cloud Run
- `deploy-all.sh` - Complete deployment pipeline

## 💾 Memory Usage Interpretation

- **Memory Limit**: 1Gi (1024 MB)
- **Values**: Shown as decimal (0.0 to 1.0)
- **Example**: 0.25 = 25% = ~256 MB used
- **Thresholds**:
  - Green: < 60% usage
  - Yellow: 60-80% usage  
  - Red: > 80% usage (consider scaling)

## 🔧 Development Scripts

- `restart-dev.sh` - Restart development servers
- `memory-usage.sh` - Local development memory monitoring