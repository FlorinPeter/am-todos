# Multi-stage build for production-ready container
FROM node:24-alpine AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Capture build-time Git information
ARG GIT_SHA
ARG GIT_TAG
ARG BUILD_DATE
ARG VERSION

# Set default values if not provided
ENV REACT_APP_GIT_SHA=${GIT_SHA:-unknown}
ENV REACT_APP_GIT_TAG=${GIT_TAG:-unknown}
ENV REACT_APP_BUILD_DATE=${BUILD_DATE:-unknown}
ENV REACT_APP_VERSION=${VERSION:-0.1.0}

# Copy frontend package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.mjs ./
COPY index.html ./

# Install frontend dependencies (including devDependencies for build)
RUN npm ci

# Copy frontend source code
COPY public/ ./public/
COPY src/ ./src/

# Build the React application for production
RUN npm run build

# Stage 2: Backend build
FROM node:24-alpine AS backend-builder

# Set working directory for backend
WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Stage 3: Production runtime
FROM node:24-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy backend files and dependencies
COPY --from=backend-builder --chown=nextjs:nodejs /app/server ./server
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# Copy frontend build
COPY --from=frontend-builder --chown=nextjs:nodejs /app/build ./build

# Copy server source (modular structure)
COPY --chown=nextjs:nodejs server/server.js ./server/
COPY --chown=nextjs:nodejs server/logger.js ./server/
COPY --chown=nextjs:nodejs server/config/ ./server/config/
COPY --chown=nextjs:nodejs server/middleware/ ./server/middleware/
COPY --chown=nextjs:nodejs server/routes/ ./server/routes/
COPY --chown=nextjs:nodejs server/services/ ./server/services/
COPY --chown=nextjs:nodejs server/websocket/ ./server/websocket/
COPY --chown=nextjs:nodejs server/utils/ ./server/utils/

# Re-declare build args for runtime stage
ARG GIT_SHA
ARG GIT_TAG
ARG BUILD_DATE
ARG VERSION

# Set environment variables
ENV NODE_ENV=production
ENV FRONTEND_BUILD_PATH=/app/build

# Pass build-time variables to runtime
ENV GIT_SHA=${GIT_SHA:-unknown}
ENV GIT_TAG=${GIT_TAG:-unknown}
ENV BUILD_DATE=${BUILD_DATE:-unknown}
ENV VERSION=${VERSION:-0.1.0}

# Expose port (Cloud Run will set PORT dynamically)
EXPOSE 8080

# Switch to non-root user
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server/server.js"]