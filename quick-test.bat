@echo off
setlocal enabledelayedexpansion

:: Add Node.js to PATH
set "NODE_HOME="
where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" set "NODE_HOME=C:\Program Files\nodejs"
    if not defined NODE_HOME if exist "C:\Program Files\Lenovo\AIAgent\mcp\node-v22.16.0-win-x64\node.exe" set "NODE_HOME=C:\Program Files\Lenovo\AIAgent\mcp\node-v22.16.0-win-x64"
    if not defined NODE_HOME if exist "%LOCALAPPDATA%\OpenAI\Codex\bin\5b9024f90663758b\node.exe" set "NODE_HOME=%LOCALAPPDATA%\OpenAI\Codex\bin\5b9024f90663758b"
    if defined NODE_HOME set "PATH=!NODE_HOME!;%PATH%"
)

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
