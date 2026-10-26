@echo off
chcp 65001 >nul
title KokioTalk ^& Personal AI Agent Background Server
cd /d "%~dp0"
echo [1/3] Starting KokioTalk Messenger Engine (Port 8082)...
start "KokioTalk-8082" /min cmd /c "npx tsx server/src/index.ts"
timeout /t 2 /nobreak >nul

echo [2/3] Starting Security Gateway (Port 8081) ^& External Tunnel...
if not exist "%~dp0gateway-server\cloudflared-kokio.exe" (
  echo Downloading official Cloudflare Tunnel binary (first run only)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%~dp0gateway-server\cloudflared-kokio.exe'"
)
start "Gateway-8081" /min cmd /c "node gateway-server/server.js"
if exist "%~dp0gateway-server\cloudflared-kokio.exe" (
  start "Cloudflare-Tunnel" /min cmd /c ""%~dp0gateway-server\cloudflared-kokio.exe" tunnel --url http://127.0.0.1:8081 --logfile "%~dp0gateway-server\cloudflared-kokio.log""
)
timeout /t 3 /nobreak >nul

echo [3/3] Opening KokioTalk PC App ^& Mobile QR Connection Guide...
wscript.exe "%~dp0launch_kokiotalk_pc_app.vbs"
start "" "http://localhost:8081/qr"
echo.
echo [OK] All servers are running!