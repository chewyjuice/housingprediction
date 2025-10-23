#!/bin/bash

echo "========================================"
echo " Singapore Housing Predictor - Startup"
echo "========================================"
echo

echo "[1/4] Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install backend dependencies"
    exit 1
fi

echo
echo "[2/4] Installing frontend dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install frontend dependencies"
    exit 1
fi

echo
echo "[3/4] Starting backend server..."
cd ../backend
npm run dev:simple &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 3

echo
echo "[4/4] Starting frontend server..."
cd ../frontend
npm start &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo
echo "========================================"
echo " Startup Complete!"
echo "========================================"
echo
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo
echo "Backend PID:  $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo
echo "To stop the servers, run: ./scripts/stop.sh"
echo "Or press Ctrl+C to stop this script"

# Save PIDs for stop script
echo $BACKEND_PID > .backend.pid
echo $FRONTEND_PID > .frontend.pid

# Wait for user to stop
wait