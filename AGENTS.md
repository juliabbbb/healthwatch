# AGENTS.md

## Project Overview

Regional time-series analysis system for seasonal illness outbreak prediction (Philippines; dengue + food/waterborne diseases). Backend: FastAPI + SQLAlchemy + PostgreSQL (Postgres-only, no SQLite). Frontend: React + Vite + TanStack Router + Leaflet choropleth. LLM narration layer (Groq) for interpretability.

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

# One-shot data update (raw → processed → Postgres)
powershell -ExecutionPolicy Bypass -File update-data.ps1
```

## Data Pipeline (only if raw data changes)

```powershell
.venv\Scripts\python -m src.fwbd_ingest         # DOH FWD line-lists (ABD/Cholera/Typhoid/Hep A) -> 4 monthly series
.venv\Scripts\python -m src.doh_eb_ingest       # canonical DOH-EB file -> monthly series
.venv\Scripts\python -m src.forecast            # Prophet fits + 12-month forecasts
.venv\Scripts\python -m src.classify            # risk + probe classification
.venv\Scripts\python -m src.rank_escalation     # risk-tier escalation ranking (hotspot priority)
.venv\Scripts\python -m src.outbreak            # season-level outbreak flags
.venv\Scripts\python -m src.validate_2025       # prospective 2025 validation
.venv\Scripts\python -m src.validate_2019_consistency # 2019 consistency check (pool contains the checked months)
.venv\Scripts\python -m src.generate_narratives # pre-generated AI narrative corpus (needs GROQ_API_KEY)
.venv\Scripts\python -m src.db                  # rebuild relational DB from processed CSVs

# LLM narrative fidelity corpus (methodology 3.5.3; live, needs GROQ_API_KEY)
# 152 narratives: 19 series x {ai_insight, analysis, seasonality x5, explain_element}.
.venv\Scripts\python -m src.validate_narratives --skip-live  # dry run (no API calls)
.venv\Scripts\python -m src.validate_narratives              # full live corpus
```

## AI Narrative Corpus

Every AI surface that interprets a **chart or data table** is pre-generated
offline and served from Postgres, so the dashboard needs no provider key at page
load. One shared registry defines the prompts and the deterministic grounding for
each surface (`src/narrative_surfaces.py`), used by both the generator and the
fidelity auditor.

```powershell
.venv\Scripts\python -m src.generate_narratives --dry-run    # plan only, no API calls
.venv\Scripts\python -m src.generate_narratives              # append to narratives.csv (resumable)
.venv\Scripts\python -m src.generate_narratives --force      # ignore the existing corpus
.venv\Scripts\python -m src.generate_narratives --limit 20 --disease Dengue
.venv\Scripts\python -m src.generate_narratives --surface chart_takeaway
```

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
| `report_summary` | exported PDFs — surveillance report and seasonality report |
| `national` | `NationalSnapshot`, one per disease, no per-region split |

Output is `data/processed/narratives.csv`, keyed by
`(region_code, disease, surface, component)`, and `src.db` mirrors it into the
`narratives` table. The API loads it at startup alongside the other modelling
tables and exposes it read-only at `GET /narratives?region=&disease=&surface=`.
The keyable endpoints (`/ai-insight`, `/analysis/seasonality`,
`/analysis/{region}`) read the corpus first and only fall back to a live
provider call when no row exists.

`AiNarrative` (`frontend/src/components/hw/AiNarrative.tsx`) is the shared
corpus-backed renderer. A surface that already ships deterministic prose passes
it as `fallback`, so the static sentence renders **only** when the corpus has no
row — never alongside the generated one. `loadNarrative()` is the imperative
counterpart for the PDF exporters, which are synchronous render functions and
cannot use hooks; it shares the session cache with the mounted components.

AI analysis is **on by default** (`use-ai-analysis-setting.ts`): an absent
localStorage key means enabled, so every data surface attempts a corpus read on
first load. Settings keeps an opt-out. Because the corpus is pre-generated,
being on costs no provider key, no quota and no per-request latency — until the
corpus is generated, surfaces simply render their static fallback.

Grounding is derived from the pipeline's own numbers and passes through the same
deterministic guards as the live path (`_weather_violation`,
`_numeric_violation`). The season-wording rule forbids attributing case levels
to weather, so the `climate` annotation strings in `api.py` are deliberately
lexicon-clean ("national calendar Jun-Nov", not "wet season") — a model that
echoes the annotation verbatim must still pass the guard.

Only model-written text is stored. `_guarded_narrative` swaps in a deterministic
templated sentence when the model breaks a rule; the generator retries with the
rule restated and, if it still fails, writes **no row** for that key rather than
persisting the template. `fallback_fired` is therefore always `false` in a shipped
corpus — a `true` value means a template leaked in and the corpus should be
regenerated with `--force`.

`update-data.ps1` runs generation automatically between the pipeline and `src.db`,
falling back to a dry run when no provider key is present.

`/analysis/explain-element` is the one live surface: its grounding is whatever
the user clicked, so it is unkeyed and cannot be pre-generated.

Static text stays static: formulas, definitions, confidence methodology,
provenance, disclaimers, headers, accessibility strings, and
`InterventionPanel` guidance are never generated. Operational health guidance
in `data.ts` `recommendations()`, `OutbreakBanner`, the PDF intervention tables
and the alert `detail` strings stay rule-based for the same reason — a model
should not author or soften a recommended response. The alert details are also
month-dependent (scrubbed month, crossing month), so they cannot be keyed
per (region, disease) without a row per month.

# Verification studies (analyst-facing; slow, run detached)

```powershell
# Seasonality ablation (configs A/B/C), ~1.4k Prophet fits, ~50 min.
# Launch detached and poll for data/processed/ablation_*.csv:
Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m","src.ablation" -RedirectStandardOutput "ablation_out.log" -RedirectStandardError "ablation_err.log" -WindowStyle Hidden

# Type II climate-type sensitivity (Bicol / Eastern Visayas / Caraga local
# seasons vs national Jun-Nov calendar). Fast, reuses shipped CSVs.
.venv\Scripts\python -m src.sensitivity
```

## Environment Variables

Create `.env` at repo root (git-ignored):

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require
GEMINI_API_KEY=      # Removed — replaced by GROQ_API_KEY
GROQ_API_KEY=        # Required only to (re)generate the offline narrative corpus.
                     # The dashboard serves the stored corpus and needs no key.
GROQ_MODEL=          # Optional Groq model override (default: openai/gpt-oss-120b)
OPENAI_API_KEY=      # Fallback AI provider when Groq rate limits/quotas are reached
OPENAI_MODEL=        # Optional fallback model override (default: gpt-4o-mini)
```

Postgres-only: `DATABASE_URL` is **required** to start the API and is parsed by
`db.py`. The API reads every table from the database at startup (the SQLite
fallback was removed). The schema is auto-created by `db.ensure_tables()` on
startup and rebuilt from the processed CSVs with `.venv\Scripts\python -m src.db`
(which drops/recreates only the 11 pipeline tables plus `narratives`; the
`subscriptions` table was removed with the email-report feature).

The API hot-loads the 8 modelling tables at startup; `dengue_case_records`
and `fwbd_case_records` (the raw 959,823-row line-lists) are **not** part of
that snapshot. Their reported-data breakdowns
(`GET /reported/{region}?disease=&year=&month=`) are grouped in Postgres on
demand by `db.case_breakdown()` — totals are guaranteed to equal the monthly
reported series (`month` bucket: dengue = same Thursday epi-week rule, FWD =
the files' explicit Morbidity Month).

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
- `data/raw/` — canonical DOH dengue case line-list CSV (2019-2026, 749,683 rows) plus the four DOH FWD line-lists (2018-2026, 210,140 rows)
- `data/processed/` — pipeline output CSVs (checkpoints; mirrored into Postgres by `src.db`)
- `frontend/public/geo/` — PSGC region GeoJSON for choropleth

## Key Constraints

- **Disease: dengue + four FWD diseases** (Acute Bloody Diarrhea, Cholera, Typhoid Fever, Acute Viral Hepatitis), each run fully independently (own forecast/risk tiers/outbreak/escalation); `disease_group: Food and Waterborne Diseases` is a presentation tag for UI grouping only.
- **Prediction: Prophet only** (monthly, `freq="MS"`).
- **National series is derived** (sum of 18 regions) per disease, never raw.
- **Data ships in repo** — the pipeline runs offline from `data/raw` and writes
  `data/processed`; a DB rebuild (`-m src.db`) pushes those artifacts to
  Postgres. The API itself is Postgres-only and requires `DATABASE_URL`.

## Testing / Validation

No formal test suite. Validation scripts are run manually:
- `src.validate_2025` — prospective check of 2025 outbreak flags
- `src.validate_2019_consistency` — 2019 consistency check (production monthly rule on real line-list rows; the pool contains the checked months, so it is not an independent validation)

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
