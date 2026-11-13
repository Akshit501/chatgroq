$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "🚀 Launching GroqChat Full-Stack App..." -ForegroundColor Cyan
Write-Host "📁 Project Directory: $root" -ForegroundColor DarkGray
Write-Host "=================================================" -ForegroundColor Cyan

# 1. Start FastAPI Backend (Port 8000)
Write-Host "Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit", "-Command", "`$env:Path = 'C:\Program Files\nodejs;' + `$env:Path; Write-Host '--- FASTAPI BACKEND (Port 8000) ---' -ForegroundColor Green; uv run uvicorn backend.main:app --port 8000 --reload"

# 2. Start Next.js Frontend (Port 3000)
Write-Host "Starting Next.js Frontend on http://localhost:3000..." -ForegroundColor Yellow
Start-Process powershell -WorkingDirectory "$root\frontend" -ArgumentList "-NoExit", "-Command", "`$env:Path = 'C:\Program Files\nodejs;' + `$env:Path; Write-Host '--- NEXT.JS FRONTEND (Port 3000) ---' -ForegroundColor Green; npm run dev"

# Wait 3 seconds and open the browser
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "🎉 Servers launched and browser opened!" -ForegroundColor Green
Write-Host "👉 Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "👉 Backend:  http://127.0.0.1:8000" -ForegroundColor Cyan
