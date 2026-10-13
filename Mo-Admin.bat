@echo off
setlocal
pushd "%~dp0" || exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node
if not exist "node_modules\.bin\wrangler.cmd" goto missing_dependencies
if not exist "workers\admin\.dev.vars" goto missing_config
if /i "%~1"=="--check" (
  echo Admin launcher is ready.
  popd
  exit /b 0
)
echo Starting Hyper D Admin at http://127.0.0.1:8788
echo Keep this window open. Press Ctrl+C to stop the admin server.
call npm.cmd run cf:local:migrate:admin
if errorlevel 1 goto failed
start "" /b powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-admin-browser.ps1"
call npm.cmd run admin
set "admin_exit=%errorlevel%"
if not "%admin_exit%"=="0" (
  echo Admin could not start. Check the error above.
  pause
)
popd
exit /b %admin_exit%

:missing_node
echo Install Node.js to run the admin page.
goto failed
:missing_dependencies
echo Dependencies are missing. Run npm ci in this folder first.
goto failed
:missing_config
echo Local admin configuration is missing.
echo Follow workers\admin\README.md to configure local admin first.
:failed
if /i not "%~1"=="--check" pause
popd
exit /b 1
