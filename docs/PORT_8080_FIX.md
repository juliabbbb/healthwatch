# Local port 8080 data-display fix

The local frontend is **http://localhost:8080**; the verified local backend remains on 8000. The running snapshot is operational-ili-a78819fcd460. The earlier launcher's separate 5173 port was incorrect for this project and has been removed. The duplicate 5173 development server was stopped; the existing HealthWatch 8080 server was restarted using the corrected launcher.

## Causes and corrections

1. The default All view had combined case totals but no declared combined-disease risk threshold. Treating the entire gray map as missing data was misleading. The map now opens on Dengue, which has actual own-region thresholds. All remains a descriptive primary four-disease count, with a clear instruction to select a disease for regional risk tiers. No new combined threshold was invented. Mobile uses a Counts label instead of presenting zero High regions as a combined risk assessment.
2. National totals previously propagated any missing region's NaN through the whole sum. They now sum actual available regional values, show reporting coverage, and remain unavailable when every value is absent. True observed zeros remain values. Per-capita totals retain the full national population denominator and the partial-reporting caveat. Dominant-disease counts likewise do not invent zero cases when no reports or forecasts exist.
3. Multiple Vite configurations shared a dependency cache, and the running app logged missing optimized modules. The app now uses node_modules/.vite-app and contract tests use node_modules/.vite-contracts. The launcher and Vite both strictly select 8080. The compare route's unnecessary default component export was removed to resolve its code-splitting warning.
4. Forecast/report aggregate labels follow the selected period. Risk counts include Unavailable separately. The narrow-screen overview places the aggregate above the risk/dominant cards to keep coverage and values readable.

## Executed verification

- 36 backend tests passed. Frontend type check, data contracts and production build passed. Regression checks cover partial national totals, all-missing totals and absence of invented dominant counts.
- Live API checks for November 2026: Dengue, ABD, Typhoid and provisional ILI have values for 18 regions; Cholera has values for 13. Cholera's available forecast sum is 40.444899357529984 cases, rather than an unavailable national total. This selected-date coverage is distinct from general forecast eligibility; some series have earlier horizons or lack thresholds.
- Browser checked http://localhost:8080: default Dengue shows 18 regions with values, High 13 / Moderate 3 / Low 2 / Unavailable 0. ILI shows 18 regions with values. Cholera displays partial coverage and All explains its descriptive scope. Checked the mobile national overview at 390px and the desktop map. Fresh map, Compare and Seasonality sessions loaded with **zero captured browser runtime errors**. Earlier hot-reload errors occurred while the old development server was being replaced; they were not present in the fresh sessions.
- The backend log contains normal startup information; the frontend retains a non-fatal upstream vite-tsconfig-paths advisory. The build retains its existing bundle-size advisory. These are not runtime failures. The design checker reported no findings for the changed map/card surfaces.

Machine-readable live checks are in port8080_verification.json. The source restrictions remain intentional: Hep A forecasts, unresolved leptospirosis case totals, monthly heat forecasts, and ineligible regional/date combinations must not be enabled simply to remove an Unavailable label. No shared database or hosted deployment was changed, and src/features.py's pre-existing user edit was preserved.

Start the verified local backend plus frontend from the repository root with ./run-dev.ps1, then open http://localhost:8080. Reload an already-open tab once after the development-server restart to discard old module URLs.
