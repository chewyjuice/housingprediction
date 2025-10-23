@echo off
echo ========================================
echo Singapore Housing Predictor - Shutdown
echo ========================================
echo.

echo Stopping all Node.js processes...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo ✓ Node.js processes stopped
) else (
    echo ✓ No Node.js processes were running
)

echo.
echo Stopping npm processes...
taskkill /f /im npm.cmd 2>nul
if %errorlevel% equ 0 (
    echo ✓ npm processes stopped
) else (
    echo ✓ No npm processes were running
)

echo.
echo ========================================
echo  Shutdown Complete!
echo ========================================
echo.
echo All servers have been stopped.
echo Press any key to exit...
pause > nul