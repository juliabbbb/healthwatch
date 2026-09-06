# HEALTHWATCH

Regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification.

Forecasting dengue outbreaks per Philippine region (Prophet, monthly), classifying risk tiers
(&lt; P50 Low · P50–75 Moderate · &gt; P75 High) per region-month, publishing a season-level outbreak
indicator for the upcoming dry (Dec–May) and wet (Jun–Nov) windows, served by a FastAPI backend
over a PostgreSQL database (Supabase; local SQLite fallback) and visualized in a React dashboard
with an interactive choropleth map.

Canonical source is the DOH Epidemiology Bureau **monthly** dengue surveillance export
(2022-01 … 2026-08, 56 months), covering all 18 Philippine regions including NIR. The National
series is derived (never raw) as the sum of the 18 regions so regional and national counts stay
consistent.

## Prerequisites

| Tool | Version |
|---|---|
| Git | any recent |
| Python | 3.10+ (3.12 recommended) |
| Node.js | 20.19+ or 22.12+ (required by Vite 8) |

## One-time setup

```powershell
git clone https://github.com/juliabbbb/healthwatch.git
cd healthwatch

# Backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
# ML pipeline (Prophet) — only needed to re-run forecasting locally; the API serves prebuilt data
.venv\Scripts\pip install -r requirements-ml.txt

# Frontend
cd frontend
npm install
cd ..
```

No pipeline run is needed — all data ships in the repo (`data/raw` canonical source file,
`data/processed` cleaned monthly outputs, and `data/processed/healthwatch.db`). When no
`DATABASE_URL` is set, the API falls back to that local SQLite file automatically.

### Live database (optional)

To point the API at the shared PostgreSQL instance instead of local SQLite, create a repo-root
`.env` (git-ignored) with the SaaS/cloud connection string:

```powershell
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
```

The backend (`src/db.py`) parses `.env` itself and always prefers an environment variable already
set in the shell. On Render, set `DATABASE_URL` in the service's environment.

## Running the app

One-shot launcher (opens two windows: API + dashboard):

```powershell
powershell -ExecutionPolicy Bypass -File run-dev.ps1
```

…or manually in two terminals from the repo root:

```powershell
# terminal 1 — backend on :8000
.venv\Scripts\python -m uvicorn src.api:app --port 8000

# terminal 2 — frontend
cd frontend
npm run dev
```

Open whichever URL Vite prints (`localhost:5173`, `8080`, `8081`… — any localhost port works).
Interactive API docs: <http://localhost:8000/docs>

## Troubleshooting

- **"Address already in use" on port 8000** — an old uvicorn window is still open serving stale
  code. Close it and start again.
- **PowerShell blocked `run-dev.ps1`** — use the `-ExecutionPolicy Bypass` flag shown above.
- **Frontend stays on "Loading surveillance data."** — the dashboard fetches all data from the
  backend at `http://localhost:8000` (retrying with backoff), so start terminal 1 first, then
  reload.
- **Backend dies at startup with `OperationalError`/`KeyError`** — if you set `DATABASE_URL`, the
  API reads the whole schema at boot; check the string in `.env` (or Render → Environment) is the
  correct Postgres URL with a populated schema. Without `DATABASE_URL` it should start on the
  bundled SQLite file.
- **`npm install` fails on Node version** — check `node -v`; Vite 8 needs 20.19+/22.12+.

## Rebuilding data from scratch

Only needed if the raw data changes. Replace `data/raw/DOH-Epi-Dengue-2022-2026.csv` (columns
`Year, Month, Region, Cases, Deaths`), then re-run the pipeline modules in `src/` to regenerate
everything in `data/processed/`:

```powershell
.venv\Scripts\python -m src.doh_eb_ingest           # canonical DOH-EB file -> monthly series
.venv\Scripts\python -m src.forecast                # Prophet fits + 12-month forecasts, validation folds
.venv\Scripts\python -m src.classify                # month-of-year thresholds, risk + probe classification
.venv\Scripts\python -m src.outbreak                # season-level outbreak flags
.venv\Scripts\python -m src.validate_2025           # prospective check of the 2025 flags (real data)
.venv\Scripts\python -m src.validate_known_epidemic # independent 2019 outbreak check (weekly fixture)
.venv\Scripts\python -m src.db                      # rebuild the relational DB from processed CSVs
```

`src.db` drops and recreates the 9 tables from the processed CSVs in one idempotent transaction —
SQLite when `DATABASE_URL` is unset, PostgreSQL (Supabase/Render) when it is. `data/processed/`
is pipeline output and is never hand-edited; all hand-placed inputs go in `data/raw/`.

## Structure

| Path | Purpose |
|---|---|
| `data/raw/` | DOH Epidemiology Bureau monthly dengue surveillance file (2022–2026) + the legacy weekly 2016–2021 fixture used only by the known-epidemic check |
| `data/processed/` | Cleaned monthly series, forecasts, probes, thresholds, outbreak indicators, validation + SQLite DB |
| `frontend/public/geo/` | PSGC region GeoJSON for the choropleth map |
| `src/` | Pipeline (ingest, forecast, classify, outbreak, validate, db) + FastAPI app (`api.py`) |
| `frontend/` | React + Vite + TanStack Router dashboard (monthly map with outbreak layer, region pages, methodology) |

### Relational database (9 tables)

PostgreSQL via SQLAlchemy — the same schema runs on Supabase (deploy) and SQLite (local).

- `regions` — 19 rows (18 + National `000000000`); population/density/centroid power per-100k
  normalization and map fills; the hub every other table joins on.
- `monthly_observations` — raw reported cases/deaths per region+disease+year+month (56 months).
- `forecasts` — Prophet point/interval output per region+disease+target_date (12-month horizon).
- `risk_thresholds` — p50/p75 per region + calendar month (month-of-year seasonality).
- `risk_classifications` — dated Low/Moderate/High labels from classifying forecasts vs thresholds.
- `outbreak_signals` — per region+season: outbreak flag, triggering rule, season average/P75.
- `validation_metrics` — MAE/RMSE/MAPE + skill vs seasonal-naive per holdout window.
- `walk_forward_folds` — actual vs predicted per held-out month (raw data behind the metrics).
- `pipeline_runs` — provenance: build time, data-through date, version, model, notes.

## Locked scope

- **Disease: dengue only, for this release.** The original proposal covered five illnesses
  (dengue, leptospirosis, influenza-like illness, acute gastroenteritis, heat-related illness).
  Regional forecasting and the choropleth are scoped to dengue only because it's the only disease
  with a usable regional-breakdown dataset (DOH Epidemiology Bureau monthly export); the other four
  are **deferred**, not implemented — no national-level fallback is wired in either. The pipeline
  and schema aren't disease-locked, so adding another disease later is an extension, not a rewrite,
  but it isn't scheduled work right now.
- Prediction: Prophet only (monthly, `freq="MS"`)
- Risk classes: percentile thresholds (&lt; 50 Low, 50–75 Moderate, &gt; 75 High) per region-month and
  per region-calendar-month (month-of-year P75 alert line)
- Outbreak indicator: Rule A (≥ 3 consecutive High **months** in the 3-month probe window) or
  Rule B (upcoming season forecast average > seasonal P75); locked without tuning after 2025
  prospective validation — precision 0.43, recall 0.68, F1 0.53 across the 18 regions
  (13 true positives, 17 false positives, 6 false negatives)
- Rules: deterministic post-processing only (non-negativity clipping, dry/wet season regressor)
- Training data: 56 observed months (2022-01…2026-08); holdout windows `last_12m` and
  `2025_prospective` (fits through 2024-12-31); known-epidemic cross-check on the 2019 weekly
  fixture (7/7 weeks High)