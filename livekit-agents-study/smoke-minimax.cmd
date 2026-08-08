@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" src\minimax_room_smoke.py
exit /b %errorlevel%
