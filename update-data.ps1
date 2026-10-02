# HEALTHWATCH data update: raw file -> processed CSVs -> PostgreSQL.
# Run after dropping a new DOH-EB export in data/raw/. The ML pipeline runs
# offline on this machine; the final step (src.db) mirrors data/processed into
# the shared Postgres, which is what the deployed dashboard serves.
# Fails loudly: any failed step stops the run, so Postgres is never half-synced.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location -LiteralPath $root
$py = Join-Path $root '.venv\Scripts\python.exe'
$raw = Join-Path $root 'data\raw\DOH-Epi-Dengue-2019-2026-line-list.csv'

if (-not (Test-Path -LiteralPath $py)) {
    throw "Python venv not found: $py`nCreate it first: python -m venv .venv && .venv\Scripts\pip install -r requirements.txt"
}
if (-not (Test-Path -LiteralPath $raw)) {
    throw "Raw data file not found: $raw`nDrop the updated DOH-EB export in data\raw\ first."
}
$hasDb = (Test-Path -LiteralPath '.env') -and (Select-String -LiteralPath '.env' -Pattern '^\ufeff?DATABASE_URL=.' -Quiet)
if (-not $hasDb) {
    Write-Warning "No DATABASE_URL in .env - the final sync step (src.db) will fail; the pipeline steps will still run."
}
$hasGroq = (Test-Path -LiteralPath '.env') -and (Select-String -LiteralPath '.env' -Pattern '^\ufeff?(GROQ_API_KEY|OPENAI_API_KEY)=.' -Quiet)
$hasNarratives = Test-Path -LiteralPath 'data\processed\narratives.csv'

$steps = @(
    'src.fwbd_ingest'           # DOH FWD line-lists (ABD/Cholera/Typhoid/Hep A) -> monthly series
    'src.doh_eb_ingest'          # canonical DOH-EB file -> monthly series
    'src.forecast'               # Prophet fits + 12-month forecasts, validation folds
    'src.classify'               # month-of-year thresholds, risk + probe classification
    'src.rank_escalation'        # risk-tier escalation ranking (hotspot priority)
    'src.outbreak'               # season-level outbreak flags
    'src.validate_2025'          # prospective check of the 2025 flags (real data)
    'src.validate_2019_consistency' # 2019 consistency check (production monthly rule on real line-list rows)
)

foreach ($step in $steps) {
    Write-Host ''
    Write-Host ">>> $step"
    & $py -m $step
    if ($LASTEXITCODE -ne 0) {
        throw "Pipeline step '$step' failed (exit $LASTEXITCODE). Postgres was NOT synced - fix the step and re-run."
    }
}

# AI narrative corpus. Runs after the pipeline because its grounding reads the
# freshly written forecasts/classifications, and before src.db so the new rows
# land in Postgres in the same sync. Optional by design: without a provider key
# the corpus is simply not refreshed and the API keeps serving the previous one.
if ($hasGroq -or -not $hasNarratives) {
    Write-Host ''
    Write-Host '>>> src.generate_narratives'
    if (-not $hasGroq) {
        Write-Warning "No GROQ_API_KEY/OPENAI_API_KEY in .env - attempting a dry run so the pipeline is still exercised."
        & $py -m src.generate_narratives --dry-run
    } else {
        & $py -m src.generate_narratives
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Narrative generation failed (exit $LASTEXITCODE). Continuing: the API falls back to live generation or static client copy."
    }
} else {
    Write-Host ''
    Write-Host '>>> src.generate_narratives (skipped: no provider key and data\processed\narratives.csv already exists)'
}

Write-Host ''
Write-Host '>>> src.db'
& $py -m src.db
if ($LASTEXITCODE -ne 0) {
    throw "Pipeline step 'src.db' failed (exit $LASTEXITCODE). Postgres was NOT synced - fix the step and re-run."
}

Write-Host ''
Write-Host "Data update complete. Processed CSVs in data\processed\; Postgres is synced." -ForegroundColor Green
Write-Host "Commit the regenerated data\processed\*.csv to the repo to version the new artifacts."