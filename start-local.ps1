param(
    [switch]$Setup,
    [switch]$Rebuild,
    [ValidateRange(1, 65535)][int]$BackendPort = 8012,
    [ValidateRange(1, 65535)][int]$FrontendPort = 8082
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if ($BackendPort -eq $FrontendPort) { throw 'BackendPort and FrontendPort must differ.' }
$python = Join-Path $PSScriptRoot '.venv-sarimax\Scripts\python.exe'
$statePath = Join-Path $PSScriptRoot 'data\local\sarimax-launch.json'

function Assert-Exit([string]$Action) {
    if ($LASTEXITCODE -ne 0) { throw "$Action failed (exit $LASTEXITCODE). See the output above." }
}

if ($Setup) {
    if (-not (Test-Path -LiteralPath $python)) {
        & py -3.12 -m venv (Join-Path $PSScriptRoot '.venv-sarimax')
        Assert-Exit 'Creating Python 3.12 environment'
    }
    & $python -m pip install -r requirements.txt -r requirements-ml.txt
    Assert-Exit 'Installing Python dependencies'
    Push-Location -LiteralPath (Join-Path $PSScriptRoot 'frontend')
    try {
        & npm.cmd ci
        Assert-Exit 'Installing frontend dependencies'
    } finally { Pop-Location }
}

if (-not (Test-Path -LiteralPath $python) -or
    -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'frontend\node_modules'))) {
    throw 'First run: powershell -NoProfile -ExecutionPolicy Bypass -File .\start-local.ps1 -Setup'
}
if (-not $Setup -and -not $Rebuild -and -not (Test-Path -LiteralPath $statePath)) {
    throw 'No local SARIMAX snapshot selected. Run start-local.ps1 -Setup once, or -Rebuild if dependencies are ready.'
}

$previous = @{}
foreach ($key in @('HEALTHWATCH_PYTHON', 'HEALTHWATCH_WORKERS', 'HEALTHWATCH_OUTPUT_DIR', 'DATABASE_URL', 'VITE_API_URL')) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    $env:HEALTHWATCH_PYTHON = $python
    if (-not $env:HEALTHWATCH_WORKERS) { $env:HEALTHWATCH_WORKERS = '4' }
    $build = $Rebuild -or (-not (Test-Path -LiteralPath $statePath))
    if ($build) {
        $stamp = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        $output = Join-Path $PSScriptRoot "data\local\sarimax-$stamp"
        $database = Join-Path $PSScriptRoot "data\local\sarimax-$stamp.db"
        Write-Host 'Building a new local SARIMAX snapshot. Allow several minutes.'
        & (Join-Path $PSScriptRoot 'update-data.ps1') -OutputDirectory $output
        $env:HEALTHWATCH_OUTPUT_DIR = $output
        $env:DATABASE_URL = 'sqlite:///' + $database.Replace('\', '/')
        & $python -m src.db --verified-run $output
        Assert-Exit 'Loading verified snapshot into local SQLite'
        # Save only after the build and database load both succeed. Preserve older snapshots.
        $state = @{ directory = $output; database = $database }
        $temporary = "$statePath.tmp"
        $state | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
        Move-Item -LiteralPath $temporary -Destination $statePath -Force
    } else {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $output = $state.directory
        $database = $state.database
    }
    if (-not (Test-Path -LiteralPath $database -PathType Leaf)) {
        throw 'Local database missing. Run start-local.ps1 -Rebuild.'
    }
    $env:HEALTHWATCH_OUTPUT_DIR = $output
    $manifestText = & $python -c "import json,sys; from src.artifacts import verify; print(json.dumps(verify(sys.argv[1])))" $output
    Assert-Exit 'Verifying saved artifacts'
    $manifest = $manifestText | ConvertFrom-Json
    if ($manifest.metadata.production_model -ne 'SARIMAX') { throw 'Selected snapshot is not SARIMAX.' }

    if (Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue) {
        throw "Frontend port $FrontendPort is occupied. Close your previous dev terminal or use -FrontendPort $($FrontendPort + 1)."
    }
    if (Get-NetTCPConnection -LocalPort $BackendPort -State Listen -ErrorAction SilentlyContinue) {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/health" -TimeoutSec 5
        if ($health.system -ne 'HEALTHWATCH' -or -not $health.data_ready -or
            $health.database -ne 'sqlite' -or $health.snapshot_run_id -ne $manifest.run_id) {
            throw "Backend port $BackendPort serves another snapshot/service. Close that service or choose a different -BackendPort."
        }
        Write-Host "Reusing verified SARIMAX backend on port $BackendPort."
    } else {
        & (Join-Path $PSScriptRoot 'run-backend.ps1') -Mode Local -DatabasePath $database -OutputDirectory $output -Port $BackendPort -Background
    }
    $env:VITE_API_URL = "http://127.0.0.1:$BackendPort"
    Write-Host "SARIMAX run: $($manifest.run_id)"
    Write-Host "Dashboard: http://127.0.0.1:$FrontendPort"
    Write-Host "API docs: http://127.0.0.1:$BackendPort/docs"
    Write-Host 'Keep this terminal open. Ctrl+C stops the frontend; the local backend remains running.'
    Push-Location -LiteralPath (Join-Path $PSScriptRoot 'frontend')
    try {
        & npm.cmd run dev -- --host 127.0.0.1 --port $FrontendPort --strictPort
        Assert-Exit 'Frontend dev server'
    } finally { Pop-Location }
} finally {
    foreach ($key in $previous.Keys) {
        if ($null -eq $previous[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
        else { Set-Item -LiteralPath "Env:$key" -Value $previous[$key] }
    }
}
