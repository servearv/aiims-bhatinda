@echo off
title AIIMS Bathinda - Setup and Launch
echo.
echo  ======================================
echo   AIIMS Bathinda - Enterprise Portal
echo  ======================================
echo.

REM --- Step 1: Set up Python virtual environment ---
echo [1/4] Setting up Python environment...
if not exist venv (
    python -m venv venv
    echo  Created virtual environment.
)
call venv\Scripts\activate.bat
pip install --quiet flask >nul 2>&1
if errorlevel 1 (
    echo  ERROR: pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)
echo  OK - Python environment ready.
echo.

REM --- Step 2: Install Node.js dependencies ---
echo [2/4] Installing Node.js dependencies...
if not exist node_modules (
    call npm install >nul 2>&1
    if errorlevel 1 (
        echo  ERROR: npm install failed. Make sure Node.js and npm are installed.
        pause
        exit /b 1
    )
)
echo  OK - Node modules ready.
echo.

REM --- Step 3: Build React frontend ---
echo [3/4] Building React frontend...
call npx vite build >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Frontend build failed.
    pause
    exit /b 1
)
echo  OK - Frontend built to dist/
echo.

REM --- Step 4: Delete old database for fresh start ---
echo [4/4] Resetting database...
del database.db 2>nul
echo  OK - Clean database will be created on startup.
echo.

echo  ============================================
echo   Starting server on http://localhost:3000
echo   Login: Admin / admin
echo  ============================================
echo.

python server.py
pause
