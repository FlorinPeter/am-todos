#!/bin/bash

# Environment variables template for AM-Todos deployment
# Copy this file to env.sh and customize the values

# Required: Your Google Cloud Project ID
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Optional: Service name (defaults to "am-todos")
export SERVICE_NAME="am-todos"

# Optional: Custom image (defaults to europe-west3-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:v1.0.0)
# export IMAGE="europe-west3-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/am-todos/app:v1.0.1"

# Optional: Image tag for build script (defaults to v1.0.0)
# export TAG="v1.0.1"

# Optional: Source image to pull and retag (defaults to ghcr.io/your-username/am-todos:v1.0.0)
# export SOURCE_IMAGE="ghcr.io/your-username/am-todos:v1.0.1"

# Optional: Memory allocation (defaults to 1Gi)
# export MEMORY="512Mi"

# Optional: CPU allocation (defaults to 1)
# export CPU="0.5"

# Optional: Scaling configuration
# export MIN_INSTANCES="0"
# export MAX_INSTANCES="10"

echo "Environment variables loaded for AM-Todos deployment"
echo "Project: $GOOGLE_CLOUD_PROJECT"
echo "Service: ${SERVICE_NAME:-am-todos}"