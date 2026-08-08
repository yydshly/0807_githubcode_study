@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" src\minimax_visual_smoke.py
exit /b %errorlevel%
