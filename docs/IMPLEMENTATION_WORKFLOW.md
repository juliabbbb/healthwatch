# Current SARIMAX switch contract

The user-approved `SARIMAX IMPLEMENTATION.zip` takes precedence for this branch: SARIMAX-only forecasting; PAGASA bulletin advisory only; unchanged percentile tiers, Rule A/B and validation windows; no shared DB publication. Use `docs/SARIMAX_SWITCH.md` and `update-data.ps1` for the approved cleaned-input path. Six main diseases include corrected ILI and Leptospirosis; Hep A remains provisional. Older provisional/source-calendar limitations below remain factual cautions, but older blocked/supplementary role labels are superseded. The legacy raw-ingest/zero-fill paths are not the default cleaned-input build.

# HealthWatch implementation workflow

This branch implements the reviewed local correction plan. Operational SARIMAX and the four-model research experiment are separate. A verified research comparison does not automatically replace the operational model. The 2025 evaluation is retrospective, not an untouched prospective test. Source-owner confirmations, interval calibration, live AI fidelity and participant comprehension are not established by this implementation.

## Source status

| Source | Current permitted use |
|---|---|
| Dengue | Numeric counts; legacy ISO-Thursday/W53 convention explicitly conditional |
| ABD, Cholera, Typhoid | Numeric reported-count series; sparse eligibility and reporting coverage retained |
| ILI | User-authorized provisional header reversal/calendar, with corrected source-row date alignment; history, eligible operational Prophet forecasts and separate research comparison remain explicitly provisional |
| Hepatitis A | Provisional one-record-per-case history and eligible forecasts; excluded from primary model selection; internal Acute Viral Hepatitis ID retained |
| Leptospirosis | User-authorized provisional one-record-per-case history/forecasts; numeric fields retained for audit; death totals unresolved; excluded from primary selection |
| Heat | Annual reference aggregates; no manufactured monthly forecasts |

The four FWBD sources use user-relayed zero reporting only for interior gaps between existing regional reports. Added zeros retain their decision version, zero source-record count and unknown death measures; leading/trailing coverage is not extended. See source_decisions.json. Duplicate candidates are retained. Unknown codes remain Unknown, missing reports remain missing, and absent death measures are not zero. Workbook ledgers retain original sheet/row/cell types; date-typed ages are unresolved. CSV lineage uses parsed record indexes, not patient identifiers or physical text-line numbers. National totals are sums of available regional reports, not proof of complete national incidence.

## Local setup

Use Python 3.12 and the environment versions captured with the run. Install requirements.txt and requirements-ml.txt into a dedicated virtual environment. WEKA 3.8.7 and a Java JDK are required for native RF; configure WEKA_JAR or pass --weka-jar. The application does not substitute scikit-learn RF. No credentials are needed for offline tests/builds. Set HEALTHWATCH_PYTHON when using the PowerShell launcher with a Python outside the checkout.

Backend checks: `python -m unittest discover -s tests -v`. Frontend: `npm ci`, `npx tsc --noEmit --incremental false`, `npm run build`. Tests use disposable local databases and stubbed narration; no shared database/provider calls are required. See the review evidence for actual executed commands and outcomes rather than treating these instructions as results.

## Offline operational build

Run `./update-data.ps1 -OutputDirectory <new-absolute-run-directory>`. The launcher creates a new run directory, ingests supported sources, forecasts operational SARIMAX and separate exact 2025 probes, computes classifications, escalation, seasonal reference validation and the retrospective 2019 check, then verifies/seals the result. It never publishes a database. It rejects an existing output directory to prevent mixed runs. The direct Python modules support HEALTHWATCH_RAW_DIR and HEALTHWATCH_OUTPUT_DIR and resolve defaults relative to the checkout.

The declared legacy observation cutoff is August 2026; source completeness remains unconfirmed. Fitting and serving use that cutoff. The operational horizon follows each series' actual declared training calendar; benchmark probes are exactly Jan-Mar/Jul-Sep 2025. Missing target actuals remain in the evaluation calendar and exclusions are explicit. Minimum observed training history is 24; all-zero series require a separately declared deterministic method. All prediction floors permit zero. The SARIMAX 80% model interval is uncalibrated; an error badge is not outbreak probability.

Long model builds use independent per-region worker processes, default four, and input/code-hashed checkpoints. Set HEALTHWATCH_WORKERS to control local CPU use. Failed jobs prevent final publication; completed checkpoint values are not paper findings by themselves. Preserve failure logs and exclusion ledgers.

## Four-model research build

`python -m src.benchmark --observations <observed-only.csv> --output <new-run-directory> --weka-jar <weka.jar> --include-provisional-ili`

The input must be an audited observed-only disease/region/date/cases/provisional table. Do not supply an old zero-filled grid as observed data. The frozen protocol is docs/research_protocol.json: 2019 start; CV2022/2023/2024; retrospective TEST2025; fixed-origin twelve-month point forecasts; shared actual/prior-year scoring mask; training-only thresholds; equal-disease regional MASE selection excluding National/provisional sources. Seasonal labels are rule-derived references, not confirmed official outbreaks. No candidate intervals are borrowed from operational Prophet.

The verified local integration reproduced the earlier numeric primary/ILI results exactly; sparse provisional Hep A remains outside this application benchmark. The research PDF's Hep A appendix remains a separately labeled earlier analysis, not a deployed result.

To expose a verified research run, set HEALTHWATCH_RESEARCH_RUN explicitly. `/research/status` and `/research/comparison?disease=Dengue&region=National&fold=TEST2025` verify artifact hashes and return run/experiment identities. A missing or ineligible series/window is unavailable, never substituted. The clinical Forecast card includes this research comparison. This branch uses SARIMAX operationally after a separately verified local rebuild; historical research scores are not future forecasts.

## Publication and schema

Database publication is separate: set an explicit DATABASE_URL and HEALTHWATCH_OUTPUT_DIR to the verified operational run, then use `python -m src.db --verified-run <same-run-directory>`. This is an operator action, not part of tests or a local build. No silent SQLite fallback or startup auto-seeding remains. Explicit SQLite is supported for disposable tests only. Research experiments cannot be published as operational tables.

Publication validates artifact hashes and original raw hashes before a single transactional DML replacement. Failed insertion rolls back existing data; no table drops precede insertion. An optional file-snapshot activation primitive uses atomic pointer replacement. PostgreSQL transaction behavior must also be checked in a disposable PostgreSQL target before shared deployment; the conducted failure-injection test used local SQLite.

This branch extends schema nullability and metadata columns. `create_all` is not a migration tool for existing tables. Before deploying against an existing database, prepare a versioned schema/staging target with this metadata, inspect schema differences, test its build and failure rollback locally, preserve a restorable prior snapshot, then separately approve activation. Do not point this branch at the shared database merely to discover missing columns.

## UI, exports and explanations

Canonical risk uses backend own-region/calendar-month P50/P75; Low < P50, Moderate includes equality, High > P75. Cross-region percentile is a separate burden comparison. Missing data/history/thresholds produce Unavailable, not Low, and later requested dates are not silently replaced with earlier points. All Illnesses uses declared eligible contributors; summed marginal bounds are not a calibrated aggregate interval.

PDF Rule A uses a complete three-month High run; Rule B uses probe mean > historical seasonal P75. Exports label 2025 benchmark dates separately from operational forecasts, use row-specific risk, and keep unavailable flags unavailable. CSV leaves nonfinite values empty and includes source/validation/model context. The actual PDF component was rendered with synthetic long-label/mixed-risk/unavailable fixtures; this does not substitute for every filter/device combination.

Narration uses a conservative deterministic-rendering gate: numeric overlap alone cannot establish meaning. Unverified generated claims fall back to payload-based text. Click-to-explain does not promote client descriptions into analytic evidence. Set HEALTHWATCH_NARRATIVE_AUDIT explicitly to retain raw/final text, payload hash, provider and policy version. No live provider/participant evaluation was conducted. Those objectives stay partial pending authorized studies.

## Acceptance

Consult the current implementation handoff and per-test acceptance status. Passing backend tests, a frontend build, a verified research run and local API checks do not establish source confirmation, interval calibration, clinical reliability, deployment readiness, live semantic fidelity or participant benefit. Preserve unresolved status until actual evidence closes it.
`outbreak_signals` serves the exact 2025 evaluation indicator artifact with pre-2025 pools; production-pool diagnostics are not substituted for those benchmark flags. Future operational seasonal alerts require a separate declared target experiment.


## Source-rule rebuild and local activation

The operational gap-rules-ddb64e035033 and research-gap-945fb497f392 runs implement source_decisions.json. Research was rerun for ABD/Cholera/Typhoid/Hep A/leptospirosis; unchanged Dengue/ILI research outputs were retained only after an exact 2019-2025 source comparison. Use src.rebuild_operational and src.rebuild_research for this path, or the full offline build for a fresh checkout. `--include-provisional` includes all three provisional research sources; `--diseases` selects independent reruns. The active local database and artifact pointers are ignored local files; no shared target was published. Research and operational source-decision hashes must match at local startup. See GAP_RULE_IMPLEMENTATION.md for executed acceptance and rollback evidence.

## Reproducible supplementary RF runs

ILI preprocessing now normalizes Year/Morbidity Week headers after validating both axes. Reversed and already-normal layouts are supported; mixed, fractional, or missing axes fail. The raw file is never rewritten. ili_header_audit.json records the source hash and transformation; ISO-Thursday/W53-to52 remains provisional.

`python -m src.ili_rf --output <new-research-directory> --weka-jar <weka.jar>` runs native RF for CV2022/CV2023/CV2024 and retrospective TEST2025, using monthly numeric Cases and a deterministic wet flag. No actual targets are filled.

`python -m src.leptospirosis_rf --output <new-research-directory> --weka-jar <weka.jar>` runs the user-defined supplementary reported_records target. Each S/P/C-coded nonblank row counts once; all numeric weights and death fields are ignored, including 2023. See leptospirosis_reported_records_decision.json. This target is not validated individual infections.

Both supplementary experiments retain the frozen RF settings, min-history/paired-target gates, missing-month handling and nonnegative floor. They are excluded from primary model selection and require common cells/dates for cross-model comparisons. National is supplemental, not evidence of complete reporting. These commands do not publish a DB or replace operational forecasts.
