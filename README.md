# HEALTHWATCH

Regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification.

Forecasting dengue outbreaks per Philippine region (Prophet), classifying weekly risk tiers
(<P50 Low · P50–75 Moderate · >P75 High), publishing a season-level outbreak indicator for the
coming dry (Jan–Mar) and wet (Jul–Sep) windows, served by a FastAPI backend over SQLite and
visualized in a React dashboard with an interactive choropleth map.

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
`data/processed` cleaned outputs, and `healthwatch.db`).

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
- **Frontend shows "Surveillance API unreachable"** — the backend isn't running; start terminal 1
  first, then reload.
- **`npm install` fails on Node version** — check `node -v`; Vite 8 needs 20.19+/22.12+.

## Rebuilding data from scratch

Only needed if the raw data changes. Re-run the pipeline modules in `src/`
(ingest → forecast → classify → outbreak → validate → db) to regenerate everything in
`data/processed/`:

```powershell
.venv\Scripts\python -m src.doh_eb_ingest   # canonical DOH-EB file -> weekly series
.venv\Scripts\python -m src.forecast        # Prophet fits, forecasts, season probes, validation
.venv\Scripts\python -m src.classify        # week + season thresholds, risk + probe classification
.venv\Scripts\python -m src.outbreak        # season-level outbreak flags
.venv\Scripts\python -m src.validate_2025   # prospective check of the 2025 flags (real data)
.venv\Scripts\python -m src.db              # rebuild SQLite from processed CSVs
```

## Structure

| Path | Purpose |
|---|---|
| `data/raw/` | Canonical DOH Epidemiology Bureau weekly dengue surveillance file (UPRI-NOAH open dataset, 2016–2019 + 2022–2025) |
| `data/processed/` | Cleaned weekly series, forecasts, probes, thresholds, outbreak indicators, validation + SQLite DB |
| `frontend/public/geo/` | PSGC region GeoJSON for the choropleth map |
| `src/` | Pipeline (ingest, forecast, classify, outbreak, validate, db) + FastAPI app (`api.py`) |
| `frontend/` | React + Vite + TanStack Router dashboard (map with outbreak layer, region pages, methodology) |

## Locked scope

- **Disease: dengue only, for this release.** The original proposal covered five illnesses
  (dengue, leptospirosis, influenza-like illness, acute gastroenteritis, heat-related illness).
  Regional forecasting and the choropleth are scoped to dengue only because it's the only disease
  with a usable regional-breakdown dataset (DOH Epidemiology Bureau via the UPRI-NOAH open file);
  the other four are **deferred**, not implemented — no national-level fallback is wired in either.
  The pipeline and schema aren't disease-locked, so adding another disease later is an extension,
  not a rewrite, but it isn't scheduled work right now.
- Prediction: Prophet only
- Risk classes: percentile thresholds (<50 Low, 50–75 Moderate, >75 High) per region-week and per
  region-season (dry/wet P75 alert lines)
- Outbreak indicator: Rule A (≥3 consecutive probe weeks High) or Rule B (season forecast average
  > seasonal P75); locked without tuning after prospective 2025 validation — dry-season F1 0.90,
  wet season deliberately recall-first
- Rules: deterministic post-processing only (non-negativity clipping, wet/dry season regressor)
- Training window: every observed week through 2024-12-31; 2020–2021 reporting gap excluded
