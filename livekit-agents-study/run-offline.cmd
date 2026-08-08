@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" "src\offline_agent_demo.py" --output "evidence\offline-demo.json"
set "exit_code=%errorlevel%"
endlocal & exit /b %exit_code%
