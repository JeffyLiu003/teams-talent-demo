@echo off
setlocal EnableExtensions
cd /d "%~dp0teams"
where node >nul 2>nul
if errorlevel 1 goto missing_node
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto install_failed
)

rem ---- trace monitor (Vue 3 + Element Plus), built into dist/trace-monitor ----
if not exist "trace-monitor\node_modules" (
  echo Installing trace-monitor dependencies...
  pushd trace-monitor
  call npm ci
  if errorlevel 1 (
    popd
    goto trace_monitor_install_failed
  )
  popd
)

rem ---- python trace-server (started automatically by the demo service) ----
set "DEMO_TRACE_PYTHON="
for /f "delims=" %%P in ('where python 2^>nul') do if not defined DEMO_TRACE_PYTHON set "DEMO_TRACE_PYTHON=%%P"
if not defined DEMO_TRACE_PYTHON (
  where py >nul 2>nul
  if not errorlevel 1 set "DEMO_TRACE_PYTHON=py"
)
if not defined DEMO_TRACE_PYTHON goto trace_python_missing
"%DEMO_TRACE_PYTHON%" -c "import fastapi, uvicorn, dotenv, google.protobuf" >nul 2>nul
if errorlevel 1 (
  echo Installing trace-server Python dependencies...
  "%DEMO_TRACE_PYTHON%" -m pip install -r "trace-server\requirements.txt"
  if errorlevel 1 echo [WARN] pip install failed - the trace page will show a connection error.
)
goto launch

:trace_python_missing
echo [WARN] Python 3 not found on PATH.
echo        Install Python 3.10+ and retry, or set DEMO_TRACE_PYTHON to a python.exe.
echo.

:launch
echo Teams:      http://127.0.0.1:45970/teams
echo Talent:     http://127.0.0.1:45980/talent
echo Trace page: http://127.0.0.1:45970/teams?demo-role=owner#/trace-monitor
echo Trace API:  http://127.0.0.1:8012  (/v1/traces for OTLP, /api/v1 for queries)
echo.
echo Building app + trace monitor, then starting Teams, Talent and trace-server.
echo Keep this window open. Press Ctrl+C to stop.
call npm run dev
exit /b %errorlevel%
:missing_node
echo Please install Node.js 24.14.1 with npm, then reopen this launcher.
pause
exit /b 1
:install_failed
echo Dependency installation failed. Check npm network access and retry.
pause
exit /b 1
:trace_monitor_install_failed
echo trace-monitor dependency installation failed. Check npm network access and retry.
pause
exit /b 1
