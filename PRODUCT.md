# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are epidemiologists and health officers at Philippine local government
units (LGUs) and the Department of Health (DOH) regional offices. They open HealthWatch
during the monthly surveillance cycle to decide where to position outbreak response
ahead of the season — before cases spike, and with evidence they can defend.

## Product Purpose

HealthWatch turns DOH Epidemiology Bureau monthly dengue surveillance into a per-region,
per-month risk outlook for the Philippines: where risk is climbing, when a region is
moving toward an outbreak, and which regions need response attention this season.

## Positioning

A prospective, evidence-driven outbreak outlook rather than a reactive case tracker.
The signal is a season-level outbreak indicator for the upcoming dry and wet windows,
grounded in percentile-based risk tiers and a Prophet forecast that was validated on a
held-out real-data year — a claim a reactive dashboard cannot make.

## Operating Context

- Monthly review rhythm: users scrub across 2022–2026 observed months plus the 12-month
  forecast horizon, per region and per metric (trend, density/hotspot).
- The map is the primary navigation: 18 regions (including NIR) colored by risk tier,
  with region pages, an active-alert panel, a national snapshot, and a methodology view.
- Runs as a FastAPI backend (PostgreSQL / SQLite) + a React dashboard, deployed to Render,
  opened in a browser on desktop and mobile tiers.

## Capabilities and Constraints

- **Dengue only for this release.** The schema is disease-agnostic and other illnesses
  are deliberately deferred; the UI must not imply broader disease coverage.
- Prediction is **Prophet only**, monthly (`freq="MS"`), with a 12-month horizon.
- National series is derived as the sum of the 18 regions — never raw.
- Risk tiers are percentile-based per region-month (< P50 Low · P50–75 Moderate · > P75 High).
- Outbreak indicator: Rule A (≥ 3 consecutive High months in the probe window) or Rule B
  (upcoming season forecast average > seasonal P75). Validated on the 2025 prospective
  year: precision 0.43, recall 0.68, F1 0.53.
- Data: DOH Epidemiology Bureau monthly dengue export, 2022-01 … 2026-08 (56 months),
  shipped in the repo; data-through date 2026-08-01.
- Deterministic post-processing only (non-negativity clipping, dry/wet season regressor).

## Brand Commitments

- Product name: **HEALTHWATCH**; header tagline: **Regional Outbreak Hotspot Map & Forecasts**.
- Official, credible tone: a government/public-health workbench. No fabricated data, no
  marketing feel, nothing that overstates what the validated rules support.

## Evidence on Hand

- `data/raw/` — DOH-Epi-Dengue monthly file (2022–2026) + legacy weekly fixture for the
  2019 known-epidemic check.
- `data/processed/` — cleaned series, forecasts, risk thresholds/classifications,
  outbreak indicators, validation metrics, `healthwatch.db`.
- `frontend/public/geo/ph-regions.geojson` — PSGC region boundaries for the choropleth.
- Validated against the real 2025 year (prospective) and the 2019 epidemic (independent check).
- Absences future work must not fabricate: there are no non-dengue processed datasets,
  no weekly-resolution dashboard data, and no deployment metrics or live users yet.

## Product Principles

1. **Decision-first:** every screen should help an officer see "which regions need response
   attention this season" within a glance, not bury it.
2. **Evidence over assertion:** risk and outbreak signals must remain traceable to data,
   thresholds, and the validated rules; never present inference as fact.
3. **Regional truth at every zoom:** the national view is always the sum of real regions,
   and drill-down never contradicts the map.
4. **Credible calm:** an official, trustworthy tone that earns use in a public-health
   decision room.