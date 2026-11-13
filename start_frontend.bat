@echo off
set "PATH=C:\Program Files\nodejs;C:\Users\akshi\.local\bin;%PATH%"
cd /d "%~dp0frontend"
echo [2/2] Starting Next.js Frontend on http://localhost:3000 ...
call npm run dev
pause
