@echo off
setlocal enabledelayedexpansion
title VR Radar Lite - Build Portable EXE

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
echo   VR Radar Lite - Portable EXE Builder
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

:: Step 2: Clean previous build
echo.
echo [2/5] Cleaning previous build...
if exist "dist\" (
    rmdir /s /q "dist" 2>nul
    if exist "dist\" (
        echo WARNING: Cannot delete old dist folder. Please close any running VR Radar Lite instances.
        pause
        exit /b 1
    )
)
echo Clean: OK

:: Step 3: Prisma generate
echo.
echo [3/5] Generating Prisma client...
call npx prisma generate
if !ERRORLEVEL! neq 0 (
    echo ERROR: Prisma generate failed.
    pause
    exit /b 1
)

:: Step 4: Next.js build
echo.
echo [4/5] Building Next.js standalone...
call npx next build
if !ERRORLEVEL! neq 0 (
    echo ERROR: Next.js build failed.
    pause
    exit /b 1
)

:: Step 5: Build unpacked first, then portable
echo.
echo [5/5] Building with electron-builder...
echo Step 5a: Creating unpacked build...
call npx electron-builder --win --dir

if !ERRORLEVEL! neq 0 (
    echo ERROR: Unpacked build failed.
    pause
    exit /b 1
)

:: Safety net: ensure standalone node_modules are complete
echo Step 5b: Verifying node_modules...
set "SOURCE_NM=.next\standalone\node_modules"
set "TARGET_NM=dist\win-unpacked\resources\app\.next\standalone\node_modules"
if exist "%SOURCE_NM%\next\" (
    if not exist "%TARGET_NM%\next\" (
        echo Fixing missing node_modules...
        robocopy "%SOURCE_NM%" "%TARGET_NM%" /e /njh /njs /ndl /nc /ns /np >nul
    )
)
echo Node modules: OK

:: Step 6: Build portable single exe
echo Step 5c: Creating portable single EXE...
echo This may take 2-5 minutes. Please wait...
call npx electron-builder --win portable

echo.
echo ============================================
echo   Build Complete!
echo ============================================
echo.

:: Show results
if exist "dist\VRRadarLite.exe" (
    echo [+] Single EXE: dist\VRRadarLite.exe
    for %%A in ("dist\VRRadarLite.exe") do echo     Size: %%~zA bytes
    echo.
    echo You can distribute this single .exe file.
    echo Users just double-click to run - no installation needed.
) else (
    echo [+] Unpacked EXE: dist\win-unpacked\VR Radar Lite.exe
    echo.
    echo To distribute, zip the entire "dist\win-unpacked" folder.
    echo Users should extract all files and double-click VR Radar Lite.exe
)

echo.
echo Press any key to exit...
pause >nul
endlocal
