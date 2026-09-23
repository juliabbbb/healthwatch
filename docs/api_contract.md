# HEALTHWATCH API Contract

Base URL (dev): `http://localhost:8000`
Base URL (deployed): `https://healthwatch-api-xepv.onrender.com` (see `render.yaml`)

Machine-readable spec: live OpenAPI at `GET /docs` (Swagger UI) and
`GET /openapi.json`. This document pins the *contract* the thesis and
integrating systems rely on: field names and semantics, not just example
payloads.

## 1. Endpoints

All endpoints return JSON (`application/json`). Read-only endpoints are `GET`
unless noted. `disease` is case-sensitive (`Dengue`).

| Endpoint | Purpose | Key query params | Response shape |
|---|---|---|---|
| `GET /forecast/{disease}` | 12-month forecast per region | `region` (optional) | `{disease, region?, count, items:[{disease, region, target_date, yhat, yhat_lower, yhat_upper}]}` |
| `GET /risk-classification/{disease}` | Risk tier per region-month over the horizon | `region` (optional) | `{disease, region?, count, items:[{disease, region, date, yhat, p50, p75, risk_level}]}` |
| `GET /escalation` | Risk-tier escalation ranking (Objective 4) | `disease`, `region`, `top` | `{disease, region?, count, items:[{rank, disease, region, tier_climbs, net_climb, n_high_months, first_high_month, final_tier}]}` |
| `GET /thresholds/{disease}` | Historical P50/P75 per region-month | `region` | `{disease, region?, items:[{disease, region, month, p50, p75}]}` |
| `GET /thresholds/seasonal` | Season (dry/wet) long-run P75 | `region` | `{items:[{region, disease, season, forecast_avg, p75, n_months}]}` |
| `GET /outbreak` | Season-level outbreak flags (Rule A/B) | `region`, `season` | `{season?, count, items:[{region, disease, season, outbreak, trigger, consecutive_high_n, season_avg, season_p75}]}` |
| `GET /outbreak/{region}` | Per-region outbreak status | – | `{region, disease, seasons:[…same fields…]}` |
| `GET /validation/outbreak` | Prospective 2025 outbreak validation | – | `{scope, overall:{tp,fp,fn,tn,precision,recall,f1}, by_season:{dry,wet:{…}}}` |
| `GET /metrics/{region}` | Forecast error metrics + confidence | `disease`, `window` | `{region, disease, windows:[…], primary_window, mae, rmse, mape, skill_vs_naive_pct, confidence}` |
| `GET /series/{region}` | Historical series (+ forecast) | `disease`, `include_forecast` | `{region, disease, points:[{index,date,label,season,forecast,cases,lower,upper}]}` |
| `GET /regions` | Region metadata | – | `[{code, name, short, geoName}]` |
| `GET /status` | Pipeline freshness snapshot | – | `{generated_at, data_through:{date,month}, supported_diseases}` |
| `GET /health` | Liveness (`data_ready` flag) | – | `{status, data_ready}` |

Live / interactive endpoints (AI narratives) are intentionally
excluded from the integration contract; they are for dashboard users, not
headless consumers. Their OpenAPI entries remain available under
`/analysis/*`.

## 2. Field semantics (contract commitments)

- **`target_date` / `date`** — ISO `YYYY-MM-DD`, always month-start (`…-01`).
- **`yhat`** — point forecast of monthly cases. **Non-negative by construction**
  (production floor of 1); never log-scale. Rounding to an integer is safe.
- **`yhat_lower` / `yhat_upper`** — 80% Prophet interval, floor applied.
- **`p50` / `p75`** — historical 50th/75th percentile of monthly cases for that
  region-month, from the fixed 2022-01..2024-12 baseline.
- **`risk_level`** — one of `Low | Moderate | High`, where
  `yhat < p50 → Low`, `p50 ≤ yhat ≤ p75 → Moderate`, `yhat > p75 → High`.
- **`trigger`** — `none | consecutive_high | season_p75 | both`.
- **`tier_climbs`** — number of upward risk-tier transitions across the
  12-month horizon (`Low→Moderate` and `Moderate→High` each count 1). Rank key
  for `/escalation`. Flat/declining regions score 0.
- **`MAE` / `RMSE` / `MAPE`** — walk-forward window error metrics. `MAPE` can
  exceed 100% on near-zero months; read `skill_vs_naive_pct` alongside it.

## 3. Error responses

| Code | Meaning | Example body |
|---|---|---|
| `404` | Unknown disease / region / season / not generated | `{"detail":"Unknown region 'x'"}` |
| `422` | Bad query parameter | `{"detail": …}` |
| `429` | Rate limit exceeded | `{"detail":"Rate limit exceeded. Please slow down and retry."}` with `Retry-After` header |
| `503` | Data still loading at cold start, or AI layer unavailable | `{"detail":"Data still loading, retry shortly"}` |

## 4. Rate limits

In-memory per-client-IP, applied at the application layer:

| Surface | Limit |
|---|---|
| `/forecast/{disease}`, `/risk-classification/{disease}`, `/escalation` | 300/min |
| `/dashboard` | 300/min |
| `/analysis/*` (LLM) | 20/min |

## 5. Data freshness & consistency

- Pipeline outputs are computed offline and shipped in the repo
  (`data/processed/*.csv`). The API snapshots them **in memory at process
  startup** (`/status.generated_at` is the newest pipeline artifact timestamp).
  After a deploy/restart the data is frozen until the next pipeline run +
  redeploy. Treat the API as a **served snapshot**, not a live query engine.
- Free-tier Render instances sleep; the first request after idle incurs a
  cold start (`/health` returns `data_ready:false` until the snapshot loads —
  poll it if you automate calls).
- National data is the sum of the 18 regions (never a raw series).

## 6. CORS

Default allowed origins: `localhost` dev servers and `*.onrender.com`.
Custom origins are configured server-side via the `ALLOWED_ORIGINS` env var
(comma-separated). Server-to-server integrations are unaffected by CORS.

## 7. Example

```bash
curl "https://healthwatch-api-xepv.onrender.com/escalation?top=5" \
  -H "Accept: application/json"
```

See `docs/examples/integration_client.py` for a working `requests` client.