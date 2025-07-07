# Multi-stage build for production-ready container
FROM node:18-alpine AS frontend-builder

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

# Copy frontend package files from am-todos subdirectory
COPY am-todos/package*.json ./
COPY am-todos/tsconfig.json ./
COPY am-todos/tailwind.config.js ./
COPY am-todos/postcss.config.js ./
COPY am-todos/vite.config.mjs ./
COPY am-todos/index.html ./

# Install frontend dependencies (including devDependencies for build)
RUN npm ci

# Copy frontend source code from am-todos subdirectory
COPY am-todos/public/ ./public/
COPY am-todos/src/ ./src/

# Build the React application for production
RUN npm run build

# Stage 2: Backend build
FROM node:18-alpine AS backend-builder

# Set working directory for backend
WORKDIR /app/server

# Copy backend package files from am-todos subdirectory
COPY am-todos/server/package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Stage 3: Production runtime
FROM node:18-alpine AS runtime

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

# Copy server source from am-todos subdirectory
COPY --chown=nextjs:nodejs am-todos/server/server.js ./server/

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