@echo off
chcp 65001 >nul
title Stop KokioTalk Servers
echo Stopping KokioTalk and tunnel processes...
taskkill /F /IM cloudflared-kokio.exe >nul 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8081 :8082" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul
echo [OK] Stopped all servers.
pause