# AGENTS.md

## Project Overview

Regional time-series analysis system for seasonal illness outbreak prediction (Philippines, dengue only). Backend: FastAPI + SQLAlchemy + PostgreSQL/SQLite. Frontend: React + Vite + TanStack Router + Leaflet choropleth. LLM narration layer (Gemini/Groq) for interpretability.

## Quick Commands

```powershell
# Backend (from repo root)
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python -m uvicorn src.api:app --port 8000

# Frontend (from frontend/)
cd frontend
npm install
npm run dev          # Vite dev server

# One-shot launcher
powershell -ExecutionPolicy Bypass -File run-dev.ps1
```

## Data Pipeline (only if raw data changes)

```powershell
.venv\Scripts\python -m src.doh_eb_ingest           # raw → monthly series
.venv\Scripts\python -m src.forecast                # Prophet fits + 12-month forecasts
.venv\Scripts\python -m src.classify                # risk + probe classification
.venv\Scripts\python -m src.outbreak                # season-level outbreak flags
.venv\Scripts\python -m src.validate_2025           # prospective 2025 validation
.venv\Scripts\python -m src.validate_known_epidemic # independent 2019 outbreak check
.venv\Scripts\python -m src.db                      # rebuild relational DB from processed CSVs
```

## Environment Variables

Create `.env` at repo root (git-ignored):

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
GEMINI_API_KEY=      # Optional: free tier at aistudio.google.com
GROQ_API_KEY=        # Alternative to Gemini (free at console.groq.com)
```

When `DATABASE_URL` is unset, backend falls back to `data/processed/healthwatch.db`.

## Architecture

- `src/` — Python pipeline (ingest → forecast → classify → outbreak → db) + FastAPI app (`api.py`)
- `frontend/` — React + Vite + TanStack Router dashboard
- `data/raw/` — canonical DOH-Epi-Dengue CSV (2022-2026, 56 months)
- `data/processed/` — pipeline output (CSVs + SQLite DB)
- `frontend/public/geo/` — PSGC region GeoJSON for choropleth

## Key Constraints

- **Disease: dengue only** for this release. Schema is disease-agnostic; other illnesses are deferred.
- **Prediction: Prophet only** (monthly, `freq="MS"`).
- **National series is derived** (sum of 18 regions), never raw.
- **Data ships in repo** — no pipeline run needed to start the app.

## Testing / Validation

No formal test suite. Validation scripts are run manually:
- `src.validate_2025` — prospective check of 2025 outbreak flags
- `src.validate_known_epidemic` — independent 2019 outbreak check (weekly fixture)

## Lovable Connection

This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, rebasing, or amending pushed commits — as it rewrites Lovable's history and the user will lose project history.

Commits pushed to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.

## Gotchas

- Backend loads all data at startup into memory (pandas DataFrames). Slow cold start, fast after.
- CORS allows localhost and `*.onrender.com` by default. Set `ALLOWED_ORIGINS` in `.env` for custom origins.
- `run-dev.ps1` surfaces user-scope env vars (e.g., `GEMINI_API_KEY`) even if shell was opened before `setx`.
- Port 8000 conflicts: close old uvicorn window before restarting.
- Node 20.19+ or 22.12+ required (Vite 8).
- Render deploy: API uses `requirements.txt`, frontend uses `npm ci && npm run build`.
