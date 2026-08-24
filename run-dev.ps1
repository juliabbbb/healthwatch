# Starts the HEALTHWATCH stack: FastAPI (:8000) + Vite dev server (:5173).
# Close either window to stop that service.
$root = $PSScriptRoot

# Fallback: surface user-scope secrets (e.g. GEMINI_API_KEY) even when this
# shell was opened before `setx` ran. api.py also reads a repo-root .env file.
foreach ($name in @('GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_MODEL', 'ANTHROPIC_MODEL')) {
    if (-not [Environment]::GetEnvironmentVariable($name, 'Process')) {
        $userVal = [Environment]::GetEnvironmentVariable($name, 'User')
        if ($userVal) { Set-Item -Path "Env:$name" -Value $userVal }
    }
}

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root'; & '.venv\Scripts\python.exe' -m uvicorn src.api:app --port 8000"
) | Out-Null

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\frontend'; npm run dev"
) | Out-Null

Write-Host ""
Write-Host "HEALTHWATCH starting:" -ForegroundColor Cyan
Write-Host "  Backend : http://localhost:8000/docs"
Write-Host "  Frontend: http://localhost:5173"
