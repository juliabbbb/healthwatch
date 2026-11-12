# Run the backend locally

The default developer launcher explicitly selects a local database. Local mode uses only the named SQLite file. Configured mode never falls back to another database. Your existing .env and its Supabase connection string are preserved.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\run-backend.ps1 -Mode Local -Background
```

The foreground form is `./run-backend.ps1 -Mode Local`. Use `./run-dev.ps1` for the backend plus frontend. A matching healthy local backend is reused rather than starting a second server on port 8000. Startup checks required imports and waits for a populated `/health` response, not merely an open port. Background windows are hidden and logs go to api_start_out.log/api_start_err.log.

Local paths are `data/local/healthwatch_verified.db` and, optionally, `data/local/research_run`. These ignored files contain the verified local snapshot and research artifacts prepared for this computer. They are not committed or published to the shared database. The local data reports source uncertainty and excluded datasets normally; selecting local mode does not establish source confirmation.

## Fresh checkout without a local snapshot

Install requirements-ml.txt as well, choose a new output directory, and run the offline build described in IMPLEMENTATION_WORKFLOW.md. After its manifest verifies, explicitly publish to a new **local** SQLite file:

```powershell
$localRun = 'C:/path/to/new-verified-run'
.\update-data.ps1 -OutputDirectory $localRun
$env:HEALTHWATCH_OUTPUT_DIR = $localRun
$env:DATABASE_URL = 'sqlite:///C:/path/to/healthwatch/data/local/healthwatch_verified.db'
.\.venv\Scripts\python.exe -m src.db --verified-run $localRun
```

Create the local database's parent directory first. The build can take time and needs the original raw inputs; no empty or invented snapshot is automatically seeded. A separately generated, verified four-model run may be placed at data/local/research_run or selected explicitly through HEALTHWATCH_RESEARCH_RUN.

## Shared/configured database mode

`./run-backend.ps1 -Mode Configured` uses DATABASE_URL from the environment or the existing .env. An invalid/paused/unavailable Supabase connection stops startup rather than changing targets. The configured connection currently rejects the tenant/user and must be corrected by the project owner before this mode can work. Never commit credentials. Existing-database schema migration and shared publication remain separate reviewed actions.

The launcher restores the parent process's database/research environment settings after starting its child process. `/health` exposes only readiness, database type and snapshot identity; it does not expose connection credentials.

## Matching local reference artifacts

The local launcher now reads data/local/active_run.json when using the default local database. It verifies that artifact directory and checks that its run identity matches the database's health response. This keeps the annual heat endpoint on the same explicitly selected run. The pointer is local and ignored. For another explicit snapshot, pass both -DatabasePath and -OutputDirectory; the caller's environment values are restored after launch.

On this computer the active local snapshot is operational-ili-a78819fcd460 from data/local/runs/provisional-ili-v1. The previous local database is preserved at data/local/healthwatch_before_ili_20261112.db. Neither file is the shared Supabase database. A restart can use ./run-dev.ps1; its frontend now explicitly uses port 8080 with strict port selection and waits for an HTTP response, matching the project's Vite configuration. The earlier launcher incorrectly used a separate port; it has been corrected.
