@echo off
set "PATH=C:\Program Files\nodejs;C:\Users\akshi\.local\bin;%PATH%"
cd /d "%~dp0"
echo ==============================================
echo 🚀 Launching GroqChat Full-Stack App...
echo ==============================================
start "GroqChat Backend" "%~dp0start_backend.bat"
start "GroqChat Frontend" "%~dp0start_frontend.bat"
timeout /t 5 /nobreak >nul
start http://localhost:3000
