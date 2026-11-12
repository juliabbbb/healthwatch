param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$env:HEALTHWATCH_OUTPUT_DIR = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $env:HEALTHWATCH_OUTPUT_DIR) { throw "Choose a new run directory; existing artifacts must remain immutable." }
New-Item -ItemType Directory -Path $env:HEALTHWATCH_OUTPUT_DIR | Out-Null
# HEALTHWATCH local build: source preflight -> processed artifacts -> verification.
# Database publication is always a separate explicit command.
# Run after dropping a new DOH-EB export in data/raw/. The ML pipeline runs
# offline in the chosen run directory and does not connect to shared PostgreSQL.
# Fails loudly: any failed step stops the run, so Postgres is never half-synced.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location -LiteralPath $root
$py = if ($env:HEALTHWATCH_PYTHON) { $env:HEALTHWATCH_PYTHON } else { Join-Path $root '.venv\Scripts\python.exe' }
$raw = Join-Path $root 'data\raw\DOH-Epi-Dengue-2019-2026-line-list.csv'

if (-not (Test-Path -LiteralPath $py)) {
    throw "Python venv not found: $py`nCreate it first: python -m venv .venv && .venv\Scripts\pip install -r requirements.txt"
}
if (-not (Test-Path -LiteralPath $raw)) {
    throw "Raw data file not found: $raw`nDrop the updated DOH-EB export in data\raw\ first."
}
& $py -m src.preflight --output $env:HEALTHWATCH_OUTPUT_DIR
if ($LASTEXITCODE -ne 0) { throw "Source preflight failed. No fitting or publication occurred." }

$steps = @(
    'src.fwbd_ingest'           # DOH FWD line-lists (ABD/Cholera/Typhoid/Hep A) -> monthly series
    'src.ili_ingest'            # Provisional observed history only; lepto excluded
    'src.heat_ingest'           # Annual reference only
    'src.doh_eb_ingest'          # canonical DOH-EB file -> monthly series
    'src.forecast'               # Prophet fits + 12-month forecasts, validation folds
    'src.classify'               # month-of-year thresholds, risk + probe classification
    'src.rank_escalation'        # risk-tier escalation ranking (hotspot priority)
    'src.outbreak'               # season-level outbreak flags
    'src.validate_2025'          # prospective check of the 2025 flags (real data)
    'src.validate_known_epidemic' # independent 2019 dengue outbreak check (line-list 2019 monthly cross-check)
    # Database publication is a separate explicit command after verification.
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
Write-Host "Local build finished. Run verification before any separate publication." -ForegroundColor Green
Write-Host "Review the run directory and manifest; no database was changed."
& $py -m src.verify_build --run $env:HEALTHWATCH_OUTPUT_DIR --run-id (Split-Path -Leaf $env:HEALTHWATCH_OUTPUT_DIR)
if ($LASTEXITCODE -ne 0) { throw "Build verification failed. Publication blocked." }
Write-Host "Verified local run. No database was published."
