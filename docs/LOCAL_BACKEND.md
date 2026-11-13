# Local SARIMAX startup

Run `powershell -ExecutionPolicy Bypass -File ./run-dev.ps1` from the repository root. The frontend listens on http://localhost:8080 and the API on http://127.0.0.1:8000.

The launcher prefers `.venv-sarimax/Scripts/python.exe`, then `.venv`, unless `HEALTHWATCH_PYTHON` is explicitly set. Install `requirements-ml.txt` in a dedicated Python 3.12 environment for building or publishing a local snapshot.

## Active snapshot

`data/local/active_run.json` is an ignored machine-local object containing `directory`, `database_path`, `run_id` and `manifest_sha256`. Both paths must refer to the same verified operational SARIMAX run. Startup verifies the artifact hashes and model/experiment identity, then checks the API's model and snapshot run ID. Legacy or mismatched snapshots fail rather than silently serving Prophet.

On this computer, the November 14 activation uses:

- Run: `data/local/runs/sarimax_20261114`
- Database: `data/local/healthwatch_sarimax_20261114.db`
- Preserved rollback database: `data/local/healthwatch_verified.db` (Prophet; not the current branch's default)

`GET /health` reports `model: SARIMAX`, `snapshot_run_id: sarimax_20261114`, `data_ready: true` and `shared_database: false`.

For an explicit alternative, use both `-DatabasePath` and `-OutputDirectory` with `run-backend.ps1 -Mode Local -Background`. If the port is occupied by a different run, stop that identified local backend before restarting; the launcher does not kill unrelated services.

## Rebuild on another computer

Use the offline commands in `docs/SARIMAX_SWITCH.md` to create a new output directory, verify it, and publish to a new explicitly named local SQLite file. Create the active pointer only after publication succeeds. Do not reuse the Prophet file or a shared PostgreSQL URL. Generated snapshots are intentionally not tracked by Git.

Research artifacts are optional and separately selected through `active_research.json` or `-ResearchDirectory`; when present, their source-decision identity must match the operational run. A missing research run does not invalidate operational forecasts.

## Configured/shared mode

`run-backend.ps1 -Mode Configured` uses the explicitly configured DATABASE_URL. Schema migration, publication, rollback preparation and deployment require a separate reviewed operation. The local verification workflow does not publish to the shared database.
