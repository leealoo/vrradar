$ErrorActionPreference = "Stop"

Write-Host "VR Radar Lite Windows packaging" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is not installed. Please install Node.js 20 LTS from https://nodejs.org/ first."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm is not available. Please reinstall Node.js with npm enabled."
}

$nodeVersion = node --version
Write-Host "Node: $nodeVersion"

if (-not (Test-Path "package.json")) {
  throw "Please run this script from the VRRadar project root."
}

Write-Host "Installing dependencies..."
npm install

Write-Host "Preparing Prisma client and SQLite template..."
npm run prisma:generate
npm run prisma:push

Write-Host "Building Next.js standalone app..."
npm run build:web

Write-Host "Building Windows installer..."
npx electron-builder --win nsis

Write-Host ""
Write-Host "Done. Installer files are in the dist directory." -ForegroundColor Green
Get-ChildItem dist -Filter "*.exe" | Select-Object FullName, Length, LastWriteTime
