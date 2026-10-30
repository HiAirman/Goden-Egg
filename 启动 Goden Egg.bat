@echo off
setlocal
cd /d "%~dp0"
title Goden Egg - Local Trading Journal
set "APP_URL=http://127.0.0.1:4173"

rem If the Node service is already running, just open the browser.
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173/api/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  echo [Goden Egg] Local service is already running.
  echo [Goden Egg] Opening %APP_URL%
  start "" "%APP_URL%"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [Goden Egg] Node.js was not found.
  echo Please install Node.js 20.19 or newer, then run this file again.
  echo Download: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
echo [Goden Egg] Node.js %NODE_VERSION%

if not exist "node_modules" (
  echo [Goden Egg] First run: installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [Goden Egg] Dependency installation failed. Check your network and try again.
    pause
    exit /b 1
  )
)

if not exist "dist\index.html" (
  echo [Goden Egg] Building the application...
  call npm run build
  if errorlevel 1 (
    echo [Goden Egg] Build failed. Please check the error messages above.
    pause
    exit /b 1
  )
)

rem If the port is occupied but /api/health did not answer, it is probably another app.
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo.
  echo [Goden Egg] Port 4173 is already in use, but the Goden Egg API did not answer.
  echo Close the process using port 4173, or change the port in server.mjs.
  echo.
  pause
  exit /b 1
)

echo [Goden Egg] Starting local service at %APP_URL%
echo [Goden Egg] Data file: %~dp0data\state.json
node server.mjs --open
pause
