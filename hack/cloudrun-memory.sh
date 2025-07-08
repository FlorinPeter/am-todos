#!/bin/bash

# Get Cloud Run memory usage information and links
# Usage: ./hack/cloudrun-memory.sh

set -e

SERVICE_NAME="am-todos"
REGION="europe-west4"

# Try to get project ID from environment variable first, then gcloud config
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No Google Cloud project configured"
    echo "Set environment variable: export GOOGLE_CLOUD_PROJECT=\"your-project-id\""
    echo "Or run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "☁️  Cloud Run Memory Usage Monitor"
echo "🌍 Project: $PROJECT_ID"
echo "🚀 Service: $SERVICE_NAME"
echo "📍 Region: $REGION"
echo ""

# Check if service exists and get current configuration
echo "📊 Service Configuration:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(
  spec.template.spec.containers[0].resources.limits.memory:label='Memory Limit',
  spec.template.spec.containers[0].resources.limits.cpu:label='CPU Limit',
  spec.template.spec.containerConcurrency:label='Max Concurrency',
  status.latestCreatedRevisionName:label='Latest Revision'
)" 2>/dev/null

echo ""

# Get current running instances
echo "🏃 Current Status:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(
  status.conditions[0].type:label='Status',
  status.conditions[0].status:label='Ready',
  status.url:label='Service URL'
)" 2>/dev/null

echo ""

# Check recent revisions
echo "📦 Recent Revisions (with traffic):"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(
  status.traffic[].revisionName:label='Revision',
  status.traffic[].percent:label='Traffic %',
  status.traffic[].latestRevision:label='Latest'
)" 2>/dev/null

echo ""

# Generate monitoring queries and URLs
echo "📈 Memory Monitoring Options:"
echo ""

echo "1️⃣  Cloud Console Metrics (Recommended):"
echo "   https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics?project=$PROJECT_ID"
echo ""

echo "2️⃣  Cloud Monitoring Explorer:"
MONITORING_URL="https://console.cloud.google.com/monitoring/metrics-explorer?project=$PROJECT_ID"
echo "   $MONITORING_URL"
echo "   📋 Metric to add: run.googleapis.com/container/memory/utilization"
echo "   🎯 Filter: service_name = $SERVICE_NAME"
echo ""

echo "3️⃣  Command Line (if gcloud monitoring read is available):"
echo "   gcloud monitoring read \\"
echo "     --project=\"$PROJECT_ID\" \\"
echo "     --freshness=\"5m\" \\"
echo "     --window=\"5m\" \\"
echo "     'metric.type=\"run.googleapis.com/container/memory/utilization\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"$SERVICE_NAME\"'"
echo ""

echo "4️⃣  Test current service health:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null)
if [ ! -z "$SERVICE_URL" ]; then
    echo "   curl $SERVICE_URL/api/memory"
    echo "   curl $SERVICE_URL/health"
    echo ""
    
    echo "🧪 Testing service endpoints..."
    echo "Health check:"
    curl -s "$SERVICE_URL/health" 2>/dev/null | head -3 || echo "   ❌ Health check failed"
    echo ""
fi

echo "💾 Memory Usage Interpretation:"
echo "   • Memory limit: 1Gi (1024 MB)"
echo "   • Values shown as percentage (0.0 to 1.0)"
echo "   • 0.25 = 25% = ~256 MB used"
echo "   • Monitor for sustained >60% usage"
echo "   • Scale up if consistently >80%"
echo ""

echo "💡 Pro Tips:"
echo "   • Memory metrics may lag by 1-2 minutes"
echo "   • Service scales to zero when idle (no metrics)"
echo "   • Check 'Container instances' chart for scaling events"
echo "   • Use Cloud Console for real-time graphs"