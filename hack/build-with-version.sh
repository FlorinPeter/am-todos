#!/bin/bash

# Build Docker image with version information
# Usage: ./hack/build-with-version.sh [IMAGE_NAME]

set -e

# Default image name
IMAGE_NAME=${1:-"am-todos:latest"}

# Get build information
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --exact-match 2>/dev/null || echo "")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSION=$(grep '"version"' am-todos/package.json | cut -d'"' -f4 2>/dev/null || echo "0.1.0")

echo "🔨 Building Docker image with version information..."
echo "   Image: $IMAGE_NAME"
echo "   Version: $VERSION"
echo "   Git SHA: $GIT_SHA"
echo "   Git Tag: $GIT_TAG"
echo "   Build Date: $BUILD_DATE"
echo ""

# Build the Docker image with build args
docker build \
  --build-arg GIT_SHA="$GIT_SHA" \
  --build-arg GIT_TAG="$GIT_TAG" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  --build-arg VERSION="$VERSION" \
  -t "$IMAGE_NAME" \
  .

echo ""
echo "✅ Docker image built successfully: $IMAGE_NAME"
echo ""
echo "🧪 To test the version info:"
echo "   docker run --rm -p 8080:8080 $IMAGE_NAME"
echo "   curl http://localhost:8080/api/version"