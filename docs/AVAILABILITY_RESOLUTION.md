# Disease availability resolution — 12 November 2026

Implemented directly in the original repository on UI-gerald. The active local API serves verified operational run **operational-ili-a78819fcd460** from data/local/runs/provisional-ili-v1. Local SQLite publication and restart were explicit; the previous database is backed up. No shared database publication, hosted deployment, source-owner communication or manuscript revision was performed.

## Working locally

- **ILI:** Provisional operational Prophet forecasts now exist for 18 regions plus National: 228 forecast rows, 38 evaluation-metric rows, 456 evaluation-prediction rows and 114 exact-2025 probe rows. Header reversal, ISO-Thursday dates and week-53 folding remain unconfirmed. The dashboard and export provenance retain this status. Enabling ILI does not expand the primary All Illnesses cohort (Dengue, ABD, Cholera, Typhoid) or change the primary research model-selection cohort.
- **Regional availability:** GET /availability and /dashboard expose observed-month counts, real first/last dates, forecast bounds, source status, and a reason when forecasts are unavailable. Observed zeros count as observations; missing reports do not. Source status comes from the source policy, separately from model capability. A failed request is distinguishable from a zero-case report.
- **History access:** The Forecast card explains unavailable dates and offers an explicit latest-history button. Selecting a disease/region does not silently change the requested month. Missing values, rank and trend are unavailable. Forecast KPIs identify the actual target month. Missing risk does not produce a baseline protocol, and the existing dengue-specific clinical protocol is restricted to dengue.
- **Heat:** Annual tables are visible in region details. Corrected Roman-numeral-to-region mapping (including IV-A, IV-B, VIII and NIR) preserves the source's 43 rows, 113 events, 1,275 cases and 20 deaths. Region-code filters were checked against NCR (226 cases), CALABARZON (58) and Eastern Visayas (66). No monthly counts, risk tiers or forecasts are manufactured.
- **Unsupported raw breakdowns:** ILI, leptospirosis and heat return a clear unsupported-demographic-breakdown response instead of querying the FWBD line-list as though no records existed.
- **Startup:** The local launcher verifies selected artifact hashes and checks the database run identity; data/local/active_run.json selects the matching local reference artifacts. The frontend launcher now starts explicitly on 5173, rejects occupied-port substitution and waits for HTTP readiness. The configured remote connection remains separate.

## Cholera exclusions are data limitations

| Region | Observed months | Additional observed months needed for 24 | First–last supplied month |
|---|---:|---:|---|
| Cagayan Valley | 12 | 12 | Nov 2022–Apr 2025 |
| Ilocos Region | 8 | 16 | Oct 2022–Aug 2026 |
| MIMAROPA | 11 | 13 | Sep 2019–Aug 2024 |

These counts use non-null supplied observations through August 2026, not the number of positions between endpoints. The internal spans contain 18, 39 and 49 months without supplied reports respectively. They do not establish zeros or complete reporting. See cholera_eligibility.csv and cholera_reporting_gaps.csv. Request explicit missing/zero reports and a reporting-completeness statement; do not lower the protocol threshold to make a forecast appear.

## Verification actually performed

- 36 backend unit/integration tests pass, including availability, provisional/excluded source gates, actual heat totals/mapping, finite JSON and HTTP breakdown behavior.
- Frontend type check, data contracts and production build pass. CSV fixture independently reimported: quoting/newlines, real zero and unavailable value preserved. Rendered and visually checked all five pages of the actual surveillance-export QA fixture; unavailable rank/trend renders as Unavailable and extracted text contains no NaN. Build retains existing bundle-size and configuration-advisory warnings.
- Actual new local database: all 18 ILI region forecasts, exact 12-row regional horizons, source flags, the three Cholera exclusions, all restricted sources, heat totals/region filters, unsupported demographics and the verified four-model research endpoint checked. Live HTTP after restart confirms the matching run and populated ILI availability; frontend HTTP responds on 5173.
- Source-derived primary forecast/probe/metric/evaluation/exclusion rows were preserved (ili_extension_preservation.csv); this extension did not refit or substitute the four primary disease forecasts. Derived classifications and seasonal outputs were regenerated and the build was verified/sealed. Research results remain a separate unchanged experiment; WEKA was not rerun for this availability change.
- Browser preview used actual local data and the actual AvailabilityNotice/HeatReferencePanel at 440px and 340px card widths. Checked the explicit history action: Ilocos Cholera changed from unavailable September 2026 to reported August 2026 (1 case) only on click. This is focused component verification, not full mobile-device/all-browser acceptance. Subsequent missing-rank/trend and clinical-display guards received type/build/contract checks.

Machine-readable API evidence: availability_verification.json. Local build logs and databases are ignored, not committed datasets. Use python -m src.extend_ili --baseline <verified-operational-run> --output <new-directory> --workers 4 to reproduce the extension from a verified baseline; a new directory is mandatory.

## Work requiring external evidence or later activation

Hep A remains provisional historical row counts with forecasts disabled. Leptospirosis case totals remain excluded until year-specific schemas are confirmed. Heat remains annual-only. SOURCE_CLARIFICATION_REQUEST.md is ready for the team to send; it has not been sent. Confirmation must produce a dated source reference and a new versioned build if interpretations change.

The configured Supabase tenant/user connection still needs correction by the project owner. Validate the current connection and schema on an explicitly selected staging target, publish the verified run transactionally with rollback checks, verify all API/UI source states there, and approve hosted activation separately. A code push alone does not populate that database. No credentials were changed or committed. Full clinical-copy review, interval calibration, live AI fidelity and participant studies remain unestablished; this availability fix does not complete those acceptance items.

The user's pre-existing src/features.py whitespace edit is preserved outside this change. See Developer_Implementation_Handoff.md and IMPLEMENTATION_WORKFLOW.md for the wider implementation contract.
