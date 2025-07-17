# 🚀 Secure Cloud Run Deployment Guide

## Updated Deployment with Enhanced Security

Your deployment script has been enhanced with comprehensive security features. Here's how to deploy with your exact configuration:

## **🔐 Quick Secure Deployment (Recommended)**

```bash
# Your exact previous setup with security enhancements
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0595755698"
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:1.5.4"
export CUSTOM_DOMAIN="todo.peter.tools"

# Deploy with automatic security configuration
./hack/deploy-all.sh
```

**✅ What this does automatically:**
- Auto-configures CORS for `https://todo.peter.tools`
- Sets secure rate limits (100 general, 20 AI requests)
- Generates secure admin token
- Enables all security protections
- Shows security configuration during deployment

## **🛠️ Advanced Configuration (Optional)**

If you want to customize security settings:

```bash
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0595755698"
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:1.5.4"
export CUSTOM_DOMAIN="todo.peter.tools"

# Optional: Security customization
export CORS_ORIGINS="https://todo.peter.tools,https://admin.peter.tools"
export RATE_LIMIT_MAX_REQUESTS="200"           # Higher limit for your usage
export AI_RATE_LIMIT_MAX_REQUESTS="50"         # More AI requests allowed
export ADMIN_TOKEN="your-custom-secure-token"  # Or let it auto-generate

# Optional: Security features control (all enabled by default)
export DISABLE_SECURITY_HEADERS="false"        # Set to "true" to disable Helmet.js
export DISABLE_SECURITY_LOGGING="false"        # Set to "true" to disable request monitoring
export LOG_ALL_REQUESTS="true"                 # Set to "true" for full request logging
export DISABLE_METHOD_VALIDATION="false"       # Set to "true" to disable HTTP method restrictions

./hack/deploy-all.sh
```

## **🔧 What's New in the Deployment**

### **1. Enhanced Security Configuration**
The deployment now includes:

```bash
🔐 Security Configuration:
  CORS Origins: https://todo.peter.tools
  Custom Domain: todo.peter.tools
  Auto CORS: https://todo.peter.tools
  Rate Limiting: 100 req/15min, AI: 20 req/5min
  Admin Protection: Enabled (token: AbCdEfGh...)
  Build Version: 1.5.5
```

### **2. Auto-Configuration**
- **CORS**: Automatically configured for your custom domain
- **Rate Limiting**: Production-ready defaults
- **Admin Security**: Auto-generated secure token
- **Version Tracking**: Git SHA and build information

### **3. Monitoring & Debugging**
The server now logs all security settings on startup:

```bash
🌐 CORS Configuration:
   Origins: ["https://todo.peter.tools"]
   Credentials: true
   Methods: GET, POST, PUT, DELETE, OPTIONS

🛡️ Rate Limiting Configuration:
   General: 100 requests per 15 minutes
   AI: 20 requests per 5 minutes
```

## **📊 Security Features Included**

### **✅ CORS Protection**
- **Specific domain**: Only `https://todo.peter.tools` allowed
- **Credentials support**: Secure cookie handling
- **Method restrictions**: Only necessary HTTP methods

### **✅ Rate Limiting**
- **General endpoints**: 100 requests per 15 minutes
- **AI endpoints**: 20 requests per 5 minutes (protects costs)
- **Skip health checks**: Performance optimization

### **✅ Admin Endpoint Security**
- **Protected endpoints**: `/api/memory`, `/api/version`
- **Bearer token**: Required for sensitive operations
- **Auto-generated**: Secure 32-character token

### **✅ Security Headers (Helmet.js)**
- **Content Security Policy**: XSS protection with strict directives
- **HSTS**: Force HTTPS connections (1 year max-age)
- **X-Frame-Options**: Prevent clickjacking attacks
- **X-Content-Type-Options**: Prevent MIME sniffing
- **Referrer Policy**: Privacy protection

### **✅ Request Monitoring & Logging**
- **Real-time threat detection**: Monitor for XSS, SQL injection, path traversal
- **Authentication failure tracking**: Log all 401/403 responses
- **Rate limit monitoring**: Track and log rate limit violations
- **Slow request detection**: Identify potential DoS attacks
- **Suspicious pattern alerts**: Automated security event detection

### **✅ HTTP Method Validation**
- **Endpoint restrictions**: Only allowed methods per endpoint
- **Dangerous method blocking**: Block TRACE, TRACK, DEBUG
- **Method enforcement**: 405 responses for invalid methods

### **✅ Input Validation**
- **Path traversal protection**: Prevents file system attacks
- **JSON injection prevention**: Validates all inputs
- **Header sanitization**: Prevents HTTP response splitting
- **URL parameter validation**: Prevents injection attacks

## **🎯 Deployment Command**

Your exact deployment remains the same:

```bash
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0595755698"
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:1.5.4"
export CUSTOM_DOMAIN="todo.peter.tools"
./hack/deploy-all.sh
```

## **🔍 Verify Deployment**

After deployment, check security configuration:

```bash
# Check logs for security settings
gcloud run logs read am-todos --platform managed --region europe-west4 --limit 50

# Test CORS (should work)
curl -X OPTIONS \
  -H "Origin: https://todo.peter.tools" \
  -H "Access-Control-Request-Method: POST" \
  "https://todo.peter.tools/api/ai"

# Test rate limiting (should get rate limited after 100 requests)
for i in {1..105}; do 
  curl -s "https://todo.peter.tools/health" >/dev/null
done
```

## **⚡ Emergency Configuration**

If you need to adjust settings post-deployment:

```bash
# Increase rate limits
gcloud run services update am-todos \
  --platform managed \
  --region europe-west4 \
  --set-env-vars="RATE_LIMIT_MAX_REQUESTS=500,AI_RATE_LIMIT_MAX_REQUESTS=100"

# Disable rate limiting temporarily  
gcloud run services update am-todos \
  --platform managed \
  --region europe-west4 \
  --set-env-vars="DISABLE_RATE_LIMITING=true"

# Add additional CORS origins
gcloud run services update am-todos \
  --platform managed \
  --region europe-west4 \
  --set-env-vars="CORS_ORIGINS=https://todo.peter.tools,https://admin.peter.tools"
```

## **🎉 Benefits of New Deployment**

1. **🛡️ Production Security**: All OWASP recommendations implemented
2. **⚡ Performance**: Rate limiting prevents abuse and costs
3. **🔧 Maintainable**: All settings via environment variables
4. **📊 Observable**: Comprehensive logging and monitoring
5. **🚀 Simple**: Same deployment command, enhanced security

## **📝 Important Notes**

### **Admin Token**
The deployment generates a secure admin token automatically. **Save this token** from the deployment output:

```bash
🔐 Admin token: AbCdEfGhIjKlMnOpQrStUvWxYz123456=
```

You'll need this token to access:
- `/api/memory` - Server memory usage
- `/api/version` - Build information

### **Rate Limiting**
Default limits are conservative for security:
- **General**: 100 requests per 15 minutes (6.7 req/min)
- **AI**: 20 requests per 5 minutes (4 req/min)

If you need higher limits for your usage, export custom values before deployment.

### **Monitoring**
Check Cloud Run logs regularly for:
- Security warnings
- Rate limit hits
- CORS violations
- Admin access attempts

---

**🚀 Ready to Deploy?**

Your deployment command remains exactly the same, but now with enterprise-grade security built-in!

```bash
export GOOGLE_CLOUD_PROJECT="gen-lang-client-0595755698"
export SOURCE_IMAGE="ghcr.io/florinpeter/am-todos:1.5.4"
export CUSTOM_DOMAIN="todo.peter.tools"
./hack/deploy-all.sh
```