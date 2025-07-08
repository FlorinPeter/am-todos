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

echo "4️⃣  Live Application Memory Usage:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" 2>/dev/null)
if [ ! -z "$SERVICE_URL" ]; then
    echo "   curl $SERVICE_URL/api/memory"
    echo ""
    
    echo "🧪 Current Memory Usage from Application:"
    MEMORY_DATA=$(curl -s "$SERVICE_URL/api/memory" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$MEMORY_DATA" ]; then
        echo "$MEMORY_DATA" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"📅 Timestamp: {data['timestamp']}\")
    print(f\"⏱️  Uptime: {data['uptime']}\")
    print()
    print('💾 Node.js Memory Breakdown:')
    memory = data['memory']
    print(f\"  RSS (Total):     {memory['rss']:<12} - Total memory allocated to process\")
    print(f\"  Heap Used:       {memory['heapUsed']:<12} - JavaScript heap actually used\")
    print(f\"  Heap Total:      {memory['heapTotal']:<12} - Total JavaScript heap allocated\")
    print(f\"  External:        {memory['external']:<12} - C++ objects bound to JavaScript\")
    print(f\"  Array Buffers:   {memory['arrayBuffers']:<12} - ArrayBuffers allocated\")
    print()
    
    # Calculate Cloud Run usage (update this based on your deployment)
    rss_mb = float(memory['rss'].replace(' MB', ''))
    heap_mb = float(memory['heapUsed'].replace(' MB', ''))
    cloud_run_limit = 256  # 256Mi in MB (was 1024 for 1Gi)
    
    print('📊 Cloud Run Usage Analysis:')
    print(f\"  Container Limit: 256Mi ({cloud_run_limit} MB)\")
    print(f\"  Current RSS:     {rss_mb:.1f} MB ({rss_mb/cloud_run_limit*100:.1f}%)\")
    print(f\"  JS Heap Used:    {heap_mb:.1f} MB ({heap_mb/cloud_run_limit*100:.1f}%)\")
    
    # Health indicators (adjusted for 256Mi limit)
    usage_percent = rss_mb / cloud_run_limit
    if usage_percent > 0.8:  # >80%
        print(f\"  🔴 Status:       HIGH - Memory usage above 80%\")
        print(f\"     Recommendation: Consider increasing memory limit or optimizing\")
    elif usage_percent > 0.6:  # >60%
        print(f\"  🟡 Status:       MEDIUM - Memory usage above 60%\")
        print(f\"     Recommendation: Monitor closely for trends\")
    else:
        print(f\"  🟢 Status:       HEALTHY - Memory usage below 60%\")
    
    print()
    print('📈 Monitoring Tips:')
    print(f\"  • This is Node.js process memory, not container memory\")
    print(f\"  • RSS includes all memory (heap + native + buffers)\")
    print(f\"  • Heap Used is your JavaScript application memory\")
    print(f\"  • Compare with Cloud Console metrics for full picture\")

except Exception as e:
    print(f'❌ Error parsing memory data: {e}')
    print('Raw response:')
    print(sys.stdin.read())
" 2>/dev/null
    else
        echo "   ❌ Failed to fetch memory data from application"
    fi
    echo ""
    
    echo "🩺 Service Health Check:"
    curl -s "$SERVICE_URL/health" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"  Status: {data.get('status', 'unknown')}\")
    print(f\"  Port: {data.get('port', 'unknown')}\")
    print(f\"  Environment: {data.get('nodeEnv', 'unknown')}\")
except:
    print('  ❌ Health check failed or invalid response')
" 2>/dev/null || echo "   ❌ Health check failed"
    echo ""
fi

echo "💾 Memory Usage Interpretation:"
echo "   • Memory limit: 256Mi (256 MB)"
echo "   • Google Cloud metrics shown as percentage (0.0 to 1.0)"
echo "   • 0.25 = 25% = ~64 MB used"
echo "   • Monitor for sustained >60% usage"
echo "   • Scale up if consistently >80%"
echo ""

echo "💡 Pro Tips:"
echo "   • Memory metrics may lag by 1-2 minutes"
echo "   • Service scales to zero when idle (no metrics)"
echo "   • Check 'Container instances' chart for scaling events"
echo "   • Use Cloud Console for real-time graphs"