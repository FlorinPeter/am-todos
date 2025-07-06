# Multi-stage build for production-ready container
FROM node:18-alpine AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy frontend package files from am-todos subdirectory
COPY am-todos/package*.json ./
COPY am-todos/tsconfig.json ./
COPY am-todos/tailwind.config.js ./
COPY am-todos/postcss.config.js ./

# Install frontend dependencies
RUN npm ci --only=production

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
ENV PORT=3001
ENV FRONTEND_BUILD_PATH=/app/build

# Expose port
EXPOSE 3001

# Switch to non-root user
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server/server.js"]