# Local SARIMAX activation — 14 November 2026

The active local app uses run `sarimax_20261114`, rebuilt from the approved cleaned snapshot with Python 3.12.16 and statsmodels 0.14.6. Generated environments, artifacts, snapshots and evidence remain in ignored local paths. No shared database, deployment or live AI study was used.

## Verified activation

- `data/local/runs/sarimax_20261114`: sealed SARIMAX build; 350.59 seconds; 119 series and 1,428 future-month rows.
- `data/local/healthwatch_sarimax_20261114.db`: newly published local SQLite database; 9,832 observations, 1,428 forecasts/classifications, 222 seasonal benchmark rows and 210 validation metric rows.
- `data/local/active_run.json`: matching database/artifact paths, run ID and manifest hash. Default startup requires verified operational SARIMAX and checks the serving run/model. A second launcher invocation successfully reused the matching service.
- The original `data/local/healthwatch_verified.db` is preserved as the Prophet rollback snapshot.
- `/health`: ready, SARIMAX, run `sarimax_20261114`, shared_database false.

## Display corrections

Seasonality metrics use the final month of the selected saved 3/6/12-month horizon, not today's month plus that horizon. The timeline shows all twelve saved dates and uses each region/disease/month's own thresholds. The time slider disables offsets beyond available data. Individual diseases retain their own horizons, including Hepatitis A's earlier cutoff.

Dengue is the initial selection. All Illnesses retains the four declared primary contributors, displays their risk rows separately, and explains the absence of an aggregate risk tier or interval. Nonfinite forecast bounds render as dashes. Disease-specific assessments now retain the selected illness; aggregate dominance stays within its contributor cohort.

Model/run provenance and uncalibrated 80% interval labels appear with forecasts. Risk help describes own-region thresholds and separates cross-region burden ranks. The 2025 outbreak results are labeled retrospective benchmarks. Observed decomposition/ACF exclude forecasts even when a future analysis month is selected, and unavailable risk cannot fall through to low-risk recommendations. Seasonal export source code carries matching dates, thresholds, provenance and unavailable formatting.

## Acceptance evidence

- Backend unittest discovery: 55 passed.
- Frontend TypeScript no-emit check and production build: passed.
- Frontend data regression tests: passed, including global calendar alignment, month-specific tiers, saved horizons, missing-series behavior, explicit aggregate contributors and no forecast contamination of observed decomposition.
- CSV contract: passed (quoting, missing values, retained zero, row width).
- Read-only local integration (`frontend/tests/local-sarimax.mjs`): 1,344 regional forecast months match API risk classifications; raw/per-capita tiers agree. National series are independently covered by the artifact audit rather than the regional UI loop.
- Independent artifact audit: hashes verified; 1,050 regression checks and 210 tier cells checked; all 119 series have finite ordered nonnegative intervals and expected twelve-month horizons. Three numerical retries retained in the build ledger.
- Impeccable detection on edited UI targets: `[]` (no detected deviations), using `npx impeccable` because the documented global executable was absent.
- Browser: populated Dengue risk strip/metrics, 3-month target, aggregate contributor display, ILI/Leptospirosis, earlier Hepatitis A horizon and risk-method dialog checked. No console errors. Screenshots: `data/local/sarimax-outlook.jpg`, `data/local/sarimax-metrics.jpg`.

Logs are `sarimax_*` at repository root; detailed audit and environment records are in `data/local/sarimax_acceptance` and `data/local/sarimax_environment.txt`. Actual PDF export interaction and exhaustive responsive-device testing are not claimed here. Source uncertainty, uncalibrated intervals and research/live-study limitations remain as documented in IMPLEMENTATION_WORKFLOW.md.
