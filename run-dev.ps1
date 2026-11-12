param([ValidateSet('Local','Configured')][string]$BackendMode = 'Local')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
& (Join-Path $root 'run-backend.ps1') -Mode $BackendMode -Background
if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
    $frontend = (Join-Path $root 'frontend').Replace("'", "''")
    $frontProcess = Start-Process -FilePath powershell -ArgumentList @('-NoProfile', '-Command', "Set-Location -LiteralPath '$frontend'; npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort") -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'frontend_start_out.log') -RedirectStandardError (Join-Path $root 'frontend_start_err.log') -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $frontProcess.Refresh()
        if ($frontProcess.HasExited) { throw 'Frontend exited; inspect frontend_start_err.log.' }
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Frontend did not become ready; inspect frontend_start_err.log.' }
}
Write-Host 'HEALTHWATCH backend: http://localhost:8000/docs'
Write-Host 'HEALTHWATCH frontend: http://localhost:5173'
