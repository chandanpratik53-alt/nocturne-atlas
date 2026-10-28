@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   Nocturne Atlas - Local Development Server
echo ===================================================

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "NODE_CMD=node"
) else if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    set "NODE_CMD=%APPDATA%\Antigravity\bin\agy-node.cmd"
) else (
    echo [ERROR] Node.js runtime was not found.
    echo Please install Node.js from https://nodejs.org or run within the Antigravity terminal.
    pause
    exit /b 1
)

echo Using Node runtime: %NODE_CMD%
"%NODE_CMD%" scripts/dev-server.js
pause
