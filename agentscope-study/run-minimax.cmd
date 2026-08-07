@echo off
set PYTHONUTF8=1
"%~dp0.venv\Scripts\python.exe" "%~dp0src\live_demo.py" --config "%~dp0config.local.json" %*
