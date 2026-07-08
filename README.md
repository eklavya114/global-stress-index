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

### [🚀 View the Live Dashboard](https://earth-pulse-ivory.vercel.app)

</div>

---

## The Problem

Understanding where the world is under stress usually means juggling a dozen tabs: a conflict tracker here, a commodity price index there, a World Bank economic report somewhere else. The signals are scattered across sources that never talk to each other, use different country names, and update on different schedules. By the time you have stitched them together, the picture is already stale.

**Earth Pulse collapses that whole workflow into a single number per country, refreshed automatically, on one map.**

It continuously pulls live data from five authoritative sources (ACLED, GDELT, the World Bank, FAO, and UNHCR), normalizes them, and runs them through a machine learning model that outputs one **Pulse Score** from 0 to 100 for every country — a plain, comparable measure of how much stress a nation is under right now.

> **[🌍 Open the live dashboard →](https://earth-pulse-ivory.vercel.app)**

## Who It Is For

Earth Pulse is built for anyone who needs a fast, defensible read on global stability without doing the data plumbing themselves.

| If you are a… | You can use Earth Pulse to… |
|---|---|
| **📰 Journalist / Newsroom** | Spot which countries are deteriorating fastest and find the data-backed story before it breaks. The built-in "Story Finder" surfaces the biggest week-over-week movers automatically. |
| **🏛️ Policy analyst / NGO / Humanitarian** | Prioritize where aid, attention, or intervention is most urgently needed, and back the decision with a transparent, reproducible score instead of gut feel. |
| **📈 Investor / Risk analyst** | Screen country risk for supply chains, emerging-market exposure, or sovereign positions — the economic dimension flags currency, inflation, and GDP stress early. |
| **🎓 Researcher / Student** | Access clean, normalized, multi-source indicators through one open REST API instead of scraping five agencies by hand. |
| **🧭 The globally curious** | Simply understand the state of the world at a glance — which regions are stable, which are in crisis, and how that changes day to day. |

## What You Get Out Of It

- **One score instead of a dozen dashboards.** Conflict, food security, and economic stress folded into a single 0–100 number you can actually compare across countries.
- **Always current.** Background jobs refresh the underlying data every few hours — you are never looking at last quarter's snapshot.
- **Drill-down on demand.** Click any country to see exactly *why* its score is what it is, broken into its three driving dimensions.
- **See the trajectory, not just the moment.** Trend charts show whether a country is stabilizing or sliding, so you can act early.
- **Fully transparent & open.** The scoring formula is published (below), the sources are named, and the entire thing is open source — nothing is a black box.

## How the Pulse Score Works

Every country's score is a weighted blend of three dimensions, each independently measured from 0 (stable) to 100 (crisis):

```
Pulse Score = 0.40 × Conflict  +  0.30 × Food Stress  +  0.30 × Economic Stress
```

| Dimension | Weight | What it captures | Sourced from |
|---|---|---|---|
| **Conflict** | 40% | Political violence, fatalities, event intensity, media tone | ACLED, GDELT |
| **Food Stress** | 30% | Food price volatility, food-security indicators, displacement | FAO, World Bank, UNHCR |
| **Economic Stress** | 30% | GDP pressure, inflation, unemployment | World Bank |

**Reading the number:**

| Range | Meaning |
|---|---|
| 🟢 **0 – 20** | Stable |
| 🟡 **20 – 35** | Elevated stress — worth watching |
| 🟠 **35 – 65** | High stress |
| 🔴 **65 – 100** | Crisis |

*(These are the exact color breakpoints used by the dashboard's map legend.)*

## Try It in 30 Seconds

1. Open the **[live dashboard](https://earth-pulse-ivory.vercel.app)**.
2. The **Morning Brief** greets you with today's most critical countries — dismiss it to reach the map.
3. **Hover** any country to see its Pulse Score; **click** it to open the full breakdown panel.
4. Switch to the **Trends** tab to see who is rising and falling, or open the **Command Palette** (top of the screen) to jump straight to any country.
5. Add countries to your **Watchlist** to track the ones that matter to you.

> ⏳ **Note:** the live backend runs on a free tier that sleeps after inactivity, so the *first* load after an idle period may take ~40–50 seconds to wake up. After that it is instant.

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

## Public API

Every score the dashboard shows is available as clean JSON — no key required for reads. Point any tool at the live API or your local server.

| Endpoint | Returns |
|---|---|
| `GET /api/scores/latest` | Latest Pulse Score for every country |
| `GET /api/scores/{iso3}?days=30` | Score history for one country (e.g. `SSD`, `HTI`) |
| `GET /api/stats` | Global rollup — average score, highest/lowest stress |
| `GET /api/countries` | Country reference data (names, coordinates, regions) |
| `GET /api/trends?days=7` | Biggest movers over a time window |
| `GET /docs` | Full interactive API reference (Swagger UI) |

```bash
# Example: today's most-stressed countries, live
curl https://earth-pulse-api.onrender.com/api/stats
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
