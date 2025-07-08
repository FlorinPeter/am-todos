#!/bin/bash

# Monitor Cloud Run memory usage
# Usage: ./hack/monitor-memory.sh

set -e

SERVICE_NAME="am-todos"
REGION="europe-west4"

echo "🔍 Monitoring Cloud Run service: $SERVICE_NAME"
echo "📍 Region: $REGION"
echo ""

# Check current resource limits
echo "📊 Current Resource Configuration:"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(
  spec.template.spec.containers[0].resources.limits.memory:label='Memory Limit',
  spec.template.spec.containers[0].resources.limits.cpu:label='CPU Limit',
  spec.template.spec.containerConcurrency:label='Max Concurrency'
)"
echo ""

# Get recent revision info
echo "🚀 Recent Revisions:"
gcloud run revisions list --service=$SERVICE_NAME --region=$REGION --limit=3 --format="table(
  metadata.name:label='Revision',
  status.conditions[0].lastTransitionTime:label='Last Updated',
  spec.containers[0].resources.limits.memory:label='Memory',
  spec.containers[0].resources.limits.cpu:label='CPU'
)"
echo ""

# Check recent logs
echo "📝 Recent Logs (last 20 entries):"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" --limit=20 --format="table(
  timestamp,
  resource.labels.revision_name:label='Revision',
  severity,
  jsonPayload.message:label='Message'
)"

echo ""
echo "💡 Tips:"
echo "  - View detailed metrics: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME/metrics"
echo "  - Check logs: gcloud logging read 'resource.labels.service_name=$SERVICE_NAME' --limit=20"
echo "  - Monitor real-time: gcloud logging tail 'resource.labels.service_name=$SERVICE_NAME'"