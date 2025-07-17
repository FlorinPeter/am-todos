# Cloud Run Security Configuration Guide

## Overview

This guide explains how to configure all security-related environment variables for Google Cloud Run deployment of the AM-Todos server.

## 🔐 Security Environment Variables

### **CORS Configuration**

Configure Cross-Origin Resource Sharing for your specific domains:

```bash
# Production CORS origins (comma-separated)
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,/^https:\/\/.*\.yourdomain\.com$/

# Frontend URL (fallback for CORS if CORS_ORIGINS not set)
FRONTEND_URL=https://yourdomain.com

# Development CORS origins (for staging environments)
DEV_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# CORS configuration options
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization,Accept
CORS_MAX_AGE=86400
```

### **Rate Limiting Configuration**

Control API request limits to prevent abuse:

```bash
# General rate limiting (applies to all endpoints except skipped paths)
RATE_LIMIT_WINDOW_MS=900000          # 15 minutes (in milliseconds)
RATE_LIMIT_MAX_REQUESTS=100          # Max requests per window
RATE_LIMIT_MESSAGE="Too many requests from this IP, please try again later."
RATE_LIMIT_RETRY_AFTER="15 minutes"
RATE_LIMIT_SKIP_PATHS=/health,/api/version  # Comma-separated paths to skip

# AI-specific rate limiting (stricter limits for AI endpoints)
AI_RATE_LIMIT_WINDOW_MS=300000       # 5 minutes
AI_RATE_LIMIT_MAX_REQUESTS=20        # Max AI requests per window
AI_RATE_LIMIT_MESSAGE="Too many AI requests from this IP, please try again later."
AI_RATE_LIMIT_RETRY_AFTER="5 minutes"

# Disable rate limiting (for testing or high-traffic scenarios)
DISABLE_RATE_LIMITING=false          # Set to 'true' to disable
```

### **Admin Endpoint Security**

Protect sensitive admin endpoints:

```bash
# Admin token for protected endpoints (/api/memory, /api/version)
ADMIN_TOKEN=your-secure-admin-token-here

# Optional: Build/version information
VERSION=1.0.0
GIT_SHA=abc123def456
GIT_TAG=v1.0.0
BUILD_DATE=2025-01-01T00:00:00Z
```

### **Application Configuration**

Standard application settings:

```bash
# Environment
NODE_ENV=production
PORT=8080

# Frontend build path (if serving static files)
FRONTEND_BUILD_PATH=/app/build
```

## 🚀 Cloud Run Deployment Commands

### **Deploy with Security Configuration**

```bash
# Set your project
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Deploy with all security environment variables
gcloud run deploy am-todos-server \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com" \
  --set-env-vars="FRONTEND_URL=https://yourdomain.com" \
  --set-env-vars="CORS_CREDENTIALS=true" \
  --set-env-vars="RATE_LIMIT_WINDOW_MS=900000" \
  --set-env-vars="RATE_LIMIT_MAX_REQUESTS=100" \
  --set-env-vars="AI_RATE_LIMIT_WINDOW_MS=300000" \
  --set-env-vars="AI_RATE_LIMIT_MAX_REQUESTS=20" \
  --set-env-vars="ADMIN_TOKEN=$(openssl rand -base64 32)" \
  --set-env-vars="VERSION=1.0.0"
```

### **Using Environment File**

Create `.env.production`:

```bash
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_CREDENTIALS=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AI_RATE_LIMIT_WINDOW_MS=300000
AI_RATE_LIMIT_MAX_REQUESTS=20
ADMIN_TOKEN=your-secure-admin-token
VERSION=1.0.0
```

Deploy with env file:
```bash
gcloud run deploy am-todos-server \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file .env.production
```

## 🔧 Configuration Examples

### **High-Traffic Production**

```bash
# More permissive rate limits for high-traffic sites
RATE_LIMIT_WINDOW_MS=600000          # 10 minutes
RATE_LIMIT_MAX_REQUESTS=500          # 500 requests per 10 minutes
AI_RATE_LIMIT_WINDOW_MS=300000       # 5 minutes  
AI_RATE_LIMIT_MAX_REQUESTS=50        # 50 AI requests per 5 minutes
```

### **Development/Staging**

```bash
# More relaxed limits for development
NODE_ENV=staging
CORS_ORIGINS=https://staging.yourdomain.com,http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=1000         # Higher limits for testing
AI_RATE_LIMIT_MAX_REQUESTS=100       
DISABLE_RATE_LIMITING=false          # Keep enabled to test rate limiting
```

### **Multiple Domain Support**

```bash
# Support multiple domains and subdomains
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,https://admin.yourdomain.com,/^https:\/\/.*\.yourdomain\.com$/,/^https:\/\/.*\.yourdomain\.net$/
```

## 🛡️ Security Best Practices

### **1. Admin Token Security**

```bash
# Generate secure admin token
ADMIN_TOKEN=$(openssl rand -base64 32)

# Or use Cloud Secret Manager
gcloud secrets create admin-token --data-file=- <<< "$(openssl rand -base64 32)"
```

### **2. CORS Configuration**

- **Never use wildcards** (`*`) in production
- **Use specific domains** instead of regex when possible
- **Include subdomain patterns** with regex: `/^https:\/\/.*\.yourdomain\.com$/`
- **Test CORS** thoroughly with your frontend

### **3. Rate Limiting Strategy**

- **Start conservative** and increase limits based on usage
- **Monitor logs** for rate limit hits
- **Different limits** for different user types (free vs paid)
- **Skip rate limiting** for health checks only

### **4. Environment Variable Management**

```bash
# Use Cloud Secret Manager for sensitive values
gcloud secrets create cors-origins --data-file=- <<< "https://yourdomain.com"
gcloud secrets create admin-token --data-file=- <<< "$(openssl rand -base64 32)"

# Grant Cloud Run access to secrets
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 📊 Monitoring & Debugging

### **Check Configuration**

The server logs all security configuration on startup:

```bash
# View Cloud Run logs
gcloud run logs read am-todos-server --platform managed --region us-central1

# Look for these startup messages:
# 🌐 CORS Configuration:
# 🛡️ Rate Limiting Configuration:
# ✅ Rate limiting enabled
```

### **Test Rate Limiting**

```bash
# Test general rate limiting
for i in {1..105}; do curl -s "https://your-service-url/api/some-endpoint" & done

# Test AI rate limiting  
for i in {1..25}; do curl -s -X POST "https://your-service-url/api/ai" & done
```

### **Test CORS**

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://yourdomain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  "https://your-service-url/api/ai"
```

## 🚨 Troubleshooting

### **Common Issues**

1. **CORS errors**: Check `CORS_ORIGINS` includes your frontend domain
2. **Rate limiting too strict**: Increase `RATE_LIMIT_MAX_REQUESTS`
3. **Admin endpoints blocked**: Ensure `ADMIN_TOKEN` is set and correct
4. **Environment variables not loading**: Check Cloud Run service configuration

### **Emergency Disable**

```bash
# Temporarily disable rate limiting
gcloud run services update am-todos-server \
  --platform managed \
  --region us-central1 \
  --set-env-vars="DISABLE_RATE_LIMITING=true"

# Re-enable with updated limits
gcloud run services update am-todos-server \
  --platform managed \
  --region us-central1 \
  --set-env-vars="DISABLE_RATE_LIMITING=false,RATE_LIMIT_MAX_REQUESTS=200"
```

---

## 📝 Example Complete Deployment

```bash
#!/bin/bash
# deploy-secure.sh

export GOOGLE_CLOUD_PROJECT="your-project-id"
export SERVICE_NAME="am-todos-server"
export REGION="us-central1"

# Generate secure admin token
ADMIN_TOKEN=$(openssl rand -base64 32)

# Deploy with full security configuration
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars="NODE_ENV=production,CORS_ORIGINS=https://yourdomain.com,FRONTEND_URL=https://yourdomain.com,CORS_CREDENTIALS=true,RATE_LIMIT_WINDOW_MS=900000,RATE_LIMIT_MAX_REQUESTS=100,AI_RATE_LIMIT_WINDOW_MS=300000,AI_RATE_LIMIT_MAX_REQUESTS=20,ADMIN_TOKEN=$ADMIN_TOKEN,VERSION=1.0.0"

echo "🔐 Admin token: $ADMIN_TOKEN"
echo "🚀 Deployment complete!"
```

This configuration ensures your AM-Todos server is securely deployed on Google Cloud Run with comprehensive protection against common web vulnerabilities.