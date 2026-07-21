@echo off
REM Start the C101 dev server and open it in the default browser.
cd /d "%~dp0"

REM Launch the server in its own window (keeps logs visible; close it to stop).
start "C101 dev server" cmd /k node serve.js

REM Give the server a moment to bind, then open the app.
timeout /t 1 /nobreak >nul
start "" http://localhost:5173

exit /b 0
