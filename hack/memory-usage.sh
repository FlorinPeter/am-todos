#!/bin/bash

# Check current memory usage of Cloud Run service
# Usage: ./hack/memory-usage.sh [local|production]

MODE=${1:-production}
SERVICE_URL="https://todo.peter.tools"

if [ "$MODE" = "local" ]; then
    SERVICE_URL="http://localhost:3001"
    echo "🏠 Checking LOCAL memory usage..."
else
    echo "☁️  Checking PRODUCTION memory usage..."
fi

echo "🌐 Service: $SERVICE_URL"
echo ""

# Get current memory usage
echo "📊 Current Memory Usage:"
curl -s "$SERVICE_URL/api/memory" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f\"📅 Timestamp: {data['timestamp']}\")
    print(f\"⏱️  Uptime: {data['uptime']}\")
    print()
    print('💾 Memory Breakdown:')
    memory = data['memory']
    print(f\"  RSS (Total):     {memory['rss']:<12} - Resident Set Size (total memory allocated)\")
    print(f\"  Heap Used:       {memory['heapUsed']:<12} - JavaScript heap actually used\")
    print(f\"  Heap Total:      {memory['heapTotal']:<12} - Total JavaScript heap allocated\")
    print(f\"  External:        {memory['external']:<12} - C++ objects bound to JavaScript\")
    print(f\"  Array Buffers:   {memory['arrayBuffers']:<12} - ArrayBuffers allocated\")
    print()
    
    # Calculate percentages for Cloud Run (1Gi = 1024MB limit)
    rss_mb = float(memory['rss'].replace(' MB', ''))
    heap_mb = float(memory['heapUsed'].replace(' MB', ''))
    cloud_run_limit = 1024  # 1Gi in MB
    
    print('📈 Cloud Run Usage (1Gi limit):')
    print(f\"  Total Memory:    {rss_mb:.1f}MB / {cloud_run_limit}MB ({rss_mb/cloud_run_limit*100:.1f}%)\")
    print(f\"  JavaScript Heap: {heap_mb:.1f}MB ({heap_mb/cloud_run_limit*100:.1f}%)\")
    
    # Warning thresholds
    if rss_mb > 800:  # >80% of 1Gi
        print()
        print('⚠️  WARNING: Memory usage above 80% - consider optimizing or increasing limits')
    elif rss_mb > 600:  # >60% of 1Gi
        print()
        print('⚡ NOTICE: Memory usage above 60% - monitor closely')
    else:
        print()
        print('✅ Memory usage looks healthy')

except Exception as e:
    print(f'❌ Error parsing memory data: {e}')
    print('Raw response:')
    print(sys.stdin.read())
"

echo ""
echo "💡 To monitor continuously:"
echo "   watch -n 5 './hack/memory-usage.sh'"