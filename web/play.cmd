@echo off
rem Pocha Tycoon launcher: start the dev server if it is not running, then open the game in its own Chrome window (game area 1280x720).
cd /d "%~dp0"
curl -s -o nul http://localhost:5173/
if not errorlevel 1 goto open
start "pocha-dev-server" /min cmd /c "npm run dev"
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:5173/
if not errorlevel 1 goto open
set /a tries+=1
if %tries% lss 30 goto wait
echo Dev server did not start. Run "npm install" in this folder once, then try again.
pause
exit /b 1
:open
set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
start "" "%BROWSER%" --user-data-dir="%LOCALAPPDATA%\PochaTycoon\chrome" --no-first-run --no-default-browser-check --app=http://localhost:5173/?app=1 --window-size=1296,815
