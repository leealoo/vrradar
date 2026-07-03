@echo off
setlocal

:: Add Node.js to PATH
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0"

echo.
echo ========================================
echo   VR Radar Lite - Quick Test Version
echo ========================================
echo.
echo Starting Next.js development server...
echo The web interface will open automatically.
echo.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

:: Start browser after a short delay (in a separate process)
start "" /b cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"

:: Start Next.js dev server
call npx next dev -p 3000

endlocal
