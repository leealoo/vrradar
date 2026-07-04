@echo off
setlocal enabledelayedexpansion
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
echo   Building Portable EXE
echo ========================================
echo.

echo [1/3] Generating Prisma client...
call npx prisma generate
if !ERRORLEVEL! neq 0 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building Next.js standalone...
call npx next build
if !ERRORLEVEL! neq 0 (
    echo ERROR: Next.js build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Building portable EXE with electron-builder...
call npx electron-builder --win portable
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: electron-builder failed
    echo Trying alternative: building NSIS installer...
    call npx electron-builder --win nsis
)

echo.
echo ========================================
echo   Build complete!
echo   Output: dist\ folder
echo ========================================
echo.
dir /b dist\*.exe 2>nul
if !ERRORLEVEL! neq 0 (
    echo No EXE found in dist root.
    echo You can use: dist\win-unpacked\VR Radar Lite.exe
)
echo.
pause
endlocal
