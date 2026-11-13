@echo off
set "PATH=C:\Program Files\nodejs;C:\Users\akshi\.local\bin;%PATH%"
cd /d "%~dp0"
echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
call uv run uvicorn backend.main:app --port 8000 --reload
pause
