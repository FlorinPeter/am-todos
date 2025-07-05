#!/bin/bash

echo "Stopping all existing processes..."

# Kill all npm start processes
pkill -f "npm start" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true

# Kill all node server.js processes
pkill -f "node server.js" 2>/dev/null || true

# Wait a moment for processes to terminate
sleep 2

# Force kill any remaining processes
pkill -9 -f "npm start" 2>/dev/null || true
pkill -9 -f "react-scripts start" 2>/dev/null || true
pkill -9 -f "node server.js" 2>/dev/null || true

echo "Starting backend server..."
cd /root/todo/am-todos/server
nohup node server.js > server.log 2>&1 &
echo "Backend server PID: $!"

echo "Starting frontend..."
cd /root/todo/am-todos
nohup npm start > app.log 2>&1 &
echo "Frontend PID: $!"

echo "All processes started. Check logs:"
echo "  Backend: /root/todo/am-todos/server/server.log"
echo "  Frontend: /root/todo/am-todos/app.log"

sleep 2
echo "Current running processes:"
ps aux | grep -E "(npm start|node server.js)" | grep -v grep