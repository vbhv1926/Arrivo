@echo off
rem Double-click this on Windows to run Arrivo.
rem It starts the server and opens http://localhost:8787 in your browser.
rem Close this window (or press Ctrl+C) to stop it.

cd /d "%~dp0"
if not defined PORT set PORT=8787
set URL=http://localhost:%PORT%

echo.
echo   arrivo.
echo   ------
echo.

rem already running? then just open it
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%/api/health' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel%==0 (
  echo Arrivo is already running. Opening %URL%
  start "" "%URL%"
  exit /b 0
)

rem find python 3.8+ (the "py" launcher first, then "python")
set PY=
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul && set PY=py -3
if not defined PY (
  python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul && set PY=python
)
if not defined PY (
  echo Arrivo needs Python 3.8 or newer, and it isn't installed.
  echo Get it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^)
  echo then double-click start.bat again.
  echo.
  pause
  exit /b 1
)

rem the site comes built from GitHub. only build it if frontend\dist is missing
if not exist "frontend\dist\index.html" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo frontend\dist is missing and Node.js isn't installed to build it.
    echo Install Node from https://nodejs.org or download the repo again.
    echo.
    pause
    exit /b 1
  )
  echo Building the site ^(first run only^)...
  pushd frontend
  call npm install
  if errorlevel 1 goto buildfail
  call npm run build
  if errorlevel 1 goto buildfail
  popd
)

rem open the browser as soon as the server answers
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 60; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 '%URL%/api/health' | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep -Milliseconds 500 } }"

echo Starting Arrivo on %URL%  (Ctrl+C or close this window to stop)
echo.
%PY% backend\server.py --port %PORT%
echo.
pause
exit /b 0

:buildfail
popd
echo The build failed. See the messages above.
echo.
pause
exit /b 1
