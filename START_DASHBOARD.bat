@echo off
REM ============================================================
REM AIR QUALITY DASHBOARD - STARTUP SCRIPT (Windows)
REM ============================================================
REM This script starts the Flask server and opens the dashboard
REM ============================================================

echo Starting Air Quality Dashboard...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from https://www.python.org
    pause
    exit /b 1
)

echo Step 1: Checking dependencies...
pip install flask scikit-learn pandas numpy --quiet
echo Step 1: OK

echo.
echo Step 2: Checking model file...
if not exist "random_forest_regression_model.pkl" (
    echo Model file not found. Training model...
    python train_model.py
) else (
    echo Model file found. OK
)

echo.
echo Step 3: Starting Flask server...
echo ============================================================
echo IMPORTANT: Keep this window OPEN while using the dashboard!
echo ============================================================
echo.
echo Dashboard will be available at: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo ============================================================
echo.

python app.py
