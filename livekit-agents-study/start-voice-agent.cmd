@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\start-voice-agent.ps1" %*
exit /b %errorlevel%
