param([ValidateSet('Local','Configured')][string]$BackendMode = 'Local')
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
& (Join-Path $root 'run-backend.ps1') -Mode $BackendMode -Background
if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
    $frontend = (Join-Path $root 'frontend').Replace("'", "''")
    Start-Process -FilePath powershell -ArgumentList @('-NoProfile', '-Command', "Set-Location -LiteralPath '$frontend'; npm.cmd run dev") -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'frontend_start_out.log') -RedirectStandardError (Join-Path $root 'frontend_start_err.log') | Out-Null
}
Write-Host 'HEALTHWATCH backend: http://localhost:8000/docs'
Write-Host 'HEALTHWATCH frontend: http://localhost:5173'
