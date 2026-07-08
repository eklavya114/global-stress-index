# Earth Pulse setup script for Windows (PowerShell)
# Run from the project root: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "`n=== Earth Pulse Setup ===" -ForegroundColor Cyan

# ── Backend ───────────────────────────────────────────────────────────────────
Write-Host "`n[1/5] Setting up Python backend..." -ForegroundColor Yellow
Set-Location "$Root\backend"

if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "  Created virtual environment."
}

& ".venv\Scripts\pip.exe" install -r requirements.txt -q
Write-Host "  Python dependencies installed."

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created backend/.env from example — edit to add API keys."
}

# ── Frontend ──────────────────────────────────────────────────────────────────
Write-Host "`n[2/5] Setting up Node.js frontend..." -ForegroundColor Yellow
Set-Location "$Root\frontend"
npm install --silent
Write-Host "  Node dependencies installed."

if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "  Created frontend/.env.local."
}

# ── GeoJSON ───────────────────────────────────────────────────────────────────
Write-Host "`n[3/5] Downloading world GeoJSON..." -ForegroundColor Yellow
Set-Location $Root
& "$Root\backend\.venv\Scripts\python.exe" scripts\download_geodata.py

# ── Seed countries ─────────────────────────────────────────────────────────────
Write-Host "`n[4/5] Seeding country data..." -ForegroundColor Yellow
Set-Location "$Root\backend"
& ".venv\Scripts\python.exe" ..\scripts\seed_countries.py

Write-Host "`n[5/5] Done!" -ForegroundColor Green
Write-Host @"

Next steps:
  Terminal 1 (Backend):   cd backend && .venv\Scripts\activate && python run.py
  Terminal 2 (Frontend):  cd frontend && npm run dev

  Dashboard → http://localhost:3000
  API docs  → http://localhost:8000/docs
"@
