param(
    [ValidateSet('Local', 'Configured')][string]$Mode = 'Local',
    [string]$DatabasePath,
    [string]$OutputDirectory,
    [int]$Port = 8000,
    [switch]$Background
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$py = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $py)) { throw 'Create the repo .venv and install requirements.txt first.' }
& $py -c 'import fastapi, uvicorn, sqlalchemy, bs4'
if ($LASTEXITCODE -ne 0) { throw "Runtime dependencies missing. Run: .venv\Scripts\python.exe -m pip install -r requirements.txt" }
$expectedRunId = $null
if ($Mode -eq 'Local' -and -not $OutputDirectory -and -not $DatabasePath) {
    $pointerPath = Join-Path $root 'data\local\active_run.json'
    if (Test-Path -LiteralPath $pointerPath) { $OutputDirectory = (Get-Content -LiteralPath $pointerPath -Raw | ConvertFrom-Json).directory }
}
if ($OutputDirectory) {
    $OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
    Push-Location -LiteralPath $root
    try { $expectedRunId = & $py -c "import sys; from src.artifacts import verify; print(verify(sys.argv[1])['run_id'])" $OutputDirectory }
    finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'The selected artifact directory did not verify.' }
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    if ($Mode -eq 'Local' -and -not $DatabasePath) {
        try {
            $existing = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
            if ($existing.system -eq 'HEALTHWATCH' -and $existing.data_ready -and $existing.database -eq 'sqlite') {
                if ($expectedRunId -and $existing.snapshot_run_id -ne $expectedRunId) { throw 'Running snapshot differs from the selected artifacts. Restart the local backend.' }
                Write-Host "Using the existing ready local HEALTHWATCH backend: http://127.0.0.1:$Port/docs"
                return
            }
        } catch { }
    }
    throw "Port $Port is already in use. Leave the existing service running or choose another port."
}
$previous = @{}
foreach ($key in @('DATABASE_URL', 'HEALTHWATCH_RESEARCH_RUN', 'HEALTHWATCH_OUTPUT_DIR')) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    if ($OutputDirectory) { $env:HEALTHWATCH_OUTPUT_DIR = $OutputDirectory }
    if ($Mode -eq 'Local') {
        if (-not $DatabasePath) { $DatabasePath = Join-Path $root 'data\local\healthwatch_verified.db' }
        $DatabasePath = [System.IO.Path]::GetFullPath($DatabasePath)
        if (-not (Test-Path -LiteralPath $DatabasePath -PathType Leaf)) {
            throw 'Verified local database missing. See docs/LOCAL_BACKEND.md to build a local snapshot; no remote fallback is attempted.'
        }
        $env:DATABASE_URL = 'sqlite:///' + $DatabasePath.Replace('\', '/')
        $research = Join-Path $root 'data\local\research_run'
        if (Test-Path -LiteralPath (Join-Path $research 'manifest.json')) { $env:HEALTHWATCH_RESEARCH_RUN = $research }
        Write-Host 'Backend mode: explicit local verified snapshot (SQLite). Shared PostgreSQL is not used.'
    } else {
        Write-Host 'Backend mode: configured DATABASE_URL. Connection errors will stop startup; no fallback is used.'
    }
    if ($Background) {
        $process = Start-Process -FilePath $py -ArgumentList @('-m', 'uvicorn', 'src.api:app', '--host', '127.0.0.1', '--port', "$Port") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'api_start_out.log') -RedirectStandardError (Join-Path $root 'api_start_err.log') -PassThru
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            $process.Refresh()
            if ($process.HasExited) { throw 'Backend exited. Inspect api_start_err.log for the startup error.' }
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
                if ($health.data_ready -and $health.status -in @('ok', 'ready')) {
                    if ($expectedRunId -and $health.snapshot_run_id -ne $expectedRunId) {
                        Stop-Process -Id $process.Id -ErrorAction SilentlyContinue
                        throw 'Database and selected artifact run identities do not match.'
                    }
                    Write-Host "Backend ready: http://127.0.0.1:$Port/docs (PID $($process.Id))"
                    return
                }
            } catch { }
            Start-Sleep -Milliseconds 500
        }
        throw 'Backend did not report readiness. Inspect api_start_err.log.'
    } else {
        Push-Location -LiteralPath $root
        try { & $py -m uvicorn src.api:app --host 127.0.0.1 --port $Port }
        finally { Pop-Location }
    }
} finally {
    foreach ($key in $previous.Keys) {
        if ($null -eq $previous[$key]) { Remove-Item -LiteralPath "Env:$key" -ErrorAction SilentlyContinue }
        else { Set-Item -LiteralPath "Env:$key" -Value $previous[$key] }
    }
}
