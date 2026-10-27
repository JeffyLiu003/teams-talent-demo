@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
if not exist teams\node_modules (
  call npm run setup
  if errorlevel 1 goto install_failed
)
echo Teams:  http://127.0.0.1:45970/teams
echo Talents: http://127.0.0.1:45980/talents
echo Keep this window open. Press Ctrl+C to stop.
call node scripts\demo.mjs dev
exit /b %errorlevel%
:missing_node
echo Please install Node.js 24.14.1 with npm, then reopen this launcher.
pause
exit /b 1
:install_failed
echo Dependency installation failed. Check npm network access and retry.
pause
exit /b 1
