# System Requirements — HealthWatch

> Regional dengue outbreak prediction dashboard.
> Backend: FastAPI + SQLAlchemy + PostgreSQL. Frontend: React 19 + TanStack Start (SSR) + Vite 8 + Leaflet.
> ML layer: Facebook Prophet (local training only). LLM narration: Gemini / Groq. Email: Resend.

---

## 1. Runtime Platforms

| Component | Localhost | Render (Production) |
|---|---|---|
| Backend API | Uvicorn on `localhost:8000` | `web` service, free tier, Python runtime |
| Frontend (SSR) | Vite dev server (`localhost:3000`) | `web` service, free tier, Node runtime |
| Database | SQLite fallback (`data/processed/healthwatch.db`) | Supabase PostgreSQL (external) |
| Subscriptions | Local SQLite (`data/subscriptions.sqlite3`) | Ephemeral SQLite (best-effort on free tier) |

---

## 2. Operating System

| Requirement | Detail |
|---|---|
| **Localhost** | Windows 10/11 (x64), macOS 12+, or Linux (Ubuntu 20.04+) |
| **Render** | Managed Linux containers (Alpine-based); no user OS choice |
| **Shell** | PowerShell 5.1+ (Windows), Bash/zsh (Unix) for dev scripts |

---

## 3. CPU

| Scenario | Minimum | Recommended |
|---|---|---|
| **Frontend dev** (Vite HMR, no build) | 2 cores | 4+ cores |
| **Frontend production build** (`vite build`) | 2 cores | 4+ cores (build takes ~30-60s on 2-core) |
| **Backend API** (serves pre-loaded DataFrames) | 1 core | 2+ cores |
| **Full ML pipeline** (Prophet fits, 18 regions × walk-forward) | 4 cores | 8+ cores (Prophet is CPU-bound during MCMC) |
| **Render free tier** | 1 shared vCPU | N/A (fixed by plan) |

> **Note:** The ML pipeline (`src.forecast`) fits 18 Prophet models with walk-forward refitting every month. This is the most CPU-intensive operation. On a 4-core laptop a full fit takes ~5-10 minutes. On Render free tier (shared vCPU) this would be much slower, which is why the pipeline is **local-only** and the API serves pre-computed results.

---

## 4. Memory (RAM)

| Scenario | Minimum | Recommended |
|---|---|---|
| **Frontend dev** (Vite + browser) | 2 GB | 4+ GB |
| **Frontend production build** | 2 GB | 4 GB |
| **Backend API** (at startup, loads all DataFrames) | 512 MB | 1 GB |
| **Full ML pipeline** (Prophet + pandas + numpy) | 4 GB | 8+ GB |
| **Combined dev** (frontend + backend + browser) | 6 GB | 16 GB |
| **Render free tier** | 512 MB (fixed) | N/A |

### Memory Breakdown

| Component | Approximate Footprint |
|---|---|
| FastAPI + Uvicorn (idle) | ~80 MB |
| Pandas DataFrames (all tables loaded at startup) | ~50-100 MB (total data < 500 KB; overhead is pandas/numpy) |
| Prophet model (per region) | ~100-200 MB during fit |
| 18 concurrent Prophet fits (walk-forward) | ~2-3 GB peak |
| Vite dev server | ~200-400 MB |
| Browser (dashboard with Leaflet map + Recharts) | ~300-800 MB |
| Node SSR build process | ~500 MB - 1 GB |

---

## 5. Disk Space

| Item | Size |
|---|---|
| Repository (source, excl. `.git`, `.venv`, `node_modules`) | ~5.3 MB |
| Raw data CSVs + Excel (`data/raw/`) | ~2.9 MB |
| Processed data CSVs (`data/processed/`) | ~1.2 MB |
| SQLite DB (`data/processed/healthwatch.db`) | ~740 KB |
| GeoJSON (`frontend/public/geo/`) | ~211 KB |
| Python venv + dependencies (`.venv/`) | ~800 MB - 1.2 GB |
| Node `node_modules/` | ~300-500 MB |
| Frontend build output (`.output/`) | ~9 MB |
| **Total for full local setup** | **~2-3 GB** |
| **Render deploy (API)** | ~200 MB (no ML deps, no raw data) |
| **Render deploy (Frontend)** | ~50 MB (built `.output/` only) |

---

## 6. Node.js

| Requirement | Detail |
|---|---|
| **Minimum version** | 20.19+ or 22.12+ (Vite 8 requirement) |
| **Recommended** | Node 22 LTS (latest stable) |
| **Package manager** | npm (bundled with Node) |
| **Render runtime** | Node (managed by Render blueprint) |

### Key Frontend Dependencies

| Package | Purpose |
|---|---|
| React 19.2 | UI framework |
| TanStack Start 1.168 | SSR framework (Node-server preset) |
| TanStack Router 1.170 | Client-side routing |
| Vite 8.1.5 | Build tool / dev server |
| Tailwind CSS 4.2 | Utility CSS |
| Leaflet 1.9 | Choropleth map |
| Recharts 2.15 | Charts (line, bar, area) |
| Radix UI (28+ primitives) | Accessible UI components |
| @react-pdf/renderer 4.9 | PDF export |
| html2canvas 1.4 | Screenshot / PDF capture |
| Zod 3.24 | Schema validation |

---

## 7. Python

| Requirement | Detail |
|---|---|
| **Minimum version** | 3.10 (for `match` statements, type hints) |
| **Recommended** | 3.11 or 3.12 |
| **Virtual environment** | Required (`.venv/` at repo root) |

### Backend Runtime Dependencies (`requirements.txt`)

| Package | Purpose | Approx Install Size |
|---|---|---|
| pandas | DataFrame operations | ~30 MB |
| numpy | Numerical computation | ~15 MB |
| openpyxl | Excel file reading (raw data ingestion) | ~5 MB |
| fastapi | HTTP API framework | ~2 MB |
| uvicorn | ASGI server | ~2 MB |
| groq ≥ 0.9.0 | LLM narration (Groq API client) | ~2 MB |
| sqlalchemy | ORM / database layer | ~5 MB |
| psycopg2-binary | PostgreSQL adapter | ~5 MB |
| resend | Transactional email | ~1 MB |

### ML Pipeline Dependencies (`requirements-ml.txt` — local only)

| Package | Purpose | Approx Install Size |
|---|---|---|
| prophet | Time-series forecasting (Facebook/Meta) | ~200 MB |
| cmdstanpy | Stan backend for Prophet | ~300 MB |
| cmdstan | Stan compiler (bundled with cmdstanpy) | ~200 MB |

> **Important:** `requirements-ml.txt` includes `requirements.txt` via `-r`. These packages are **not** installed on Render — the API serves pre-computed forecasts only.

### Key Python Versions in Backend (`src/`)

| Module | Purpose |
|---|---|
| `api.py` | FastAPI app (1,249 lines); loads all data into memory at startup |
| `db.py` | SQLAlchemy schema + PostgreSQL connection (pool_size=5, max_overflow=10) |
| `forecast.py` | Prophet monthly fits (12-month horizon, walk-forward validation) |
| `classify.py` | Risk tier classification (Low / Moderate / High) |
| `outbreak.py` | Season-level outbreak flag detection |
| `ingest.py` | Raw CSV/Excel → monthly series |
| `doh_eb_ingest.py` | DOH-Epi Bureau specific ingestion |
| `email_report.py` | Monthly forecast report (HTML render + Resend delivery) |
| `subscription_store.py` | Anonymous email subscription store (SQLite) |
| `validate_2025.py` | Prospective 2025 validation |
| `validate_known_epidemic.py` | Independent 2019 outbreak check |

---

## 8. Database

| Requirement | Localhost | Render (Production) |
|---|---|---|
| **Engine** | SQLite (fallback, no config needed) | PostgreSQL (Supabase) |
| **Connection** | File: `data/processed/healthwatch.db` | `DATABASE_URL` env var (sslmode=require) |
| **Pool size** | N/A (SQLite, single connection) | pool_size=5, max_overflow=10 |
| **Pool recycle** | N/A | 300 seconds |
| **Tables** | 9 tables (same schema) | 9 tables |
| **Schema rebuild** | `python -m src.db` (idempotent, drop+recreate) | Same command, points to Postgres |
| **Subscriptions store** | Separate SQLite: `data/subscriptions.sqlite3` | Ephemeral SQLite on Render free tier |

### Database Tables

1. `regions` — 18 Philippine regions + national aggregate
2. `monthly_observations` — case counts by region/month
3. `forecasts` — Prophet 12-month forecasts
4. `risk_thresholds` — P50/P75 percentile thresholds
5. `risk_classifications` — Low/Moderate/High tier assignments
6. `outbreak_signals` — season-level outbreak flags
7. `validation_metrics` — MAE/RMSE/MAPE per region
8. `walk_forward_folds` — monthly actual vs predicted
9. `pipeline_runs` — run metadata / lineage

---

## 9. Network & API Keys

| Service | Key Required | Source | Free Tier |
|---|---|---|---|
| **Gemini** (primary LLM) | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) | Yes (generous) |
| **Groq** (fallback LLM) | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | Yes (no card) |
| **Supabase** (PostgreSQL) | `DATABASE_URL` | [supabase.com](https://supabase.com) | Yes (500 MB) |
| **Resend** (email delivery) | `RESEND_API_KEY` | [resend.com](https://resend.com) | Yes (100/day) |
| **CARTO** (basemap tiles) | `VITE_CARTO_API_KEY` | [carto.com](https://carto.com) | Yes (watermark removal) |

### CORS Configuration

| Origin | Allowed |
|---|---|
| `http://localhost:3000` | Yes (dev) |
| `http://localhost:5173` | Yes (Vite default) |
| `https://healthwatch-ui.onrender.com` | Yes (production) |
| Custom | Via `ALLOWED_ORIGINS` env var (comma-separated) |

---

## 10. Ports

| Service | Default Port | Notes |
|---|---|---|
| Backend API (uvicorn) | 8000 | `--host 0.0.0.0 --port 8000` |
| Frontend dev (Vite) | 3000 | TanStack Start default |
| Frontend production (Node) | Render-assigned `$PORT` | Node HTTP server (`.output/server/index.mjs`) |

---

## 11. Environment Variables

### Backend (`.env` at repo root)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes (prod) | SQLite fallback | PostgreSQL connection string |
| `GEMINI_API_KEY` | No | None | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-3.6-flash` | Primary Gemini model |
| `GEMINI_FALLBACK_MODELS` | No | `gemini-3.5-flash-lite,...` | Comma-separated fallback chain |
| `GROQ_API_KEY` | No | None | Groq API key (used if no Gemini) |
| `RESEND_API_KEY` | No | None | Resend email API key |
| `RESEND_FROM` | No | `HealthWatch <onboarding@resend.dev>` | Sender address |
| `APP_URL` | No | `https://healthwatch-ui.onrender.com` | Base URL for email CTAs |
| `SUBSCRIPTIONS_DB` | No | `data/subscriptions.sqlite3` | Subscription store path |
| `JOB_TOKEN` | No | None | Secret for POST `/subscriptions/send-due` |
| `ALLOWED_ORIGINS` | No | localhost + `*.onrender.com` | CORS origins |
| `DISABLE_SUBSCRIPTION_SCHEDULER` | No | Unset | Set `1` to disable in-process sender |

### Frontend (`frontend/.env.*`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | Yes | `http://localhost:8000` | Backend API base URL |
| `VITE_CARTO_API_KEY` | No | None | CARTO basemap API key |

---

## 12. Render Deployment (Free Tier)

### API Service (`healthwatch-api-xepv`)

| Spec | Value |
|---|---|
| Runtime | Python |
| Plan | Free (512 MB RAM, 1 shared vCPU) |
| Build | `pip install -r requirements.txt` |
| Start | `uvicorn src.api:app --host 0.0.0.0 --port $PORT` |
| Cold start | ~30-60s (loads all DataFrames into memory) |
| Sleep | After 15 min inactivity; wakes on request (~30s) |

### Frontend Service (`healthwatch-ui`)

| Spec | Value |
|---|---|
| Runtime | Node |
| Plan | Free (512 MB RAM, 1 shared vCPU) |
| Build | `npm ci && npm run build` |
| Start | `node .output/server/index.mjs` |
| Output | TanStack Start SSR → Node HTTP server |

### Free Tier Limitations

- **512 MB RAM** per service (API + Frontend separate)
- **Shared 1 vCPU** (burst only)
- **No persistent disk** — subscription SQLite resets on redeploy
- **Sleeps after 15 min** — first request after sleep takes ~30s
- **No cron jobs** — use external cron (e.g., cron-job.org) to POST `/subscriptions/send-due`

---

## 13. Data Pipeline Requirements (Local Only)

The ML pipeline is **never run on Render**. It runs locally and produces CSVs that are committed to the repo.

### Pipeline Steps

| Step | Command | CPU Impact | RAM Impact |
|---|---|---|---|
| 1. Ingest | `python -m src.doh_eb_ingest` | Low | Low (~200 MB) |
| 2. Forecast | `python -m src.forecast` | **High** (18 Prophet fits) | **High** (~2-3 GB peak) |
| 3. Classify | `python -m src.classify` | Low | Low (~200 MB) |
| 4. Outbreak | `python -m src.outbreak` | Low | Low |
| 5. Rebuild DB | `python -m src.db` | Low | Low (~200 MB) |
| 6. Validate | `python -m src.validate_2025` | Medium | Medium |
| 7. Validate (epidemic) | `python -m src.validate_known_epidemic` | Medium | Medium |

### Prophet Fit Details

- **18 regions** × walk-forward validation (refit every month)
- ~55 observed months per region (3 full yearly cycles)
- 12-month production forecast horizon
- Wet-season regressor included
- CMDStan backend (C++ compiler required via cmdstanpy)

---

## 14. Browser Requirements (Frontend)

| Requirement | Detail |
|---|---|
| **Minimum** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ |
| **JavaScript** | ES2022 target (top-level await, private fields) |
| **Features** | CSS Grid, CSS Custom Properties, `Intl.DateTimeFormat`, `ResizeObserver` |
| **Leaflet** | Tile rendering (CARTO basemap) — requires network |
| **PDF export** | @react-pdf/renderer (client-side) — memory-intensive for large reports |
| **Recommended resolution** | 1280×720+ (responsive, mobile-friendly via BottomSheet) |

---

## 15. Development Tools

| Tool | Version | Purpose |
|---|---|---|
| Git | 2.30+ | Version control |
| Node.js | 20.19+ / 22.12+ | Frontend runtime |
| Python | 3.10+ (3.11/3.12 recommended) | Backend + ML |
| pip | Latest | Python package manager |
| npm | Bundled with Node | Frontend package manager |
| VS Code | Latest (recommended) | IDE |
| ESLint | 9.32+ (via package.json) | Frontend linting |
| Prettier | 3.7+ (via package.json) | Code formatting |

---

## 16. Quick-Start Checklist

### Localhost Setup

```
[  ] Git 2.30+ installed
[  ] Python 3.10+ installed (.venv created)
[  ] Node.js 20.19+ installed
[  ] .env file created with DATABASE_URL (or accept SQLite fallback)
[  ] pip install -r requirements.txt (backend)
[  ] npm install (frontend/)
[  ] Backend running: uvicorn src.api:app --port 8000
[  ] Frontend running: npm run dev (frontend/)
[  ] Browser open at http://localhost:3000
```

### Render Deploy Checklist

```
[  ] Supabase PostgreSQL provisioned, DATABASE_URL set in Render env
[  ] GROQ_API_KEY or GEMINI_API_KEY set in Render env
[  ] render.yaml blueprint deployed (API + Frontend services)
[  ] CORS: ALLOWED_ORIGINS includes frontend URL
[  ] External cron job configured for /subscriptions/send-due (optional)
[  ] Pipeline CSVs committed to repo (data is in-repo, no pipeline run needed)
```

---

## 17. Performance Characteristics

| Metric | Value |
|---|---|
| API cold start (data load) | ~2-5 seconds |
| API response time (warm) | < 100ms (in-memory DataFrames) |
| Frontend initial load (prod) | ~1-3 seconds (SSR + hydration) |
| Frontend HMR (dev) | < 200ms |
| Map render (Leaflet choropleth) | < 500ms (18 regions) |
| Full pipeline run (local) | ~5-15 minutes (Prophet-dominated) |
| DB rebuild | ~10-30 seconds |
| Render cold start (API) | ~30-60 seconds |
| Render cold start (Frontend) | ~15-30 seconds |

---

## 18. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Render free tier sleeps after 15 min | ~30s cold start on first request | External keep-alive ping or upgrade plan |
| Render free tier: no persistent disk | Subscriptions lost on redeploy | Set `SUBSCRIPTIONS_DB` to external volume |
| SQLite fallback (no DATABASE_URL) | Single-writer, no concurrent access | Sufficient for single-user dev |
| Prophet fit is CPU-bound | ~5-15 min for full pipeline | Run locally only, not on Render |
| ML deps not on Render | Can't retrain on server | Pre-computed CSVs committed to repo |
| Node SSR requires Node 20.19+ | Older Node versions fail | Render managed runtime handles this |
