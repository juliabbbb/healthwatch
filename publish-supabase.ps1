param(
    [string]$RunDirectory,
    [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$publisherPython = Join-Path $PSScriptRoot '.venv-sarimax\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $publisherPython -PathType Leaf)) {
    throw 'Run start-local.ps1 -Setup first to install the local Python environment.'
}
if (-not $RunDirectory) {
    $selectionPath = Join-Path $PSScriptRoot 'data\local\sarimax-launch.json'
    if (-not (Test-Path -LiteralPath $selectionPath)) { throw 'No saved local snapshot. Run start-local.ps1 -Setup first.' }
    $RunDirectory = (Get-Content -LiteralPath $selectionPath -Raw | ConvertFrom-Json).directory
}
$RunDirectory = [System.IO.Path]::GetFullPath($RunDirectory)
$priorDatabase = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
$priorOutput = [Environment]::GetEnvironmentVariable('HEALTHWATCH_OUTPUT_DIR', 'Process')
try {
    $env:HEALTHWATCH_OUTPUT_DIR = $RunDirectory
    & $publisherPython -c @'
import os
from src.artifacts import verify
from src.verify_build import verify_operational
root = os.environ['HEALTHWATCH_OUTPUT_DIR']
manifest = verify(root)
assert manifest['experiment_id'] == 'operational_sarimax_monthly_refit', 'Expected an operational SARIMAX run'
assert manifest.get('metadata', {}).get('production_model') == 'SARIMAX', 'Wrong model'
verify_operational(root, write_evidence=False)
print('Verified SARIMAX snapshot:', manifest['run_id'])
'@
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot verification failed; no database was changed.' }
    if ($VerifyOnly) { return }

    $privateUrl = Read-Host 'Paste the NEW empty Supabase project PostgreSQL URL (session pooler, port 5432)' -AsSecureString
    $env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $privateUrl).Password
    & $publisherPython -c @'
import os
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from src import db
url = make_url(os.environ['DATABASE_URL'].replace('postgres://', 'postgresql://', 1))
if url.get_backend_name() != 'postgresql':
    raise ValueError('Only an explicit PostgreSQL destination is allowed')
host = (url.host or '').lower()
if not (host.endswith('.supabase.co') or host.endswith('.pooler.supabase.com')):
    raise ValueError('Expected a Supabase database host copied from Connect')
if url.port not in (None, 5432):
    raise ValueError('Use the Session pooler on port 5432')
if not url.password or url.password in {'[YOUR-PASSWORD]', '[YOUR_PASSWORD]'}:
    raise ValueError('Replace the connection-string password placeholder first')
if url.query.get('sslmode', 'require') not in {'require', 'verify-ca', 'verify-full'}:
    raise ValueError('The Supabase connection must require SSL')
engine = db.engine()
existing = inspect(engine).get_table_names(schema='public')
if existing:
    raise ValueError('Destination public schema already has tables. Refusing publication; use the NEW empty project.')
# Protect new tables from anonymous Data API access before inserting records.
db.metadata.create_all(engine)
quote = engine.dialect.identifier_preparer.quote
with engine.begin() as connection:
    for table in db.metadata.sorted_tables:
        connection.execute(text('ALTER TABLE public.' + quote(table.name) + ' ENABLE ROW LEVEL SECURITY'))
print('New Supabase schema prepared; row-level security enabled on all HealthWatch tables.')
'@
    if ($LASTEXITCODE -ne 0) { throw 'Destination preparation failed. Data publication was not started.' }

    & $publisherPython -m src.db --verified-run $RunDirectory
    if ($LASTEXITCODE -ne 0) {
        throw 'Publication failed. Retain the error log. The new schema remains available for diagnosis; no automatic retry is made.'
    }
    & $publisherPython -c @'
import os
from sqlalchemy import text
from src.artifacts import verify
from src import db
expected_run = verify(os.environ['HEALTHWATCH_OUTPUT_DIR'])['run_id']
with db.engine().connect() as connection:
    row = connection.execute(text('SELECT version, model FROM pipeline_runs ORDER BY id DESC LIMIT 1')).one()
    assert row.model == 'SARIMAX' and row.version == expected_run
    print('Supabase snapshot:', row.version, '| model:', row.model)
    print('Observation rows:', connection.execute(text('SELECT COUNT(*) FROM monthly_observations')).scalar_one())
    print('Forecast rows:', connection.execute(text('SELECT COUNT(*) FROM forecasts')).scalar_one())
'@
    if ($LASTEXITCODE -ne 0) { throw 'Publication completed but the final readback failed; inspect the new database before activation.' }
    Write-Host 'New Supabase candidate loaded. Test its API before switching the live Render database.'
} finally {
    foreach ($entry in @(@{ Name = 'DATABASE_URL'; Value = $priorDatabase }, @{ Name = 'HEALTHWATCH_OUTPUT_DIR'; Value = $priorOutput })) {
        if ($null -eq $entry.Value) { Remove-Item -LiteralPath "Env:$($entry.Name)" -ErrorAction SilentlyContinue }
        else { Set-Item -LiteralPath "Env:$($entry.Name)" -Value $entry.Value }
    }
}
