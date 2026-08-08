@echo off
setlocal
cd /d "%~dp0"

call test-offline.cmd
if errorlevel 1 goto :failed

call test-local.cmd
if errorlevel 1 goto :failed

pushd upstream
"..\.venv\Scripts\python.exe" -m pytest ^
  "tests\test_agent_session.py::test_events_and_metrics" ^
  "tests\test_agent_session.py::test_tool_call" ^
  "tests\test_agent_session.py::test_interruption" ^
  "tests\test_update_agent_long_on_enter.py::test_update_agent_on_enter_output_captured" ^
  --unit -q
set "exit_code=%errorlevel%"
popd
if not "%exit_code%"=="0" goto :failed

echo Validation complete: 14 checks passed.
endlocal & exit /b 0

:failed
echo Validation failed.
endlocal & exit /b 1
