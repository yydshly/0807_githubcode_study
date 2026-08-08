@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\smoke-xiaomi-asr.ps1
exit /b %errorlevel%
