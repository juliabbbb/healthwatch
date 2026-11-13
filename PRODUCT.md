# HEALTHWATCH product contract

Current analytical and publication authority: `docs/IMPLEMENTATION_WORKFLOW.md` and `docs/SARIMAX_SWITCH.md`.

## Purpose and audience

Regional disease surveillance and forecast exploration for Philippine public-health analysts. Users inspect reported monthly counts, regional seasonal patterns, independently classified disease forecasts and retrospective benchmark results. These outputs support review; they do not establish official outbreak declarations or calibrated outbreak probabilities.

## Model and data

- Operational forecasts use SARIMAX `(1,0,0)x(1,0,0,12)`, a constant and the June–November wet-season flag. The saved horizon is twelve months after each series' training cutoff, not twelve months after the viewer's current date.
- The six main diseases are Dengue, Acute Bloody Diarrhea, Cholera, Typhoid Fever, Influenza-like Illness and Leptospirosis. Hepatitis A remains provisional. Source/calendar and target-unit caveats remain visible; leptospirosis deaths stay excluded.
- Inputs are the approved `data/cleaned` monthly snapshot. Unknown source months stay unknown. National counts sum available regional reports and do not prove complete surveillance coverage.
- Main-disease forecasts cover September 2026–August 2027. Eligible Hepatitis A forecasts cover October 2025–September 2026. No observation or forecast is fabricated beyond its series' actual dates.
- Individual disease bounds are uncalibrated 80% model intervals. PAGASA is advisory only and never modifies the forecasts, risk tiers or outbreak flags.
- The four-model research comparison remains separate from operational forecasts and monthly-refit evaluation. Historical Prophet results may be shown as research or rollback context only.

## Risk and aggregate behavior

- Canonical risk uses the disease's own region/calendar-month P50 and P75: Low below P50, Moderate from P50 through P75, High above P75. Changing raw counts to per 100,000 scales the value and thresholds equally without changing its tier.
- Cross-region percentile is a separate descriptive burden comparison.
- Missing observations, forecasts or thresholds are unavailable, not zero or Low.
- All Illnesses sums the explicit available primary contributors: Dengue, ABD, Cholera and Typhoid. It does not silently expand to provisional sources. It has no combined risk tier or summed uncertainty interval; the seasonality outlook shows each contributor's tier separately.
- Outbreak Rule A/B results shown by the API are the January–March and July–September 2025 retrospective benchmark, using pre-2025 pools. They are not future seasonal alerts or confirmed official outbreaks.

## Experience and architecture

- Product name: HEALTHWATCH. Tagline: Regional Outbreak Hotspot Map & Forecasts.
- The map supports regional navigation; seasonality, comparisons and methodology explain the underlying series and limitations.
- FastAPI/SQLAlchemy serves saved database artifacts. React/Vite renders the dashboard. Startup does not retrain the model or automatically publish data.
- The local launcher requires a matching verified SARIMAX database/artifact pair. A separate local SQLite snapshot is used for this development workflow; the production target is PostgreSQL. Shared publication and deployment are separate operator actions.
- AI narration is opt-in and must remain grounded in the selected data. Routine verification uses no live AI provider or participant study.

## Design principles

Follow `DESIGN.md`: one coral accent; risk colors reserved for risk data; mono metadata labels; restrained glass panels. Keep labels, units, forecast dates and source/model provenance clear. Do not fabricate unavailable results or describe retrospective evidence as prospective validation.
