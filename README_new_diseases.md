# New Disease Sources — Branch `UI-gerald`

This branch expands HealthWatch from 5 diseases (Dengue + 4 FWBD) to 8 diseases
by adding three new DOH surveillance sources. The existing pipeline and
production Prophet forecasts are **unchanged**.

## New Diseases

| Disease | Source | Type | Monthly Series | Forecast |
|---|---|---|---|---|
| Leptospirosis | DOH leptospirosis case line-list (2019-2026) | Zoonotic | ✅ 18 regions, 92 months | ❌ Pending model evaluation |
| Influenza-like Illness (ILI) | DOH ILI sentinel surveillance (2019-2026) | Respiratory | ✅ 18 regions, 92 months | ❌ Pending model evaluation |
| Heat-Related Illness | DOH heat-related illness reports | Environmental | ❌ Annual aggregates only | ❌ Reference-only |

## Running the Preprocessors

```powershell
# From repo root, with .venv activated
.venv\Scripts\python -m src.ili_ingest
.venv\Scripts\python -m src.leptospirosis_ingest
.venv\Scripts\python -m src.heat_ingest

# Rebuild the database (local SQLite or Postgres)
.venv\Scripts\python -m src.db
```

## Data Schema Decisions

### Leptospirosis Dual-Layout Handling

The DOH leptospirosis CSV has two distinct layouts across years:

- **2023**: `Case Classification` column populated (S/P/C codes), `Cases` column is numeric count.
- **Other years (2019-2022, 2024-2026)**: `Cases` column holds S/P/C classification codes; the 10th column (labeled `Deaths`) actually contains the numeric case count. Deaths are only reliably separable for 2023.

The preprocessor (`src/leptospirosis_ingest.py`) handles both layouts automatically, extracting the correct numeric case count from each year's layout.

### ILI Header Inversion

The DOH ILI CSV has swapped headers:
- Column labeled `Year` actually contains week numbers (1-53)
- Column labeled `Morbidity Week` actually contains year values (2018-2026)

The preprocessor (`src/ili_ingest.py`) corrects this by swapping the columns before processing. The epi-week Thursday rule is applied for date alignment with the dengue series.

### Heat-Related Illness — Reference Only

The heat data consists of 43 annual aggregate rows across 13 regions (2019 and 2023-2026). There is no monthly or weekly time series, making it unsuitable for Prophet forecasting. It is loaded via `GET /reference/heat-events` and displayed as reference information only, not included in the shared calendar or "All Illnesses" aggregate.

## Output Files

### New Processed CSVs

| File | Rows | Description |
|---|---|---|
| `data/processed/regional_ili_monthly.csv` | 1,656 | 18 regions × 92 months |
| `data/processed/national_ili_monthly.csv` | 92 | National (sum of 18 regions) |
| `data/processed/regional_leptospirosis_monthly.csv` | 1,656 | 18 regions × 92 months |
| `data/processed/national_leptospirosis_monthly.csv` | 92 | National (sum of 18 regions) |
| `data/processed/heat_reference_events.csv` | 43 | Annual aggregates |

### Existing Files (Unchanged)

All existing processed CSVs, forecasts, risk classifications, and outbreak indicators are untouched.

## API Changes

| Endpoint | Change |
|---|---|
| `GET /diseases` | **New** — returns all 8 disease metadata, groups, forecast-ready list |
| `GET /dashboard?disease=Leptospirosis` | Returns historical series; `forecast_available: false` |
| `GET /dashboard?disease=Influenza-like%20Illness` | Returns historical series; `forecast_available: false` |
| `GET /forecast/{disease}` | Returns structured unavailable response for non-forecast diseases |
| `GET /risk-classification/{disease}` | Same pattern |
| `GET /reference/heat-events` | **New** — returns 43 heat reference rows |

## Frontend Changes

- `data.ts`: Extended `Illness` interface with `forecastAvailable` and `unavailableReason` fields; 3 new disease entries; 3 new disease groups; updated data loader to skip forecast/outbreak for non-forecast diseases.
- `ForecastCard.tsx`: Added "Historical Data Only" info banner for non-forecast diseases; forecast sections (KPI strip, sparkline, model validation, outbreak alert) are hidden; disease-specific community health guides for Lepto, ILI, and Heat.

## Blocked / Pending

- **Prophet forecasts** for Leptospirosis and ILI are blocked pending comparative model evaluation. The eligibility guard in `src/forecast.py` ensures they are skipped automatically.
- **Heat-Related Illness** forecasting is permanently blocked (no monthly time series).
- **Coordinate canonical disease names** with the research/evaluation team before merging to main.

## Files Changed

```
src/api.py                  — disease metadata, forecast guards, new endpoints
src/config.py               — DISEASE_METADATA, SUPPORTED_DISEASES, FORECAST_READY_DISEASES
src/forecast.py             — eligibility skip guard
src/ingest.py               — MONTHLY_FILES extended
src/ili_ingest.py           — NEW preprocessor
src/leptospirosis_ingest.py — NEW preprocessor
src/heat_ingest.py          — NEW preprocessor
frontend/src/lib/healthwatch/data.ts     — extended types, entries, loader
frontend/src/components/hw/ForecastCard.tsx — forecast-unavailable UI
```

