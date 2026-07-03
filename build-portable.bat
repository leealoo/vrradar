@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo.
echo ========================================
echo   Building Portable EXE
echo ========================================
echo.

echo [1/3] Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)

echo.
echo [2/3] Building Next.js standalone...
call npx next build
if %ERRORLEVEL% neq 0 (
    echo ERROR: Next.js build failed
    pause
    exit /b 1
)

echo.
echo [3/3] Building portable EXE with electron-builder...
call npx electron-builder --win portable
if %ERRORLEVEL% neq 0 (
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
if %ERRORLEVEL% neq 0 (
    echo No EXE found in dist root.
    echo You can use: dist\win-unpacked\VR Radar Lite.exe
)
echo.
pause
endlocal
