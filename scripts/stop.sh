#!/bin/bash

echo "========================================"
echo "Singapore Housing Predictor - Shutdown"
echo "========================================"
echo

# Stop processes by PID if available
if [ -f .backend.pid ]; then
    BACKEND_PID=$(cat .backend.pid)
    echo "Stopping backend server (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null
    rm .backend.pid
    echo "✓ Backend server stopped"
else
    echo "✓ No backend PID file found"
fi

if [ -f .frontend.pid ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    echo "Stopping frontend server (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null
    rm .frontend.pid
    echo "✓ Frontend server stopped"
else
    echo "✓ No frontend PID file found"
fi

# Fallback: kill all node processes (be careful with this)
echo
echo "Stopping any remaining Node.js processes..."
pkill -f "npm.*start" 2>/dev/null
pkill -f "npm.*dev" 2>/dev/null
pkill -f "node.*backend" 2>/dev/null
pkill -f "node.*frontend" 2>/dev/null

echo
echo "========================================"
echo " Shutdown Complete!"
echo "========================================"
echo
echo "All servers have been stopped."