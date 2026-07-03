@echo off
setlocal

:: Add Node.js to PATH
set "PATH=C:\Program Files\nodejs;%PATH%"

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
