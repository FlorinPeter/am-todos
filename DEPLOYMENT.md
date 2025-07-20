# 🚀 Comprehensive Deployment Guide

This document provides complete deployment instructions for the Agentic Markdown Todos application, including enterprise-grade security configurations.

## 🌟 Quick Start - Secure Cloud Run Deployment (Recommended)

For the fastest, most secure production deployment:

```bash
# Prerequisites
sudo ./hack/install-dependencies.sh
gcloud auth login

# Your configuration
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0595755698"
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:1.5.4"
export CUSTOM_DOMAIN="your-domain.com"

# Deploy with automatic security configuration
./hack/deploy-all.sh
```

**✅ What this automatically provides:**
- Auto-configured CORS for your custom domain
- Enterprise-grade security headers (Helmet.js + CSP)
- Rate limiting (100 general, 20 AI requests per window)
- Real-time security monitoring and threat detection
- Admin endpoint protection with auto-generated tokens
- Comprehensive input validation and sanitization
- Production logging and monitoring

---

## 🔐 Security Features Overview

### **🛡️ Enterprise Security Stack**
Your deployment includes comprehensive security hardening:

| Security Feature | Implementation | Benefit |
|-----------------|----------------|---------|
| **Security Headers** | Helmet.js with CSP | XSS, clickjacking, MIME sniffing protection |
| **Rate Limiting** | Express rate limiter | DoS protection, cost control |
| **CORS Protection** | Domain-specific origins | Cross-origin attack prevention |
| **Input Validation** | Multi-layer sanitization | Injection attack prevention |
| **Request Monitoring** | Real-time threat detection | Security event tracking |
| **Method Validation** | HTTP method restrictions | Attack surface reduction |
| **Admin Security** | Bearer token authentication | Sensitive endpoint protection |

### **🔍 Security Monitoring**
Real-time detection for:
- XSS and SQL injection attempts
- Path traversal attacks
- Authentication failures
- Rate limit violations
- Slow request DoS attempts
- Suspicious request patterns

---

## 🚀 Deployment Options

### 1. Google Cloud Run (Production Ready)

#### **Basic Secure Deployment**
```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export SOURCE_IMAGE="ghcr.io/your-username/am-todos:latest"
export CUSTOM_DOMAIN="your-domain.com"
./hack/deploy-all.sh
```

#### **Advanced Security Configuration**
```bash
# Custom security settings
export CORS_ORIGINS="https://your-domain.com,https://admin.your-domain.com"
export RATE_LIMIT_MAX_REQUESTS="200"           # Higher limit if needed
export AI_RATE_LIMIT_MAX_REQUESTS="50"         # More AI requests
export ADMIN_TOKEN="your-custom-secure-token"  # Custom admin token

# Security feature toggles (all enabled by default)
export DISABLE_SECURITY_HEADERS="false"        # Helmet.js security headers
export DISABLE_SECURITY_LOGGING="false"        # Request monitoring
export LOG_ALL_REQUESTS="true"                 # Full request logging
export DISABLE_METHOD_VALIDATION="false"       # HTTP method restrictions

./hack/deploy-all.sh
```

#### **Post-Deployment Security Verification**
```bash
# Check security configuration in logs
gcloud run logs read am-todos --region europe-west4 --limit 50

# Test CORS configuration
curl -X OPTIONS \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  "https://your-domain.com/api/ai"

# Test rate limiting
for i in {1..105}; do curl -s "https://your-domain.com/health" >/dev/null; done
```

### 2. Container Deployment (Docker)

#### **Quick Start with Docker**
```bash
# Pull and run with basic security
docker pull ghcr.io/your-username/am-todos:latest
docker run -d \
  --name am-todos \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e CORS_ORIGINS="https://your-domain.com" \
  -e RATE_LIMIT_MAX_REQUESTS=100 \
  --restart unless-stopped \
  ghcr.io/your-username/am-todos:latest
```

#### **Enhanced Security Docker Deployment**
```bash
# Run with additional security hardening
docker run -d \
  --name am-todos \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e CORS_ORIGINS="https://your-domain.com" \
  -e ADMIN_TOKEN="$(openssl rand -base64 32)" \
  -e LOG_ALL_REQUESTS=true \
  --read-only \
  --cap-drop=ALL \
  --user 1001:1001 \
  --restart unless-stopped \
  ghcr.io/your-username/am-todos:latest
```

#### **Docker Compose with Security**
```yaml
version: '3.8'
services:
  am-todos:
    image: ghcr.io/your-username/am-todos:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - CORS_ORIGINS=https://your-domain.com
      - RATE_LIMIT_MAX_REQUESTS=100
      - AI_RATE_LIMIT_MAX_REQUESTS=20
      - LOG_ALL_REQUESTS=true
    read_only: true
    cap_drop:
      - ALL
    user: "1001:1001"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 3. Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: am-todos
  labels:
    app: am-todos
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
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: am-todos
        image: ghcr.io/your-username/am-todos:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: CORS_ORIGINS
          value: "https://your-domain.com"
        - name: RATE_LIMIT_MAX_REQUESTS
          value: "100"
        - name: AI_RATE_LIMIT_MAX_REQUESTS
          value: "20"
        - name: ADMIN_TOKEN
          valueFrom:
            secretKeyRef:
              name: am-todos-secrets
              key: admin-token
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: Secret
metadata:
  name: am-todos-secrets
type: Opaque
data:
  admin-token: <base64-encoded-token>
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

### 4. Other Cloud Platforms

#### **Fly.io**
```bash
# Deploy with security configuration
fly launch
fly secrets set ADMIN_TOKEN="$(openssl rand -base64 32)"
fly secrets set CORS_ORIGINS="https://your-app.fly.dev"
fly deploy
```

#### **Railway**
```bash
railway login
railway link
railway variables set CORS_ORIGINS="https://your-app.railway.app"
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway up
```

#### **Render**
- Connect GitHub repository
- Select "Web Service" 
- Use Docker deployment
- Set environment variables in dashboard:
  - `CORS_ORIGINS`: Your domain
  - `RATE_LIMIT_MAX_REQUESTS`: 100
  - `ADMIN_TOKEN`: Generate secure token

---

## 🔧 Environment Variables

### **Core Application**
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3001` | Server port |
| `FRONTEND_BUILD_PATH` | `/app/build` | Frontend build path |

### **Security Configuration**
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | Auto-detected | Comma-separated allowed origins |
| `CORS_CREDENTIALS` | `true` | Allow credentials in CORS |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | General rate limit per window |
| `AI_RATE_LIMIT_MAX_REQUESTS` | `20` | AI endpoint rate limit |
| `ADMIN_TOKEN` | Auto-generated | Bearer token for admin endpoints |
| `DISABLE_SECURITY_HEADERS` | `false` | Disable Helmet.js security headers |
| `DISABLE_SECURITY_LOGGING` | `false` | Disable security request logging |
| `LOG_ALL_REQUESTS` | `false` | Log all requests (not just security-relevant) |
| `DISABLE_METHOD_VALIDATION` | `false` | Disable HTTP method restrictions |

### **Rate Limiting**
| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 minutes) |
| `AI_RATE_LIMIT_WINDOW_MS` | `300000` | AI rate limit window (5 minutes) |
| `DISABLE_RATE_LIMITING` | `false` | Disable all rate limiting |

---

## 📊 Monitoring and Security

### **Health Checks**
```bash
# Application health
curl https://your-domain.com/health

# Public endpoints
curl https://your-domain.com/api/version

# Admin endpoints (requires Bearer token)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     https://your-domain.com/api/memory
```

### **Security Event Monitoring**
Monitor your deployment logs for:
- `🚨 SUSPICIOUS REQUEST` - Potential attacks detected
- `🔒 AUTH FAILURE` - Authentication failures (401/403)
- `🚫 RATE LIMIT` - Rate limit violations
- `⏱️ SLOW REQUEST` - Potential DoS attempts
- `🚫 METHOD NOT ALLOWED` - Invalid HTTP methods

### **Log Analysis**
```bash
# Cloud Run logs
gcloud run logs read am-todos --region europe-west4 --follow

# Docker logs
docker logs -f am-todos

# Kubernetes logs
kubectl logs -f deployment/am-todos
```

---

## 🔄 Updates and Emergency Response

### **Update to Latest Version**
```bash
# Cloud Run
./hack/deploy-all.sh  # Uses latest image

# Docker
docker pull ghcr.io/your-username/am-todos:latest
docker stop am-todos && docker rm am-todos
docker run -d --name am-todos <your-config> ghcr.io/your-username/am-todos:latest
```

### **Emergency Security Adjustments**
```bash
# Increase rate limits temporarily
gcloud run services update am-todos \
  --set-env-vars="RATE_LIMIT_MAX_REQUESTS=500"

# Disable rate limiting in emergency
gcloud run services update am-todos \
  --set-env-vars="DISABLE_RATE_LIMITING=true"

# Add emergency CORS origin
gcloud run services update am-todos \
  --set-env-vars="CORS_ORIGINS=https://your-domain.com,https://emergency.domain.com"

# Enable full request logging for debugging
gcloud run services update am-todos \
  --set-env-vars="LOG_ALL_REQUESTS=true"
```

---

## 🐛 Troubleshooting

### **Common Security Issues**

1. **CORS Errors**
   ```bash
   # Check CORS configuration
   curl -I -X OPTIONS \
     -H "Origin: https://your-domain.com" \
     https://your-domain.com/api/ai
   
   # Update CORS origins
   export CORS_ORIGINS="https://your-domain.com,https://www.your-domain.com"
   ```

2. **Rate Limiting Too Aggressive**
   ```bash
   # Check current limits in logs
   docker logs am-todos | grep "Rate Limiting Configuration"
   
   # Increase limits
   export RATE_LIMIT_MAX_REQUESTS=200
   export AI_RATE_LIMIT_MAX_REQUESTS=50
   ```

3. **Admin Token Issues**
   ```bash
   # Generate new admin token
   openssl rand -base64 32
   
   # Test public version endpoint
   curl https://your-domain.com/api/version
   
   # Test admin endpoint
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-domain.com/api/memory
   ```

### **Security Diagnostics**
```bash
# Test security headers
curl -I https://your-domain.com/

# Check CSP configuration
curl -H "Accept: text/html" https://your-domain.com/ | grep -i "content-security-policy"

# Verify rate limiting
for i in {1..10}; do curl -w "%{http_code}\n" -o /dev/null -s https://your-domain.com/health; done
```

### **Debug Mode**
```bash
# Enable comprehensive logging
export LOG_ALL_REQUESTS=true
export DEBUG=*

# Access container for debugging
docker exec -it am-todos /bin/sh
kubectl exec -it deployment/am-todos -- /bin/sh
```

---

## 🎯 Best Practices

### **Production Security Checklist**
- ✅ Custom domain with HTTPS
- ✅ CORS configured for specific origins
- ✅ Rate limiting enabled
- ✅ Admin token secured and rotated
- ✅ Security headers enabled
- ✅ Request monitoring active
- ✅ Regular log monitoring
- ✅ Update notifications configured

### **Maintenance Schedule**
- **Weekly**: Review security logs
- **Monthly**: Rotate admin tokens
- **Quarterly**: Update to latest image
- **As needed**: Adjust rate limits based on usage

---

## 📚 Additional Resources

- **Security Documentation**: [SECURITY_FINDINGS.md](SECURITY_FINDINGS.md)
- **Cloud Run Security**: [CLOUD_RUN_SECURITY.md](CLOUD_RUN_SECURITY.md)
- **Main Documentation**: [README.md](README.md)
- **Feature Overview**: [FEATURES.md](FEATURES.md)

For specific deployment questions or issues, check the troubleshooting section above or review the security documentation for detailed configuration options.