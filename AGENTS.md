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
GEMINI_API_KEY=      # Removed — replaced by GROQ_API_KEY
GROQ_API_KEY=        # AI-assisted analysis (free at console.groq.com)
RESEND_API_KEY=      # Optional: monthly forecast emails (100/day free at resend.com)
RESEND_FROM=         # Optional, default: HealthWatch <onboarding@resend.dev>
JOB_TOKEN=           # Optional: secret for POST /subscriptions/send-due external cron
APP_URL=https://healthwatch-ui.onrender.com  # Base URL used in email CTAs/footer
SUBSCRIPTIONS_DB=    # Optional: override SQLite subscription store path
DISABLE_SUBSCRIPTION_SCHEDULER=  # Set 1 to disable the in-process monthly sender
```

When `DATABASE_URL` is unset, backend falls back to `data/processed/healthwatch.db`.
Subscriptions (`src/subscription_store.py`) prefer Postgres when `DATABASE_URL` is set
(auto-creates a `subscriptions` table in Supabase, so they survive Render redeploys);
otherwise they fall back to SQLite via `SUBSCRIPTIONS_DB` (default
`data/subscriptions.sqlite3`) for local/dev. `JOB_TOKEN` is required on deployed
environments: it guards `POST /subscriptions/send-due` (external monthly cron, e.g.
cron-job.org — the in-process 6-hourly scheduler won't fire while a free Render
instance is asleep).

## Design Tooling (Impeccable)

The UI is governed by a documented design system: `PRODUCT.md` (product truth) and
`DESIGN.md` (rules/tokens) at repo root, with a machine-readable sidecar in
`.impeccable/design.json` (schema v2). UI work must stay consistent with these docs;
after editing UI files, run the mechanical checker from the Impeccable CLI (installed
for all harnesses via `npx impeccable install`, https://impeccable.style):

```powershell
# Review resolved context (PRODUCT.md + DESIGN.md)
& "$env:USERPROFILE\.config\opencode\skills\impeccable\scripts\impeccable.cmd" context

# Check changed UI files for detected deviations
& "$env:USERPROFILE\.config\opencode\skills\impeccable\scripts\impeccable.cmd" detect --json <changed targets>
```

Repo utilities in `.impeccable/`:

```powershell
.venv\Scripts\python .impeccable\gen_design_json.py   # regenerate design.json from DESIGN.md tokens
.venv\Scripts\python .impeccable\contrast_audit.py    # WCAG contrast audit of the oklch token pairs
```

Key rules enforced: one coral accent (`One Stamp`), green/amber/red reserved for risk data
(`Risk Reservation`), mono `label-caps` for metadata (`Instrument Label`), and glass panels,
never body text, carrying shadow (`Glass Floor`).

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
- `run-dev.ps1` surfaces user-scope env vars (e.g., `GROQ_API_KEY`) even if shell was opened before `setx`.
- Port 8000 conflicts: close old uvicorn window before restarting.
- Node 20.19+ or 22.12+ required (Vite 8).
- Render deploy: API uses `requirements.txt`, frontend uses `npm ci && npm run build`.
