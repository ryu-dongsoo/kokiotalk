@echo off
chcp 65001 >nul
set "TS_EXE=C:\Program Files\Tailscale\tailscale.exe"
if not exist "%TS_EXE%" (
    echo [안내] Tailscale이 아직 설치되지 않았습니다.
    exit /b 1
)

echo [1/3] Tailscale 로그인 상태 확인 중...
"%TS_EXE%" status >nul 2>&1
if "%ERRORLEVEL%" neq "0" (
    echo [안내] 브라우저에서 열리는 Tailscale 로그인 창에서 구글 로그인을 완료해 주세요!
    "%TS_EXE%" up
)

echo [2/3] 우유/꼬끼오톡 포트(8081)를 Tailscale Funnel(외부 HTTPS 무제한 고정 도메인)로 개방 중...
"%TS_EXE%" funnel --bg --yes 8081

echo [3/3] 스마트 고정 포털(https://ryu-dongsoo.github.io/ooyoo/)과 주소 동기화 중...
if exist "%USERPROFILE%\.gemini\antigravity\bin\node.exe" (
    "%USERPROFILE%\.gemini\antigravity\bin\node.exe" "%~dp0sync-portal.js"
) else (
    node "%~dp0sync-portal.js"
)
echo [완료] Tailscale 무제한 고정 도메인 및 스마트 포털 연동이 완료되었습니다!
