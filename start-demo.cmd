@echo off
setlocal
cd /d "%~dp0teams"
where node >nul 2>nul
if errorlevel 1 goto missing_node
if not exist node_modules (
  call npm ci
  if errorlevel 1 goto install_failed
)
echo Teams:  http://127.0.0.1:45970/teams
echo Talent: http://127.0.0.1:45980/talent
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
