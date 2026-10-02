# HEALTHWATCH

Regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification.

Forecasting dengue outbreaks per Philippine region (Prophet, monthly), classifying risk tiers
(&lt; P50 Low · P50–75 Moderate · &gt; P75 High) per region-month, publishing a season-level outbreak
indicator for the upcoming dry (Dec–May) and wet (Jun–Nov) windows, served by a FastAPI backend
over a PostgreSQL database (Supabase; Postgres-only, no SQLite) and visualized in a React dashboard
with an interactive choropleth map.

Canonical source is the DOH dengue case line-list, aggregated from morbidity weeks to calendar
months (2019-01 … 2026-08, 92 months), covering all 18 Philippine regions including NIR. The National
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

The pipeline itself runs offline from the repo data — `data/raw` holds the canonical source file,
`data/processed` the cleaned outputs. The API serves from PostgreSQL (Postgres-only): the processed
artifacts are mirrored into the relational schema with `python -m src.db`, so `DATABASE_URL` is
required to start the backend.

### Database (required)

Create a repo-root `.env` (git-ignored) with the SaaS/cloud connection string — the API will not
start without it (no SQLite fallback):

```powershell
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
```

The backend (`src/db.py`) parses `.env` itself and always prefers an environment variable already
set in the shell. On Render, set `DATABASE_URL` in the service's environment. After first setup,
populate the schema once: `.venv\Scripts\python -m src.db` (or let `db.ensure_tables()` bootstrap
empty tables at startup — but without a rebuild the API has no rows).

### Environment variables

| Variable | Needed for | Default |
|---|---|---|
| `DATABASE_URL` | **Required** — Postgres connection string; the API will not boot without it | — |
| `ALLOWED_ORIGINS` | Extra CORS origins (comma-separated) | `localhost` + `*.onrender.com` |
| `GROQ_API_KEY` | Only to (re)generate the offline narrative corpus. The dashboard serves the stored corpus and needs no key | — |
| `GROQ_MODEL` | Groq model override | `openai/gpt-oss-120b` |
| `OPENAI_API_KEY` | Fallback provider when Groq rate-limits/quotas are reached | — |
| `OPENAI_MODEL` | Fallback model override | `gpt-4o-mini` |

See `.env.example`. `src/db.py` parses a repo-root `.env` itself and always prefers an
environment variable already set in the shell.

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
- **Backend dies at startup with `OperationalError`/`KeyError`** — the API reads the whole schema
  from Postgres at boot; check the `DATABASE_URL` string in `.env` (or Render → Environment) is the
  correct Postgres URL and the schema is populated (`python -m src.db`). There is no SQLite
  fallback anymore.
- **`npm install` fails on Node version** — check `node -v`; Vite 8 needs 20.19+/22.12+.
- **Cold start is slow** — the backend hot-loads every modelling table into memory at process
  startup. `/health` returns `data_ready:false` until it finishes; fast after.
- **A key set with `setx` isn't visible in an already-open shell** — `run-dev.ps1` reads
  user-scope environment variables and re-exports them, so it works in a shell opened before
  `setx` ran.
- **Deploying to Render** — the API installs `requirements.txt` and the frontend
  `npm ci && npm run build`; `DATABASE_URL`, `ALLOWED_ORIGINS`, `GROQ_API_KEY` and
  `OPENAI_API_KEY` are service env vars (`sync: false` in `render.yaml`). The ML pipeline never
  runs on Render — `requirements-ml.txt` is local-only.
- **There is no automated test suite** — correctness is checked by running the pipeline
  validation steps above and inspecting `data/processed/`.

## Updating / rebuilding data

One-shot: drop the updated export in `data/raw/`, then run the whole pipeline and sync to Postgres:

```powershell
powershell -ExecutionPolicy Bypass -File update-data.ps1
```

This runs ingest → forecast → classify → outbreak → 2025 validation → 2019 epidemic check, then
mirrors `data/processed/` into PostgreSQL via `src.db` (the only step that touches the DB — it
requires `DATABASE_URL` in `.env`, so the dashboard will keep serving the *old* numbers until that
last step succeeds). Each step is checked; any failure stops the run so Postgres is never
half-synced.

Or run the steps manually (only needed if the raw data changes). Replace
`data/raw/DOH-Epi-Dengue-2019-2026-line-list.csv` (case line-list: `Year, Morbidity Week, Region, Province, ...,
No. of Cases, No. of Deaths`), then
re-run the pipeline modules in `src/` to regenerate everything in `data/processed/`:

```powershell
.venv\Scripts\python -m src.fwbd_ingest         # DOH FWD line-lists (ABD/Cholera/Typhoid/Hep A) -> 4 monthly series
.venv\Scripts\python -m src.doh_eb_ingest       # canonical DOH-EB file -> monthly series
.venv\Scripts\python -m src.forecast            # Prophet fits + 12-month forecasts, validation folds
.venv\Scripts\python -m src.classify            # month-of-year thresholds, risk + probe classification
.venv\Scripts\python -m src.rank_escalation     # risk-tier escalation ranking (hotspot priority)
.venv\Scripts\python -m src.outbreak            # season-level outbreak flags
.venv\Scripts\python -m src.validate_2025       # prospective check of the 2025 flags (real data)
.venv\Scripts\python -m src.validate_known_epidemic # independent 2019 outbreak check (line-list 2019 monthly cross-check)
.venv\Scripts\python -m src.db                  # mirrors processed CSVs into PostgreSQL (required)
```

`src.db` drops and recreates the 11 pipeline tables from the processed CSVs in one idempotent
transaction against PostgreSQL (requires `DATABASE_URL`). `data/processed/` is pipeline output and is never hand-edited; all
hand-placed inputs go in `data/raw/`. Commit the regenerated `data/processed/*.csv` to version the
new artifacts.

## AI narrative corpus

Every AI surface that interprets a chart or data table is generated **offline** and served
from Postgres, so the dashboard needs no provider key at page load.
`src/generate_narratives.py` writes `data/processed/narratives.csv`, keyed by
`(region_code, disease, surface, component)`; `src.db` mirrors it into the `narratives`
table and the API exposes it read-only at `GET /narratives`. The keyable endpoints
(`/ai-insight`, `/analysis/seasonality`, `/analysis/{region}`) read the corpus first and fall
back to a live provider call only when no row exists.

Nine surfaces, all per (region, disease) unless noted:

| surface | renders on |
|---|---|
| `ai_insight` | map-panel one-liner (`AiInsightLine`) |
| `analysis` | regional analysis panel |
| `chart_takeaway` | Seasonality — `observed`/`trend`/`seasonal`/`residual`/`acf` |
| `compare` | Compare page, region vs national |
| `reported` | reported-case breakdown (age/sex split) |
| `kpi_takeaway` | `ForecastCard` KPI strip (headline figure, thresholds, direction) |
| `escalation` | `HotspotTimeline` (12-month tier-climb ordering) |
| `report_summary` | exported PDFs — surveillance and seasonality reports |
| `national` | `NationalSnapshot`, one per disease, no per-region split |

```powershell
.venv\Scripts\python -m src.generate_narratives --dry-run    # plan only, no API calls
.venv\Scripts\python -m src.generate_narratives              # append to narratives.csv (resumable)
.venv\Scripts\python -m src.generate_narratives --force      # ignore the existing corpus
.venv\Scripts\python -m src.generate_narratives --limit 20 --disease Dengue
.venv\Scripts\python -m src.generate_narratives --surface chart_takeaway
```

`update-data.ps1` runs this automatically between the pipeline and `src.db`, falling back to a
dry run when no provider key is present.

**Contract.** AI analysis is **on by default** (`use-ai-analysis-setting.ts`: an absent
`localStorage` key means enabled), with an opt-out in Settings. Because the corpus is
pre-generated, being on costs no provider key, no quota and no per-request latency — until the
corpus is generated, surfaces simply render their static fallback. Grounding is derived from
the pipeline's own numbers and passes the same deterministic guards as the live path
(`_weather_violation`, `_numeric_violation`). Only model-written text is stored: when the model
breaks a rule the generator retries with the rule restated, and if it still fails it writes
**no row** for that key rather than persisting a template. `fallback_fired` is therefore always
`false` in a shipped corpus — a `true` value means a template leaked in and the corpus should
be regenerated with `--force`.

`/analysis/explain-element` is the one live surface: its grounding is whatever the user
clicked, so it is unkeyed and cannot be pre-generated.

**Static text stays static.** Formulas, definitions, confidence methodology, provenance,
disclaimers, headers, accessibility strings and `InterventionPanel` guidance are never
generated. Operational health guidance in `data.ts` `recommendations()`, `OutbreakBanner`, the
PDF intervention tables and the alert `detail` strings stay rule-based — a model should not
author or soften a recommended response.

## Verification studies

Analyst-facing and slow; run detached rather than in the foreground.

```powershell
# Seasonality ablation (configs A/B/C), ~1.4k Prophet fits, ~50 min
Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m","src.ablation" -RedirectStandardOutput "ablation_out.log" -RedirectStandardError "ablation_err.log" -WindowStyle Hidden

# Type II climate-type sensitivity (Bicol / Eastern Visayas / Caraga local seasons)
.venv\Scripts\python -m src.sensitivity
```

## Structure

| Path | Purpose |
|---|---|
| `data/raw/` | DOH dengue case line-list (2019–2026), aggregated monthly by the pipeline |
| `data/processed/` | Cleaned monthly series, forecasts, probes, thresholds, outbreak indicators, validation (checkpoints — mirrored into Postgres by `src.db`) |
| `frontend/public/geo/` | PSGC region GeoJSON for the choropleth map |
| `src/` | Pipeline (ingest, forecast, classify, outbreak, validate, db) + FastAPI app (`api.py`) |
| `frontend/` | React + Vite + TanStack Router dashboard (monthly map with outbreak layer, region pages, methodology) |

## System Diagram
https://mermaid.ai/d/607a617f-271b-4e42-b4d3-380c41741d1d


### Relational database (12 tables)

PostgreSQL via SQLAlchemy — Postgres-only, on Supabase (deploy) or any Postgres server.

- `regions` — 19 rows (18 + National `000000000`); population/density/centroid power per-100k
  normalization and map fills; the hub every other table joins on.
- `monthly_observations` — raw reported cases/deaths per region+disease+year+month (dengue 2019-2026; four FWD diseases 2018-2026).
- `forecasts` — Prophet point/interval output per region+disease+target_date (12-month horizon).
- `risk_thresholds` — p50/p75 per region + calendar month (month-of-year seasonality).
- `risk_classifications` — dated Low/Moderate/High labels from classifying forecasts vs thresholds.
- `outbreak_signals` — per region+season: outbreak flag, triggering rule, season average/P75.
- `validation_metrics` — MAE/RMSE/MAPE + skill vs seasonal-naive per holdout window.
- `walk_forward_folds` — actual vs predicted per held-out month (raw data behind the metrics).
- `risk_escalation` — regional ranking by upward tier-climbs across the forecast horizon.
- `outbreak_validation` — 2025 prospective season flags vs observed (per-row tp/fp/fn/tn).
- `pipeline_runs` — provenance: build time, data-through date, version, model, notes.

## Contributing

This project is connected to [Lovable](https://lovable.dev) via
`frontend/.lovable/project.json` and the `@lovable.dev/vite-tanstack-config` build preset.
Commits pushed to the connected branch sync back to Lovable and appear in the editor.

> **Do not rewrite published git history** — no force-pushing, rebasing, or amending already-pushed
> commits. That rewrites history on Lovable's side and can lose project history. Keep the branch in
> a working state.

## Locked scope

- **Disease: dengue + four food/waterborne diseases** (Acute Bloody Diarrhea, Cholera, Typhoid Fever,
  Acute Viral Hepatitis) from the DOH FWD line-lists; each runs its own forecast, risk tiers, outbreak
  flags and escalation ranking. The FWD group tag is presentation-only. Other notifiable illnesses
  (e.g., leptospirosis, ILI) are out of scope until their regional datasets are available; the pipeline
  and schema stay disease-agnostic, so adding one is an extension, not a rewrite.
- Prediction: Prophet only (monthly, `freq="MS"`)
- Risk classes: percentile thresholds (&lt; 50 Low, 50–75 Moderate, &gt; 75 High) per region-month and
  per region-calendar-month (month-of-year P75 alert line)
- Outbreak indicator: Rule A (≥ 3 consecutive High **months** in the 3-month probe window) or
  Rule B (upcoming season forecast average > seasonal P75); locked without tuning after 2025
  prospective validation — precision 0.316, recall 0.300, F1 0.308 across all 38 rows
  (6 true positives, 13 false positives, 14 false negatives, 5 true negatives)
- Rules: deterministic post-processing only (non-negativity clipping, dry/wet season regressor)
- Training data: 92 observed months (2019-01…2026-08); holdout windows `last_12m` and
  `2025_prospective` (fits through 2024-12-31); known-epidemic cross-check on the 2019 weekly
  fixture (7/7 weeks High) plus a line-list 2019 monthly cross-check (Aug-Oct 2019 High)
