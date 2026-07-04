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

:: Verify environment
echo.
echo ========================================
echo   VR Radar Lite - Environment Setup
echo ========================================
echo.
echo Node.js version:
call node --version
echo npm version:
call npm --version
echo.
echo Working directory: %CD%

:: Ensure .env exists
if not exist ".env" (
    echo DATABASE_URL="file:./prisma/dev.db" > .env
    echo Created .env file
)

:: Install dependencies (if needed)
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies already installed.
)

:: Generate Prisma client
echo.
echo Generating Prisma client...
call npx prisma generate

:: Create/update database schema
echo.
echo Creating database schema...
call npx prisma db push

echo.
echo ========================================
echo   Setup complete!
echo   Run quick-test.bat to start testing
echo ========================================
echo.
endlocal
