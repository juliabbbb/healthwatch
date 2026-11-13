# SARIMAX switch and PAGASA advisory-only integration

This branch implements the user's uploaded **SARIMAX IMPLEMENTATION.zip**, with the cleaned datasets authorized in the project conversation. Branch: `input-sarimax`. Main forecasting is SARIMAX only. The original Prophet checkout/snapshot is the rollback; no shared database publication, merge or deployment occurs here.

## Model and outputs

The adapter `src/sarimax_forecast.py` retains the frozen `(1,0,0)x(1,0,0,12)`, constant trend, June–November wet flag, enforced stationarity/invertibility, maxiter=200 and convergence gate. It reindexes gaps without inventing observed targets. Main/probe forecasts return the same dates, point/80%-interval columns and zero floor. Bounds are model intervals, not calibrated probabilities.

An operational point-only backtest does not consume interval bounds: it scores only the predicted mean. Nonfinite main/probe bounds still fail the build. This distinction prevents an unused validation interval from invalidating a finite point-only error calculation; no bounds are fabricated or parameters relaxed.

`src/forecast.py` retains the two monthly-refit evaluation windows and pre-2025 Jan–Mar/Jul–Sep probes. Their metrics are separate from fixed-origin CV2022–2024 and retrospective TEST2025 model selection. Percentile classification, ranking and Rule A/B implementations are unchanged. Caches additionally include the provider adapter/version/settings fingerprint so a stale provider cannot masquerade as SARIMAX.

## Cleaned input

`data/cleaned/monthly_observations.csv` contains 9,832 combined monthly rows, including National and the provisional Hep A series; seven ILI counts remain explicitly missing. The approved modeling cutoff is Aug2026, with Hep A ending Sep2025. These files are inputs, not predictions. Main diseases are Dengue, ABD, Cholera, Typhoid, ILI and Leptospirosis. ILI uses numeric cases after header correction; Leptospirosis uses S/P/C-coded reported-record counts, not source numeric weights or deaths.

`monthly_death_context.csv` preserves known death values from matching approved primary monthly exports. Unresolved ILI/Leptospirosis/Hep A death values remain unknown. `heat_reference_events.csv` remains annual reference-only. `source_exports.json` preserves the original source-export identities/hashes. The loader asserts unique keys, finite nonnegative integer observed counts and National=sum of available regional reports. It performs no new zero-filling, deduplication or raw-source reinterpretation. Sparse/leading/trailing unknown observations remain unknown.

The new default build deliberately imports the cleaned snapshot rather than rerunning historical raw gap rules. `data/local` is ignored by git; input corrections and code are committed, while generated local run outputs remain separate.

## PAGASA separation

The existing backend parser is unchanged, following section 6.3 of the uploaded plan. It still returns legacy multiplier fields for compatibility, but the weather card and alerts do not display or apply them. Numeric forecast modifiers, surge percentages and adjusted forecast intervals have been removed. The bulletin, advisory badge, guidance and typical transmission context remain. The caption states that the advisory changes no forecast, hotspot tier or outbreak flag.

There is no additional weather-predictor model in this scope. Actual daily weather does not enter historical SARIMAX fits. The paper, methodology page, model labels and CSV/PDF provenance identify the actual model/active run; literature and the untouched four-model research adapter may still mention Prophet appropriately.

## Rebuild and verify locally

From the repository root, use a working Python 3.12 environment with `requirements.txt` and `requirements-ml.txt` installed:

```powershell
$env:HEALTHWATCH_PYTHON = 'C:\path\to\working\python.exe'
$env:HEALTHWATCH_WORKERS = '4'
.\update-data.ps1 -OutputDirectory 'C:\path\to\implementation_runs\sarimax-new-01'
```

The directory must be new. This runs cleaned import, SARIMAX forecasts and both operational validations, percentile tiers, escalation, seasonal rules, retrospective 2025 evaluation, the 2019 consistency check and verification/sealing. It does not access a database. A failure is retained and prevents sealing.

For the uploaded plan's CV replay:

```powershell
& $env:HEALTHWATCH_PYTHON tools/check_sarimax_cv.py 'C:\path\to\CV_Verification_Integration_Handoff' --cells 40 --output data/local/sarimax_cv_replay.json
& $env:HEALTHWATCH_PYTHON -m unittest discover -s tests -v
```

Inspect `forecasts.csv`, `validation_metrics.csv`, `tier_accuracy.csv`, `outbreak_validation_2025.csv`, `known_epidemic_check.csv`, exclusions and manifest. Keep the new operational scores distinct from the historical four-model comparison. See SARIMAX_SWITCH_RESULTS.md for actual execution evidence and unresolved checks.

## Local publication only

After verification, local acceptance uses a **new SQLite file** and the same output directory. Never reuse the old database or point this command at Supabase:

```powershell
$env:HEALTHWATCH_OUTPUT_DIR = 'C:\path\to\verified\sarimax-run'
$env:DATABASE_URL = 'sqlite:///C:/path/to/healthwatch/data/local/healthwatch_sarimax.db'
& $env:HEALTHWATCH_PYTHON -m src.db --verified-run $env:HEALTHWATCH_OUTPUT_DIR
.\run-backend.ps1 -Mode Local -DatabasePath data\local\healthwatch_sarimax.db -OutputDirectory $env:HEALTHWATCH_OUTPUT_DIR -Background
```

The publication guard accepts only SARIMAX operational experiment IDs on this branch, verifies artifacts and stores model/run provenance. Research comparisons remain separate. The original local Prophet DB/snapshot is untouched. Returning to the old branch and its original DB/output pair is the rollback.

The old partial ILI extender is blocked on this branch: extending a Prophet snapshot with only SARIMAX ILI would mix model identities. Use a full cleaned-input rebuild. Prophet ablation files remain historical and must not be run against the SARIMAX-only operational module. Nothing changes `src/model_adapters.py` or the frozen four-model research experiment.

## Numerical fitting disclosure

If a monthly-refit optimizer raises an LU decomposition error, the same model/order/exogenous flag/optimizer/maxiter is retried once using the preceding origin's converged parameters as starting values only. This consumes no future outcome. Convergence and finite-output guards still apply; no alternative model, imputed target or relaxed stationarity constraint is substituted. Every such retry is written to fit_numerical_retries.csv. The initial fixed-origin CV replay never uses this operational retry.

A local diagnostic confirmed that our adapter and the uploaded drop-in produce identical predictions on the checked cell, while both differ by 0.028237 cases from the archived Linux prediction on ABD/Central Visayas/CV2023. The archive used Linux Python 3.12.3 with NumPy 2.5.2, pandas 3.0.5, SciPy 1.18.1 and statsmodels 0.14.6; the Windows replay is not represented as passing the uploaded 0.001 strict tolerance. See the execution report for the full replay result.
