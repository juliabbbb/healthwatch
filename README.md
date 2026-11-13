# HealthWatch

Regional monthly illness forecasting, hotspot classification, seasonal outbreak signals, and regional comparisons for the Philippines.

**On `input-sarimax`, the operational forecasting model is SARIMAX.** Prophet appears only in historical work and the separate four-model research comparison. PAGASA is advisory-only: it does not adjust forecast counts, intervals, hotspot tiers, or outbreak flags.

## Run locally on Windows

Install Git, **Python 3.12** (with the Windows `py` launcher), and **Node.js 22.12+** first. Open PowerShell in the repository root. You do not need Supabase credentials for this local setup.

### First time after cloning

Each teammate creates their own clone and runs setup once. The branch includes the source, launch scripts, dependency lockfile and approved cleaned inputs. Setup creates that computer's Python environment, frontend packages, verified forecast snapshot and local database. Internet access is needed to install packages; no database file or credentials need to be shared.

Use **Windows PowerShell** for the commands below. Check prerequisites first:

```powershell
py -3.12 --version
node --version
git --version
```


```powershell
git clone --single-branch --branch input-sarimax https://github.com/juliabbbb/healthwatch.git
cd healthwatch
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -Setup
```

If you already have the repository, use this instead from its root:

```powershell
git switch input-sarimax
git pull --ff-only origin input-sarimax
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -Setup
```

The setup installs Python packages into `.venv-sarimax`, installs frontend dependencies from the lockfile, and builds a verified SARIMAX snapshot and a separate local SQLite database if no launcher snapshot exists. The previous full forecast build took about five minutes; installation and hardware affect the total time. Then it starts the backend and dashboard. No manual environment-variable or database commands are needed.

Open **http://127.0.0.1:8082**. API documentation: **http://127.0.0.1:8012/docs**.

Keep the terminal open. Ctrl+C stops the frontend. The backend runs in the background and is reused on the next start only when its health response matches the selected local run.

### Every later start

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1"
```

The launcher reuses the saved snapshot and database. It does not refit the model each time you open the app. Use the printed dashboard URL; custom ports are passed through to the frontend automatically.

Before reinstalling packages with `-Setup`, stop this clone's running frontend with Ctrl+C. Use a regular, clone-local `frontend/node_modules` directory; shared directory junctions can cause native-module lock errors across checkouts.

### After pulling updates

Stop the frontend with Ctrl+C, then:

```powershell
git pull --ff-only origin input-sarimax
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -Setup
```

`-Setup` refreshes dependencies but retains the selected snapshot. If cleaned inputs or forecasting/classification code changed, explicitly rebuild:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -Rebuild -BackendPort 8013
```

A rebuild creates new artifacts and a new database, preserving older snapshots. A different backend port avoids replacing the earlier running service. If that port is occupied too, choose another free one.

## Troubleshooting

- **Port already in use:** close the previous frontend terminal, or choose free ports. For example:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -BackendPort 8014 -FrontendPort 8083
  ```

  The frontend is automatically pointed at the chosen backend. The launcher never terminates an unrelated service. An occupied backend port is accepted only for a ready local HealthWatch snapshot with the same run ID.
- **Python 3.12 not found:** install it, reopen PowerShell, and check `py -3.12 --version`.
- **EPERM/unlink on Lightning CSS:** close running HealthWatch frontend terminals and retry setup. If Windows still holds the native file open, restart Windows and run setup before starting dev servers. Each clone should install its own dependencies.
- **Dependency installation failed:** check `node --version` and `py -3.12 --version`, then rerun `-Setup`. The launcher stops on failed commands.
- **Missing/corrupt snapshot:** use `-Rebuild` with a free backend port. Do not edit generated artifacts or remove their verification checks.
- **Dashboard cannot load data:** open `/health` on the chosen backend port. It must report `data_ready: true` and the selected `snapshot_run_id`. Inspect `api_start_err.log` in the repository root if startup fails.
- **Thousands of files in Source Control:** installed environments and packages belong on each member's computer, not in a commit. Pull the updated `.gitignore`. If you already staged such files, unstage those paths first. Ignore rules do not untrack files already committed; do not use `git add .` to resolve this.

Existing manually created SARIMAX runs remain available. The launcher creates its own saved selection on first setup; advanced reuse of an earlier verified run is described in [SARIMAX_SWITCH.md](docs/SARIMAX_SWITCH.md).

## What belongs in Git

Commit source code, documentation, scripts, dependency manifests/lockfiles, approved cleaned inputs, and intentional research evidence. Do not commit `.venv*`, `node_modules`, build output, credentials, logs, local SQLite databases, or generated local runs. The launcher saves all run artifacts, databases, and its selected snapshot state under ignored `data/local/`.

## Model and data

- SARIMAX `(1,0,0) x (1,0,0,12)`, constant trend, deterministic June-November wet indicator, and a non-negativity floor.
- Six main diseases: Dengue, Acute Bloody Diarrhea, Cholera, Typhoid Fever, Influenza-like Illness, and Leptospirosis.
- ILI uses numeric reported cases after header correction. Leptospirosis counts eligible S/P/C-coded reported records; it does not use numeric weights or deaths as case counts.
- Hepatitis A remains provisional/supplementary. Heat is annual reference-only.
- Approved cleaned monthly inputs are in `data/cleaned/`. Missing observations remain missing. Main-series modeling cutoff: August 2026; Hep A ends September 2025.
- Forecast intervals are uncalibrated 80% model intervals. Operational monthly-refit results are separate from fixed-origin CV2022-2024 and TEST2025 research results.

## Verify changes

From the repository root after setup:

```powershell
& .\.venv-sarimax\Scripts\python.exe -m unittest discover -s tests -v
cd frontend
npx tsc --noEmit
npm run build
npm run lint
```

Check all six diseases, forecast provenance, hotspot/outbreak views, rankings, and CSV/PDF exports in the browser. See [execution evidence and remaining limitations](docs/SARIMAX_SWITCH_RESULTS.md), including the archived CV replay difference and previously unverified frontend build/lint. This launcher is Windows PowerShell code; its end-to-end execution still needs confirmation on a member's Windows machine.

## Structure and deployment

| Path | Purpose |
|---|---|
| `src/` | FastAPI backend, SARIMAX pipeline, classification, validation, database loading |
| `frontend/` | React/Vite dashboard |
| `data/cleaned/` | Approved monthly inputs and provenance |
| `data/local/` | Ignored local snapshots, databases, and launcher state |
| `data/processed/` | Legacy artifacts; not the new launcher's active snapshot |
| `docs/SARIMAX_SWITCH.md` | Model settings, advanced reproduction, publication, rollback |

Pulling or starting this branch changes your local app only. Shared database publication, merging, and hosted deployment are separate actions; the launcher uses explicit local SQLite targets.
