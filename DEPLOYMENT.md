# Deployment Guide

This document provides comprehensive deployment instructions for the Agentic Markdown Todos application.

## 🐳 Container Deployment

### Quick Start with Docker

```bash
# Pull the latest image
docker pull ghcr.io/your-username/am-todos:latest

# Run the container
docker run -p 3001:3001 ghcr.io/your-username/am-todos:latest
```

Access the application at `http://localhost:3001`

### Docker Compose Deployment

1. **Production deployment:**
   ```bash
   docker-compose up -d
   ```

### Environment Variables

The application supports the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (production/development) |
| `PORT` | `3001` | Port to run the server on |
| `FRONTEND_BUILD_PATH` | `/app/build` | Path to frontend build files |

### Health Checks

The container includes health checks that verify the application is running:

```bash
# Check container health
docker ps

# View health check logs
docker inspect --format='{{json .State.Health}}' <container_id>
```

## 🚀 Production Deployment Options

### 1. Direct Docker Deployment

```bash
# Create a network (optional)
docker network create am-todos-network

# Run with custom configuration
docker run -d \
  --name am-todos \
  --network am-todos-network \
  -p 3001:3001 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  ghcr.io/your-username/am-todos:latest
```

### 2. Kubernetes Deployment

Create a deployment manifest:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: am-todos
spec:
  replicas: 2
  selector:
    matchLabels:
      app: am-todos
  template:
    metadata:
      labels:
        app: am-todos
    spec:
      containers:
      - name: am-todos
        image: ghcr.io/your-username/am-todos:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: am-todos-service
spec:
  selector:
    app: am-todos
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3001
  type: LoadBalancer
```

Apply the deployment:
```bash
kubectl apply -f deployment.yaml
```

### 3. Cloud Platform Deployment

#### Fly.io
```bash
fly launch
fly deploy
```

#### Railway
```bash
railway login
railway link
railway up
```

#### Render
- Connect your GitHub repository
- Select "Web Service"
- Use Docker deployment
- Set port to 3001

## 🏗️ Building Your Own Images

### Build Locally

```bash
# Build the production image
docker build -t am-todos:local .

# Run your local build
docker run -p 3001:3001 am-todos:local
```

### Multi-platform Build

```bash
# Set up buildx for multi-platform builds
docker buildx create --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t am-todos:multi-platform \
  --push .
```

## 🔒 Security Considerations

### Container Security

1. **Non-root user**: Containers run as non-root user (nextjs:1001)
2. **Minimal base image**: Uses Alpine Linux for smaller attack surface
3. **Security scanning**: Images are scanned with Trivy in CI/CD
4. **Build attestation**: Images include provenance attestation

### Runtime Security

```bash
# Run with read-only filesystem
docker run -p 3001:3001 --read-only ghcr.io/your-username/am-todos:latest

# Drop capabilities
docker run -p 3001:3001 --cap-drop=ALL ghcr.io/your-username/am-todos:latest

# Run with user namespace
docker run -p 3001:3001 --user 1001:1001 ghcr.io/your-username/am-todos:latest
```

## 📊 Monitoring and Logging

### Container Logs

```bash
# View container logs
docker logs -f <container_name>

# View logs with timestamps
docker logs -t <container_name>
```

### Application Metrics

The application exposes basic health endpoints:

- `GET /` - Application health
- Server logs include request logging

### Resource Monitoring

```bash
# Monitor resource usage
docker stats <container_name>

# Export metrics (if using Prometheus)
docker run -p 3001:3001 -p 9090:9090 ghcr.io/your-username/am-todos:latest
```

## 🔄 Updates and Rollbacks

### Update to Latest Version

```bash
# Pull latest image
docker pull ghcr.io/your-username/am-todos:latest

# Stop current container
docker stop am-todos

# Remove old container
docker rm am-todos

# Run new container
docker run -d --name am-todos -p 3001:3001 ghcr.io/your-username/am-todos:latest
```

### Rollback to Previous Version

```bash
# List available tags
docker images ghcr.io/your-username/am-todos

# Run specific version
docker run -d --name am-todos -p 3001:3001 ghcr.io/your-username/am-todos:v1.0.0
```

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3001
   
   # Use different port
   docker run -p 8080:3001 ghcr.io/your-username/am-todos:latest
   ```

2. **Container won't start**
   ```bash
   # Check container logs
   docker logs <container_name>
   
   # Run interactively for debugging
   docker run -it --entrypoint /bin/sh ghcr.io/your-username/am-todos:latest
   ```

3. **Application not accessible**
   ```bash
   # Check if container is running
   docker ps
   
   # Check port mapping
   docker port <container_name>
   
   # Test from inside container
   docker exec -it <container_name> wget -qO- http://localhost:3001
   ```

### Debug Mode

```bash
# Run with debug output
docker run -p 3001:3001 -e DEBUG=* ghcr.io/your-username/am-todos:latest

# Access container shell
docker exec -it <container_name> /bin/sh
```

For more deployment options and advanced configurations, see the main [README.md](README.md).