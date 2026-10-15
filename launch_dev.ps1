Write-Host "===================================================" -ForegroundColor Green
Write-Host "       Starting AyurSutra Development Servers" -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""

# Start FastAPI backend
Write-Host "[1/2] Starting FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uvicorn app.main:app --reload --port 8000"

Start-Sleep -Seconds 2

# Start Vite React frontend
Write-Host "[2/2] Starting Vite Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "Both servers are launching!" -ForegroundColor Yellow
Write-Host "Frontend:        http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend API Doc: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green
