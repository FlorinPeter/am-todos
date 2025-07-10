#!/bin/bash

# Development server restart script for AM-Todos
# Restarts both frontend (React dev server) and backend (Express server)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo -e "${GREEN}🔄 Restarting AM-Todos development servers${NC}"

echo -e "${YELLOW}🛑 Stopping all existing processes...${NC}"

# Kill all npm start processes
pkill -f "npm start" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "esbuild" 2>/dev/null || true

# Kill all node server.js processes
pkill -f "node server.js" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Force kill any remaining processes
pkill -9 -f "npm start" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "esbuild" 2>/dev/null || true
pkill -9 -f "node server.js" 2>/dev/null || true

echo -e "${GREEN}🚀 Starting backend server...${NC}"
cd "$PROJECT_ROOT/server"
nohup node server.js > server.log 2>&1 &
BACKEND_PID=$!
echo "Backend server PID: $BACKEND_PID"

echo -e "${GREEN}🌐 Starting frontend...${NC}"
cd "$PROJECT_ROOT"
nohup npm run dev > app.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo -e "${GREEN}✅ All processes started successfully!${NC}"
echo -e "${YELLOW}📋 Access your application:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:3001"
echo "  Health check: http://localhost:3001/health"
echo ""
echo -e "${YELLOW}📁 Log files:${NC}"
echo "  Backend: $PROJECT_ROOT/server/server.log"
echo "  Frontend: $PROJECT_ROOT/app.log"

sleep 2
echo ""
echo -e "${GREEN}🔍 Current running processes:${NC}"
ps aux | grep -E "(npm start|node server.js)" | grep -v grep