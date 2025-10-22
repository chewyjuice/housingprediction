@echo off
echo ========================================
echo Singapore Housing Predictor - Demo Mode
echo ========================================
echo.

REM Set environment variables for demo mode
set NODE_ENV=development
set REACT_APP_API_URL=http://localhost:8000/api
set REACT_APP_ENABLE_DEMO_MODE=true

echo [INFO] Starting Singapore Housing Predictor in Demo Mode...
echo [INFO] This runs the frontend with simulated data (no backend required)
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is available
cmd /c "npm --version" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not available. Please ensure npm is installed.
    pause
    exit /b 1
)

echo [INFO] Node.js and npm are available
echo.

REM Install frontend dependencies
echo [INFO] Installing frontend dependencies...
cd frontend
cmd /c "npm install"
if errorlevel 1 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

echo [INFO] Frontend dependencies installed successfully
echo.

REM Start frontend in demo mode
echo [INFO] Starting frontend in demo mode...
echo.
echo ========================================
echo   Demo Application Available At:
echo   http://localhost:3000
echo ========================================
echo.
echo [INFO] This demo includes:
echo   - Interactive Singapore map
echo   - Area selection and property forms
echo   - Simulated price predictions
echo   - Historical accuracy dashboard
echo.
echo [INFO] Note: Backend services are simulated
echo [INFO] Press Ctrl+C to stop the server
echo.

cmd /c "npm start"

echo.
echo [INFO] Demo server stopped
pause