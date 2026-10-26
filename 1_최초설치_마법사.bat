@echo off
chcp 65001 >nul
title KokioTalk ^& Antigravity 2.0+ Personal AI Secretary Setup Wizard
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [Error] Node.js is not installed. Please install Node.js LTS from https://nodejs.org first!
  pause
  exit /b 1
)
node setup-wizard.js
echo.
echo Starting KokioTalk servers now...
call "%~dp02_start_kokiotalk.bat"
pause