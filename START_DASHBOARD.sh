#!/bin/bash
# ============================================================
# AIR QUALITY DASHBOARD - STARTUP SCRIPT (Mac/Linux)
# ============================================================
# Make this executable: chmod +x START_DASHBOARD.sh
# Then run: ./START_DASHBOARD.sh
# ============================================================

echo "Starting Air Quality Dashboard..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed"
    echo "Please install Python from https://www.python.org"
    exit 1
fi

echo "Step 1: Checking dependencies..."
pip3 install flask scikit-learn pandas numpy --quiet
echo "Step 1: OK"

echo ""
echo "Step 2: Checking model file..."
if [ ! -f "random_forest_regression_model.pkl" ]; then
    echo "Model file not found. Training model..."
    python3 train_model.py
else
    echo "Model file found. OK"
fi

echo ""
echo "Step 3: Starting Flask server..."
echo "============================================================"
echo "IMPORTANT: Keep this terminal OPEN while using the dashboard!"
echo "============================================================"
echo ""
echo "Dashboard will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "============================================================"
echo ""

python3 app.py
