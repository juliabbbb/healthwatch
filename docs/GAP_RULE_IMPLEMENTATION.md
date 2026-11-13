# Implemented source rules — 12 November 2026

The approved plan is implemented on UI-gerald and activated **locally** at http://localhost:8080 (API 8000). Shared PostgreSQL, hosted deployment, public source-data sharing and the live Google document were not changed. The previous verified local database and research run are preserved.

## Rules actually applied

- Leptospirosis: one provisional case per retained nonblank source record in every year; S/P/C are labels. 29,476 records remain inside the conditional January 2019–August 2026 calendar. Numeric Cases/Deaths fields remain in lineage and are not added to record counts. Death totals remain unavailable. Legacy leptospirosis aggregates cannot load without the matching new record-count audit.
- Hep A: provisional one-record counting, displayed as Hepatitis A while retaining the internal Acute Viral Hepatitis ID. NIR has only 12 within-bound months and remains below the 24-month requirement.
- FWBD zeros: the user's final rule fills **only interior gaps between existing reports within each region**. Added region-months are ABD 100, Cholera 539, Typhoid 2 and Hep A 806: total 1,447. Added rows preserve zero source-record counts, user-relayed provenance and unknown deaths. No leading/trailing months or ILI/leptospirosis zero months are fabricated. Wider coverage remains unresolved.
- Dates and availability: the study cutoff remains August 2026; older source ends and their twelve-month forecast horizons are preserved. General forecast eligibility is not evidence of a value at every selected date. Observed versus forecast status follows the actual point, including earlier-ending Hep A horizons; mixed national values are labeled Mixed.
- Heat stays annual reference-only. Primary All Illnesses/model selection remains Dengue, ABD, Cholera and Typhoid. Provisional sources do not expand the primary cohort.

## Verified outputs and local activation

Operational: gap-rules-ddb64e035033, data/local/runs/gap-rules-v1. It contains 1,584 forecast rows and 244 evaluation-metric rows, including National. Leptospirosis, Cholera and the other four non-Hep A modeled sources each have 18 regional twelve-point forecasts plus National; Hep A has 17 regional forecasts plus National. The actual end dates differ by series.

Research: research-gap-945fb497f392, data/local/runs/research-gap-v2. Native Seasonal Naive, Prophet, SARIMAX and WEKA Random Forest results comprise 1,920 matched metric rows and 23,040 target-prediction rows. Changed sources were rerun; Dengue/ILI were reused only after exact 2019–2025 source comparisons. All four models share eligible target masks. The primary CV macro MASE ranks SARIMAX 1.206541, WEKA RF 1.358655, Seasonal Naive 1.379930 and Prophet 1.590196. Operational Prophet was **not** replaced.

The active local database is data/local/healthwatch_verified.db. Before replacement it was backed up to data/local/healthwatch_before_gap_rules_20261112.db. Artifact pointers are data/local/active_run.json and active_research.json; startup verifies manifests and matching source-decision hashes. The new monthly fields require a reviewed migration before any existing shared database is updated.

## Application corrections

Availability exposes zero-rule month counts and actual source/forecast bounds. Added zero months return zero cases with unavailable deaths and no fabricated demographic rows. Unsupported record breakdowns remain explicit for ILI/leptospirosis/heat. Hep A/leptospirosis provisional status remains visible. CSV export builders now share a tested schema with observation provenance, actual point dates/types and run identity; this fixes a full-series header/body mismatch and excludes historical points from forecast-only exports. Missing metrics display Unavailable. The forecast card no longer passes verified predictions into the unvalidated weather-multiplier display; weather context does not alter its model counts/intervals.

## Executed checks

- 42 backend tests pass, including retained duplicate candidates, record counts versus numeric fields, cutoff/label handling, interior-only zeros, unknown deaths, source-version audit rejection, new database lineage and existing analytical/publication contracts.
- Frontend type checking, all three actual CSV builder schemas, source-status/data contracts and the production build pass. Existing bundle/config advisories are non-fatal and are not a claim of warning-free tooling.
- Actual new local database and API verified for all seven modeled diseases, matching run identities, 29,476 National leptospirosis records, zero-case demographic behavior and all four model responses. Live queries after activation reproduce the staged state.
- A late rebuild failure was injected after actual dengue/FWBD raw seeding into a disposable SQLite copy. All previous table counts were preserved by rollback; no shared target was contacted.
- Browser checked new leptospirosis regional forecasts, provisional labels, Hep A's unavailable November 2026 and explicit history access, mixed August 2025 national status, and desktop/narrow layouts. Focused browser testing is not a complete device/filter/provider study.
- The revised Chapters 4–5 manuscript and all rendered pages were reviewed. The earlier paper remains preserved; the live Google document was not edited. The workspace Gap_Rules_2026_11_12 folder contains the revised PDF/Markdown, figures and result tables; gap_paper_evidence.json records hashes and run identities.

## Remaining limits

The user-relayed zero convention has no original dated DOH message supplied. Classification evidence does not independently confirm record grain. Weekly calendar/W53, historical geography, broader reporting coverage, leptospirosis mortality and case-definition eras remain unresolved. Heat lacks monthly surveillance. Interval calibration, independent future testing, live provider semantic-fidelity and participant comprehension are not established. Shared database credentials/schema validation and hosted activation remain separate. The original src/features.py user edit was preserved.
