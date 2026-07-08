<div align="center">

# 🌍 Earth Pulse

### Real Time Civilization Stress Index

A live dashboard that scores every country on Earth from 0 to 100 across conflict, food security, and economic health, rendered on an interactive 3D globe.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-ML%20Model-EC0000?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

</div>

---

## Overview

Earth Pulse pulls live data from ACLED, GDELT, the World Bank, FAO, and UNHCR, feeds it through an XGBoost model, and produces a single Pulse Score per country every few hours. Scores are rendered on a MapLibre GL world heatmap so you can watch global stress shift day by day.

```
Pulse Score = 0.40 × Conflict + 0.30 × Food Stress + 0.30 × Economic Stress
```

Every dimension runs from 0 (stable) to 100 (crisis).

## Features

🌐 **Interactive Globe** — a 3D world map built with MapLibre GL and Three.js, color coded by stress level

📊 **Live Country Panels** — drill into any country to see its conflict, food, and economic breakdown

📈 **Trend Tracking** — historical score charts so you can see whether a country is stabilizing or deteriorating

🛰️ **Automated Scrapers** — background jobs pull fresh data from five independent sources on a schedule

🧠 **XGBoost Scoring Engine** — a trained model turns raw indicators into a normalized 0 to 100 score

🔍 **Command Palette & Watchlist** — quickly jump between countries and track the ones you care about

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| Mapping | MapLibre GL, react map gl, Three.js, d3 geo |
| Backend | FastAPI, SQLAlchemy (async), APScheduler |
| Scoring | XGBoost, scikit learn, pandas, numpy |
| Database | SQLite by default, PostgreSQL via Supabase optional |
| Data Sources | ACLED, GDELT, World Bank, FAO, UNHCR |

## Architecture

```
┌──────────────┐    every 6h    ┌────────────────┐
│   Scrapers   │ ─────────────► │   Database     │
│ ACLED / GDELT│                │ raw_metrics    │
│ WorldBank    │                │ pulse_scores   │
│ FAO / UNHCR  │                └───────┬────────┘
└──────────────┘                        │
                                        ▼
┌──────────────┐                ┌────────────────┐
│  XGBoost     │ ◄──────────────│ Feature Engine │
│  Scorer      │    features    │                │
└──────┬───────┘                └────────────────┘
       │ scores
       ▼
┌──────────────┐    REST API    ┌────────────────┐
│  FastAPI     │ ─────────────► │  Next.js       │
│  /api/scores │                │  MapLibre GL   │
└──────────────┘                └────────────────┘
```

## Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |

### 1. Clone the repository

```bash
git clone https://github.com/eklavya114/global-stress-index.git
cd global-stress-index
```

### 2. Set up the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

The app works out of the box with SQLite and no API keys. See the configuration section below for optional enhancements.

### 3. Set up the frontend

```bash
cd ../frontend
npm install
cp .env.example .env.local
```

### 4. Download world map boundaries

```bash
cd ..
python scripts/download_geodata.py
```

### 5. Seed countries and initial scores

```bash
cd backend
python ../scripts/seed_countries.py
```

### 6. Run it

**Terminal 1, backend:**
```bash
cd backend
python run.py
```
API available at `http://localhost:8000`, interactive docs at `http://localhost:8000/docs`.

**Terminal 2, frontend:**
```bash
cd frontend
npm run dev
```
Dashboard available at `http://localhost:3000`.

## Configuration

### Optional API keys

The app runs fully without any keys. Add these to `backend/.env` for richer conflict data.

```env
ACLED_API_KEY=your_key
ACLED_EMAIL=your_email@example.com
```

Get a free key at [developer.acleddata.com](https://developer.acleddata.com). World Bank, GDELT, FAO, and UNHCR require no key.

### Optional Postgres via Supabase

By default the app uses SQLite with zero setup. To use Postgres instead:

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial.sql` in the SQL editor
3. Add to `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

### Frontend environment

`frontend/.env.local` needs a MapTiler key for the base map tiles (free tier available at [maptiler.com](https://www.maptiler.com)):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_key
```

## Refreshing Data Manually

```bash
# Trigger all scrapers immediately
curl -X POST http://localhost:8000/api/scrapers/run

# Recompute scores from the latest data
curl -X POST http://localhost:8000/api/scores/refresh
```

## Project Structure

```
earth-pulse/
├── backend/
│   ├── app/
│   │   ├── scrapers/     data collection from external sources
│   │   ├── scoring/      feature engineering and XGBoost scoring
│   │   ├── routers/      REST API endpoints
│   │   └── tasks/        background scheduler
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/          Next.js app router pages
│       ├── components/   globe, panels, score cards, charts
│       └── lib/          API client
├── models/               trained XGBoost model artifacts
├── supabase/
│   └── migrations/       Postgres schema
└── scripts/              setup, seeding, and geodata scripts
```

## Roadmap

- [ ] Historical replay mode to scrub through past months
- [ ] Regional aggregation view (continent level rollups)
- [ ] Alerting when a country crosses a stress threshold
- [ ] Public read only API rate limiting

## License

Released under the MIT License.

---

<div align="center">

Built by [eklavya114](https://github.com/eklavya114)

</div>
