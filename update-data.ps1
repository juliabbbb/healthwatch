# HEALTHWATCH data update: raw file -> processed CSVs -> PostgreSQL.
# Run after dropping a new DOH-EB export in data/raw/. The ML pipeline runs
# offline on this machine; the final step (src.db) mirrors data/processed into
# the shared Postgres, which is what the deployed dashboard serves.
# Fails loudly: any failed step stops the run, so Postgres is never half-synced.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location -LiteralPath $root
$py = Join-Path $root '.venv\Scripts\python.exe'
$raw = Join-Path $root 'data\raw\DOH-Epi-Dengue-2022-2026.csv'

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

$steps = @(
    'src.doh_eb_ingest'          # canonical DOH-EB file -> monthly series
    'src.forecast'               # Prophet fits + 12-month forecasts, validation folds
    'src.classify'               # month-of-year thresholds, risk + probe classification
    'src.outbreak'               # season-level outbreak flags
    'src.validate_2025'          # prospective check of the 2025 flags (real data)
    'src.validate_known_epidemic' # independent 2019 outbreak check (weekly fixture)
    'src.db'                     # mirrors processed CSVs into PostgreSQL (DATABASE_URL)
)

foreach ($step in $steps) {
    Write-Host ''
    Write-Host ">>> $step"
    & $py -m $step
    if ($LASTEXITCODE -ne 0) {
        throw "Pipeline step '$step' failed (exit $LASTEXITCODE). Postgres was NOT synced - fix the step and re-run."
    }
}

Write-Host ''
Write-Host "Data update complete. Processed CSVs in data\processed\; Postgres is synced." -ForegroundColor Green
Write-Host "Commit the regenerated data\processed\*.csv to the repo to version the new artifacts."