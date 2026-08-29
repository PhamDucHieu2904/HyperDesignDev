@echo off
setlocal
pushd "%~dp0" || exit /b 1
if not exist "index.html" goto missing
if not exist "assets\app.js" goto missing
if not exist "assets\app.css" goto missing
if not exist "public\hieu-wallpaper.png" goto missing
if not exist "public\GoogleSansFlex.ttf" goto missing
if /i "%~1"=="--check" (
  echo Static website is ready.
  popd
  exit /b 0
)
start "" "%~dp0index.html"
if errorlevel 1 (
  echo Could not open the browser. Please open index.html manually.
  pause
  popd
  exit /b 1
)
popd
exit /b 0

:missing
echo Website files are missing. Keep index.html, assets and public together.
echo To rebuild from source, install Node.js then run: npm ci ^&^& npm run build
if /i not "%~1"=="--check" pause
popd
exit /b 1
