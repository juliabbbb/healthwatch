# HealthWatch UI verification and laptop handoff

Date: 14 November 2026 (Asia/Manila). Branch: `input-sarimax`.
UI sections 01–06 were checked at commit `3d3a344d6c1c97ec671da7f42275a6ec02683b6e`.
GitHub's branch head independently matched that SHA before this verification commit.
This is a partial verification, not production-readiness approval.

## Results

| Check | Result | Evidence or limitation |
|---|---|---|
| Install frontend packages | Passed | Isolated copy of tracked frontend source; `npm install --offline --cache ../npm-cache --no-audit --no-fund`; 472 packages installed. The cache was copied from this laptop, preserving the original installation. |
| `npx tsc --noEmit` | Passed | Full frontend type check in the isolated copy. |
| Backend unittest discovery | Passed | 55 tests; repo `.venv-sarimax/Scripts/python.exe -m unittest discover -s tests -v`. |
| `npm run lint` | Failed | Initial attempt exhausted memory; standalone retry completed with 16,448 errors and 9 warnings, including repository-wide Prettier formatting/CRLF violations. No broad formatting rewrite was attempted. |
| Focused tour behavior lint | Passed | TourOverlay, useTour, useBodyScrollLock and home route, with Prettier disabled: zero errors and zero warnings after the dependency fix. This does not replace the full lint result. |
| `npm run build` | Blocked | Client and SSR builds compiled; final Nitro externals packaging failed with EPERM on `readlink C:/Users/santi`. Production packaging is not verified. |
| Local API snapshot | Passed | `/health`: data_ready true, SQLite, shared_database false, run `sarimax_advisory_final_20261113`; database metadata identifies SARIMAX. Saved artifact manifest verified. |
| Frontend route smoke | Passed | `/`, `/seasonality`, `/compare`, `/methodology` each returned HTTP 200 from the isolated Vite server. This checks HTTP/SSR, not browser interactions. |
| Source scans | Passed | Case-insensitive `heat` and `deep-dive` searches find zero matches in `frontend/src` after renaming an unrelated mobile-content comment. Backend heat reference support is intentionally retained. |
| PDF document render smoke | Passed | Actual SurveillanceReportPDF component rendered a 9,715-byte PDF with a synthetic Dengue fixture. Fixture values are not research results. |
| Responsive and interaction matrix | Pending | Browser connection attempts timed out. No claim is made that the 360/768/1280 layouts, actual export-button flow or focus behavior passed browser verification. |

Logs and isolated test files are in the local scratch folder `../tmp/ui-verification-20261114` (plus `../tmp/final-ui-python-tests.log`). They are not production data or committed deliverables.

## Verification fixes

- Home route: use a stable destructured tour-start callback in the auto-start effect, resolving the effect-dependency warning without re-running the tour every render.
- Mobile sheet: rename an unrelated “Deep-Dive Content” comment so the requested source scan is empty.
- No backend, data, database publication, merge or hosted deployment change was made.

## Recorded UI decisions

- Removed the stale “MODEL VALIDATION (PROPHET)” panel from the region card; validation remains on the methodology page.
- Kept the one-line source-interpretation disclosure for ILI and Leptospirosis. Hep A uses the visible Provisional tag instead.
- No specific unresolved 360px collision has been confirmed, because visual verification is pending. Preventive changes include wrapping illness controls, a two-row narrow timeline, a wrapping sheet summary, wider desktop panels, and the drawer/sheet layout below 1280px. These changes require visual acceptance.
- The old hover registry, inspector overlay, seasonality Explain button and discovery banner were removed.
- Legacy `.hw-explain-*` CSS and the unused CategoryMixBar helper remain deliberately untouched to avoid broad cleanup. No tour imports the old inspector code.

## Open locally on this laptop

Use Windows PowerShell and this edited checkout:

```powershell
cd "C:/Users/santi/OneDrive/Desktop/Documents/ChatGPT/HealthWatch/input-sarimax-work"
git switch input-sarimax
py -3.12 --version
node --version
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1" -Setup
```

Stop existing HealthWatch Vite servers with Ctrl+C before setup to release native dependency locks. Keep this terminal open. The launcher installs dependencies, creates a verified local SARIMAX snapshot and local SQLite database when no launcher snapshot is selected, and starts the API/frontend. It does not publish to Supabase. First-time model generation can take several minutes.

Open http://127.0.0.1:8082 and http://127.0.0.1:8012/health. The health response must show `data_ready: true` and `database: sqlite`.

Later starts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "./start-local.ps1"
```

If those ports are occupied, use `-BackendPort 8014 -FrontendPort 8083` and open the corresponding URLs. If setup reports EPERM unlink on a native node module, close the other HealthWatch dev terminals/VS Code; if still locked, restart Windows and run setup before launching any dev servers.

To inspect the approved input table itself, open `data/cleaned/monthly_observations.csv`. Local forecasts and SQLite databases live under ignored `data/local/`; they are distinct from GitHub source files.

## Verify GitHub synchronization

From the same checkout, after reviewing and committing changes:

```powershell
git status --short
git push github input-sarimax
git fetch github
git rev-parse HEAD
git rev-parse github/input-sarimax
git rev-list --left-right --count HEAD...github/input-sarimax
```

The first command must be empty, both SHAs must match, and the last command must print `0 0`. A clean working tree alone does not prove a push occurred. This checkout's `github` remote points to GitHub; its `origin` points to another local checkout. Do not force-push to resolve divergence. If rejected, fetch and inspect/merge the remote branch before retrying.

## Render handoff

Do the pending browser checks and review the build/lint limitations before a production release. Open a pull request with base `main` and compare `input-sarimax` when ready to merge. This verification has not merged it.

The repository's render.yaml defines:

| Service | Root | Build | Start |
|---|---|---|---|
| healthwatch-ui | frontend | npm ci && npm run build | node .output/server/index.mjs |
| healthwatch-api-xepv | repo root | pip install -r requirements.txt | uvicorn src.api:app --host 0.0.0.0 --port $PORT |

After the reviewed PR is merged, open the UI service in the Render Dashboard. Verify the linked repository/branch (`main` for a main-based release), the root/build/start values above and `VITE_API_URL=https://healthwatch-api-xepv.onrender.com` (or the actual compatible API URL). Use Manual Deploy → Deploy latest commit, or inspect the auto-deploy triggered by the merge. Verify that the Live deployment's SHA matches the merged main SHA. Refresh the deployed app and repeat the browser checklist below.

A source push/deploy does not upload this laptop's SQLite database or publish forecast rows. Backend deployment and data activation require a compatible hosted schema and a separately prepared, verified SARIMAX database. Follow docs/IMPLEMENTATION_WORKFLOW.md and docs/SARIMAX_SWITCH.md for staged schema checks, rollback and reviewed publication. Do not run the local launcher against shared PostgreSQL. Check hosted `/health` and `/status` for readiness and the intended model/run identity; HTTP 200 alone is insufficient.

## Pending browser acceptance

Repeat all items at widths 360, 768 and 1280 in both Healthcare Worker and General Public views:

- Each home visit starts at Welcome; Back/Next/arrows/Enter work; Esc/X exits; replay starts over; the sample region selection is restored.
- Hidden targets are skipped, progress counts exclude them, Tab stays in the tour and focus returns on exit.
- National snapshot lacks the two removed coverage lines, Heat and the empty environmental group; Hep A shows Provisional; illness controls wrap.
- Region content is readable and scrollable; sticky CTA covers no content. Guidance and weather are collapsed. Test Dengue, ILI, Hep A, All and unavailable-forecast series.
- No adjacent panels or controls overlap or force horizontal page scrolling.
- Seasonality has no Explain Mode button; chart AI tools still work separately. Compare and methodology remain usable, with no Heat option.
- Export a normal disease through the actual UI and inspect the downloaded PDF for correct content and absence of Heat references.
