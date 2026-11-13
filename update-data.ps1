param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$py = if ($env:HEALTHWATCH_PYTHON) { $env:HEALTHWATCH_PYTHON } elseif (Test-Path (Join-Path $PSScriptRoot '.venv-sarimax\Scripts\python.exe')) { Join-Path $PSScriptRoot '.venv-sarimax\Scripts\python.exe' } else { Join-Path $PSScriptRoot '.venv\Scripts\python.exe' }
& $py -m src.build_cleaned --output ([System.IO.Path]::GetFullPath($OutputDirectory))
if ($LASTEXITCODE -ne 0) { throw "Cleaned-input SARIMAX build failed. No database was published." }
