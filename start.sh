#!/usr/bin/env bash
set -e

echo ""
echo "  ======================================"
echo "   AIIMS Bathinda - Enterprise Portal"
echo "  ======================================"
echo ""

cd "$(dirname "$0")"

# --- Step 1: Install Python dependencies ---
echo "[1/4] Installing Python dependencies..."
pip install flask >/dev/null 2>&1 || pip3 install flask >/dev/null 2>&1
echo "  OK - Flask installed."
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
echo "   Login: admin/admin (Admin)"
echo "          doctor/doc (Medical Staff)"
echo "  ============================================"
echo ""

python server.py || python3 server.py
