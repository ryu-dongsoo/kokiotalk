@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================================
echo   🐓 Starting KokioTalk ^& Antigravity 2.0+ Personal AI Agent...
echo ==================================================================

node scripts\build-server.cjs >nul 2>&1
start "KokioTalk Core (8082)" /min cmd /c "node server\dist\index.mjs"
start "KokioTalk Gateway (8081)" /min cmd /c "cd /d gateway-server && node server.js"

timeout /t 2 /nobreak >nul
start "" "http://localhost:8081"
start "" "http://localhost:8081/qr"
echo ✅ KokioTalk is running on http://localhost:8081 (Mobile QR: http://localhost:8081/qr)
