@echo off
title AyurSutra - Panchakarma Clinic Platform
echo ===================================================
echo        Starting AyurSutra Development Servers
echo ===================================================
echo.

:: 1. Start FastAPI backend in a separate window
echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "AyurSutra Backend API" cmd /k "cd backend && uvicorn app.main:app --reload --port 8000"

:: 2. Wait 2 seconds for backend initialization
timeout /t 2 /nobreak >nul

:: 3. Start Vite React Frontend
echo [2/2] Starting Vite Frontend on http://localhost:5173 ...
start "AyurSutra Frontend SPA" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo Both servers are launching!
echo Frontend: http://localhost:5173
echo Backend API Docs: http://localhost:8000/docs
echo ===================================================
pause
