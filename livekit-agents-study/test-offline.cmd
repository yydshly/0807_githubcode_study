@echo off
setlocal
cd /d "%~dp0"
".venv\Scripts\python.exe" -m pytest "tests\test_offline_agent_demo.py" -q
set "exit_code=%errorlevel%"
endlocal & exit /b %exit_code%
