# Starts the HEALTHWATCH stack: FastAPI (:8000) + Vite dev server (:5173).
# Close either window to stop that service.
$root = $PSScriptRoot

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
