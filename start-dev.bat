@echo off
echo ========================================
echo Singapore Housing Predictor - Dev Mode
echo ========================================
echo.

REM Set environment variables for development
set NODE_ENV=development
set REACT_APP_API_URL=http://localhost:8000/api
set REACT_APP_ENABLE_DEMO_MODE=true

echo [INFO] Starting Singapore Housing Predictor in Development Mode...
echo [INFO] This will run without Docker using local Node.js
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

REM Install backend dependencies
echo [INFO] Installing backend dependencies...
cd backend
cmd /c "npm install"
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

echo [INFO] Backend dependencies installed successfully
echo.

REM Install frontend dependencies
echo [INFO] Installing frontend dependencies...
cd ..\frontend
cmd /c "npm install"
if errorlevel 1 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

echo [INFO] Frontend dependencies installed successfully
echo.

REM Start backend in background
echo [INFO] Starting backend server on port 8000...
cd ..\backend
start "Backend Server" cmd /c "npm run dev"

REM Wait a moment for backend to start
timeout /t 5 /nobreak >nul

REM Start frontend
echo [INFO] Starting frontend server on port 3000...
cd ..\frontend
echo.
echo ========================================
echo   Application will be available at:
echo   http://localhost:3000
echo ========================================
echo.
echo [INFO] Backend API: http://localhost:8000
echo [INFO] Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop the servers
echo.

cmd /c "npm start"

echo.
echo [INFO] Shutting down servers...
taskkill /f /im node.exe 2>nul
echo [INFO] Servers stopped
pause