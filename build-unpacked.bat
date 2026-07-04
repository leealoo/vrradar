@echo off
setlocal enabledelayedexpansion
title VR Radar Lite - Build Unpacked

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
echo ============================================
echo   VR Radar Lite - Unpacked Builder
echo ============================================
echo.

:: Step 1: Check Node.js
echo [1/5] Checking Node.js...
call node --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo ERROR: Node.js not found. Please install Node.js first.
    echo Tried PATH, C:\Program Files\nodejs, Lenovo AIAgent Node, and OpenAI Codex Node.
    pause
    exit /b 1
)
echo Node.js: OK

:: Step 2: Generate Prisma client
echo.
echo [2/5] Generating Prisma client...
call npx prisma generate
if !ERRORLEVEL! neq 0 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

:: Step 3: Create template database
echo.
echo [3/5] Creating template database...
call npm run template-db
if !ERRORLEVEL! neq 0 (
    echo ERROR: Template database creation failed.
    pause
    exit /b 1
)

:: Step 4: Build Next.js standalone
echo.
echo [4/5] Building Next.js standalone...
call npx next build
if !ERRORLEVEL! neq 0 (
    echo ERROR: Next.js build failed.
    pause
    exit /b 1
)

:: Step 5: Build unpacked app only
echo.
echo [5/5] Building unpacked app with electron-builder...
call npx electron-builder --win --dir
if !ERRORLEVEL! neq 0 (
    echo ERROR: Unpacked build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Unpacked Build Complete!
echo ============================================
echo.

if exist "dist\win-unpacked\VR Radar Lite.exe" (
    echo [+] Unpacked app: dist\win-unpacked
    echo [+] EXE: dist\win-unpacked\VR Radar Lite.exe
    echo.
    echo To distribute, zip the entire "dist\win-unpacked" folder.
) else (
    echo WARNING: Build finished, but expected EXE was not found.
    echo Please check the dist folder.
)

echo.
echo Press any key to exit...
pause >nul
endlocal
