# SARIMAX switch: execution evidence

Prepared 13 November 2026. Scope: user-uploaded SARIMAX IMPLEMENTATION.zip; input-sarimax branch. No shared/Supabase publication or deployment.

## Completed

- Full cleaned-input build verified: `sarimax_advisory_final_20261113`; runtime 321.648 seconds.
- 119 forecast series / 1428 future-month rows. Main forecast dates: Sep2026–Aug2027; provisional Hep A uses Oct2025–Sep2026.
- 55 backend tests passed; frontend TypeScript no-emit check passed.
- Independent local-only audit passed manifest hashes, 1050 saved regression values and 210 tier-result cells, plus finite/ordered/nonnegative future intervals and exact horizons.
- 3 LU-error retries recorded in fit_numerical_retries.csv; optimizer starting values came only from the preceding converged origin. Frozen model orders/regressor/constraints/maxiter unchanged.
- PAGASA adjusted counts, adjusted intervals and surge percentages removed from the UI. The existing parser and four-model research adapter remain unchanged.
- Cleaned source files and known primary death context included; no new gap filling or raw data edits.

## Forecast series

| Disease | Series | Future rows |
|---|---:|---:|
| Acute Bloody Diarrhea | 19 | 228 |
| Acute Viral Hepatitis | 8 | 96 |
| Cholera | 16 | 192 |
| Dengue | 19 | 228 |
| Influenza-like Illness | 19 | 228 |
| Leptospirosis | 19 | 228 |
| Typhoid Fever | 19 | 228 |

## New operational regression results

Regional means only; National excluded from these means. These are monthly-refit windows, not the fixed-origin CV selection table. MAPE is a percentage; skill is mean regional cell skill against Seasonal Naive. Coverage differs by disease.

| Disease | Window | Cells | Months | MAE | RMSE | MAPE (%) | Mean skill (%) |
|---|---|---:|---:|---:|---:|---:|---:|
| Acute Bloody Diarrhea | 2025_prospective | 17 | 203 | 17.1301 | 21.5755 | 72.5744 | 40.7971 |
| Acute Bloody Diarrhea | last_12m | 17 | 203 | 14.4387 | 18.7028 | 75.7615 | 45.6955 |
| Cholera | 2025_prospective | 8 | 59 | 10.6316 | 13.1084 | 341.0926 | -175.2504 |
| Cholera | last_12m | 12 | 64 | 9.9238 | 11.3041 | 545.6143 | -177.6293 |
| Dengue | 2025_prospective | 18 | 216 | 467.2333 | 678.1082 | 59.2983 | 60.0877 |
| Dengue | last_12m | 18 | 216 | 362.8375 | 534.8589 | 57.2088 | 56.2633 |
| Influenza-like Illness | 2025_prospective | 18 | 213 | 396.9605 | 591.8503 | 71.6251 | 2.5505 |
| Influenza-like Illness | last_12m | 18 | 215 | 386.8710 | 569.0783 | 149.6968 | 3.4335 |
| Leptospirosis | 2025_prospective | 18 | 212 | 14.1590 | 22.1851 | 49.1709 | 9.4096 |
| Leptospirosis | last_12m | 18 | 214 | 16.5672 | 30.0675 | 60.6211 | 6.6752 |
| Typhoid Fever | 2025_prospective | 18 | 216 | 32.8374 | 43.2639 | 66.4247 | 33.5516 |
| Typhoid Fever | last_12m | 18 | 216 | 30.3597 | 47.6483 | 80.6188 | 48.7153 |

## New 2025 outbreak-reference results

Regional eligible dry/wet probes; National and provisional Hep A excluded from this summary. Reference labels come from the existing Rule A/B applied to observed counts, not independently declared official outbreaks.

| Disease | Probes | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Acute Bloody Diarrhea | 34 | 3 | 0 | 19 | 12 | 1.0000 | 0.1364 | 0.2400 |
| Cholera | 8 | 1 | 1 | 0 | 6 | 0.5000 | 1.0000 | 0.6667 |
| Dengue | 36 | 17 | 9 | 2 | 8 | 0.6538 | 0.8947 | 0.7556 |
| Influenza-like Illness | 36 | 7 | 1 | 13 | 15 | 0.8750 | 0.3500 | 0.5000 |
| Leptospirosis | 36 | 14 | 0 | 20 | 2 | 1.0000 | 0.4118 | 0.5833 |
| Typhoid Fever | 36 | 9 | 0 | 13 | 14 | 1.0000 | 0.4091 | 0.5806 |

Tier confusion matrices, macro-F1, High recall and High→Low miss rates are in the adjacent evidence CSV files. The pipeline’s original two-direction severe-miss rate is retained separately; denominators are not conflated.

## Remaining acceptance limits

- The strict 40-cell archived CV replay did not pass 0.001 tolerance: max absolute point difference 0.0282372295 cases. On the checked ABD/Central Visayas/CV2023 cell, the uploaded adapter and this branch give identical predictions locally. The archive was produced on Linux; the precise cross-environment cause is not established. The larger adapter-comparison replay was blocked during execution and is not claimed completed.
- Frontend production build/lint were not verified. The linked dependency tree caused EPERM cache writes outside the writable workspace; automatic approval review additionally rejected an unexpected Visual Studio telemetry connection, even with opt-outs. No bypass or approval for that data disclosure occurred. Type checking passed, but it is not a substitute for these checks.
- The required external Impeccable checker path is inaccessible in this execution account. No design-check pass is claimed.
- A new local SQLite snapshot was built and checked: 9,832 observations, 1,428 forecasts, 1,428 risk classifications, 222 seasonal signal rows and 210 validation-metric rows. The local backend is ready on http://127.0.0.1:8011. API checks passed for all six main diseases in NCR plus Dengue National, each returning 12 forecasts with SARIMAX/run provenance. Original Prophet database, active pointer and service remain untouched. No browser smoke test or shared deployment is claimed.
- 80% model intervals are uncalibrated. Sparse Cholera, target-unit differences and source-calendar/geography limits remain. Main-disease status for ILI/Leptospirosis does not establish complete reporting or confirmed individual infections.

## Reproduction

Use `docs/SARIMAX_SWITCH.md`. The full model output directory is retained on this PC under implementation_runs. Run `python tools/summarize_sarimax_run.py <run> --output <new-report-directory>` to independently check the sealed artifacts without importing forecasting packages or contacting external services.
