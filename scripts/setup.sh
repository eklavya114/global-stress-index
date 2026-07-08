#!/usr/bin/env bash
# Earth Pulse setup script for macOS/Linux
# Run from the project root: bash scripts/setup.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "=== Earth Pulse Setup ==="

# ── Backend ────────────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Setting up Python backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "  Created virtual environment."
fi

source .venv/bin/activate
pip install -r requirements.txt -q
echo "  Python dependencies installed."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "  Created backend/.env — edit to add API keys."
fi

# ── Frontend ───────────────────────────────────────────────────────────────────
echo ""
echo "[2/5] Setting up Node.js frontend..."
cd "$ROOT/frontend"
npm install --silent
echo "  Node dependencies installed."

if [ ! -f ".env.local" ]; then
    cp .env.example .env.local
    echo "  Created frontend/.env.local."
fi

# ── GeoJSON ────────────────────────────────────────────────────────────────────
echo ""
echo "[3/5] Downloading world GeoJSON..."
cd "$ROOT"
"$ROOT/backend/.venv/bin/python" scripts/download_geodata.py

# ── Seed ───────────────────────────────────────────────────────────────────────
echo ""
echo "[4/5] Seeding country data..."
cd "$ROOT/backend"
"$ROOT/backend/.venv/bin/python" ../scripts/seed_countries.py

echo ""
echo "[5/5] Done!"
echo ""
echo "  Terminal 1 (Backend):  cd backend && source .venv/bin/activate && python run.py"
echo "  Terminal 2 (Frontend): cd frontend && npm run dev"
echo ""
echo "  Dashboard → http://localhost:3000"
echo "  API docs  → http://localhost:8000/docs"
