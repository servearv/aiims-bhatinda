#!/usr/bin/env bash
set -e

echo ""
echo "  ======================================"
echo "   AIIMS Bathinda - Enterprise Portal"
echo "  ======================================"
echo ""

cd "$(dirname "$0")"

# --- Step 1: Set up Python virtual environment ---
echo "[1/4] Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "  Created virtual environment."
fi
source venv/bin/activate
pip install --quiet flask
echo "  OK - Python environment ready."
echo ""

# --- Step 2: Install Node.js dependencies ---
echo "[2/4] Installing Node.js dependencies..."
if [ ! -d "node_modules" ]; then
    npm install >/dev/null 2>&1
fi
echo "  OK - Node modules ready."
echo ""

# --- Step 3: Build React frontend ---
echo "[3/4] Building React frontend..."
npx vite build >/dev/null 2>&1
echo "  OK - Frontend built to dist/"
echo ""

# --- Step 4: Reset database for fresh start ---
echo "[4/4] Resetting database..."
rm -f database.db
echo "  OK - Clean database will be created on startup."
echo ""

echo "  ============================================"
echo "   Starting server on http://localhost:3000"
echo "   Login: Admin / admin"
echo "  ============================================"
echo ""

python server.py
