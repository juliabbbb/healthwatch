# Updated developer implementation handoff — local correction branch

> Integration update — 12 November 2026: tested implementation commit `829de47` has now been applied directly to the original repository on `UI-gerald`. All 32 backend tests and frontend type checking passed in this checkout. The original-checkout-unchanged statement below describes the earlier isolated implementation stage. Nothing has been pushed, deployed, or published to the shared database.


Implementation date: 12 November 2026 (Asia/Manila). Branch: fix/handoff-integrity. Base: 0401d28fc7d548e1c4af3e52eb1aa1878cbeeb9c (UI-gerald). The original checkout, Google Doc and shared database were not changed. This is the isolated implementation worktree at HealthWatch/implementation. No push, deployment or shared activation occurred.

## What changed

- Source contracts: explicit hashes/registry; provisional ILI and Hep A; blocked unconfirmed lepto totals; heat annual-only; unknown codes and unavailable deaths; retained duplicate candidates; workbook and retained-row lineage/quarantine tooling.
- Fixed ILI source-index/date alignment, explicit target calendars, seasonal-naive calendar lookup, observed-history eligibility, missing-vs-zero handling, exact 2025 probes, matched past-only thresholds and complete-probe exclusions.
- Fixed window-preserving API keys, zero/undefined F1, finite JSON, disease-scoped regional seasonal validation, explicit run/experiment provenance and National report coverage.
- Added Seasonal Naive/Prophet/SARIMAX/native-WEKA adapters, an offline benchmark module, lossless ARFF export, verified research API and clinical comparison card. Operational Prophet is not automatically replaced.
- Corrected canonical own-region risk, per-capita tier invariance, unavailable/stale-date behavior, contributing sources and aggregate bounds; corrected PDF rules/row risks/context and strict CSV serialization.
- Separated local builds from publication, required explicit DB target, removed silent fallback/startup seeding, and replaced pre-insert drops with one DML transaction. Raw detail seeding also participates in that transaction. SQLite IDs and schema nullability were corrected for local verification.
- Added conservative narration fidelity policy and optional raw/final audit records; removed unsupported client-description promotion. Updated methodology and linked legacy documentation to the authoritative current workflow.

## Actual validation

- 32 backend tests pass, including real HTTP fixtures, unknown-code handling, sparse/gapped targets, exact probes, no-data/zero metrics, raw-count quarantine, semantic misattribution and local rollback.
- Frontend type check and production build pass. Frontend contract tests verify canonical own-region risk, per-capita invariance, no stale substitution, contributor disclosure, population guard and no summed marginal bounds. CSV quotes/newlines/zero/null fixtures reimport correctly.
- Integrated 315 eligible primary/ILI/National disease-region-fold cells, 1,260 model metric rows and 15,120 predictions. All comparable predictions, scores and seasonal outputs reproduce the earlier research exactly (maximum difference zero). Twenty earlier sparse provisional Hep A metric rows are intentionally not promoted into this integration.
- Corrected 2019–2025 monthly dengue, FWBD numeric-count and provisional ILI aggregates match the paper research observed data exactly.
- Corrected operational build completed with exact window/probe dates, finite forecasts and regional-national arithmetic; source status remains conditional. Ten final HTTP checks against the corrected local DB pass.
- Actual local rollback test: after deliberately failing after raw-detail seeding, 9,697 monthly observations, 749,683 dengue rows, 179,034 FWBD rows and the prior run record remain intact. This used disposable SQLite, not PostgreSQL.
- Actual PDF component rendered a five-page synthetic mixed-risk/unavailable/long-label fixture. All pages reviewed; heading-wrap defect corrected and confirmed. It is test data, not surveillance findings.
- Desktop research-card preview displayed real verified four-model results and unavailable leptospirosis. Further browser/responsive/fold-switch checks timed out and are not claimed complete.

## Implementation-only fixes discovered during verification

Sparse windows exposed a missing-MAE progress-format failure and empty-frame date serialization failure. Both were corrected. Thirty already completed operational checkpoints were preserved across the serializer-only fix with original files archived and a migration ledger; no numerical prediction/metric values were edited. A full raw-detail load exposed SQLite BigInteger auto-ID behavior and pandas replacement outside the desired transaction; these were corrected and a late failure/HTTP integration rerun passed. Logs preserve failed and successful attempts.

## Reproduce and integrate

Read IMPLEMENTATION_WORKFLOW.md first. Install runtime/ML requirements in an isolated environment; Java/WEKA is for offline RF only. Run backend tests, frontend data/CSV contracts, type checking/build and actual rendered export fixtures. Use new offline run directories and explicit input/output roots. The local implementation/evidence outputs live beside the checkout in implementation_runs and System_Handoff_Review; they are not automatically copied into data/processed or a shared DB.

The benchmark can serve a verified run only through HEALTHWATCH_RESEARCH_RUN. The operational CSVs and research CSVs have different contracts. Do not use research metrics as a silent replacement for legacy API tables. No production model selection policy was changed. Compare alert recall/F1 as well as forecast error before a future deployment decision.

Schema changes require a reviewed new/staging schema or migration before existing PostgreSQL deployment. create_all does not migrate an existing table. Test publication failure against disposable PostgreSQL, preserve the old snapshot, review typed API/export compatibility, and separately approve activation. No shared target is authorized by these local tests.

## Remaining work and limits

Source-owner confirmation of weekly mapping, ILI headers, Hep A unit/label, lepto dictionaries, case-definition eras and completeness/geography remains external. The application must retain provisional/excluded status. Interval calibration, complete provider semantic/failure corpus, participant comprehension testing and new future-period validation are not completed. Optional sensitivity/ablation reruns and complete device/filter/browser export coverage remain unverified. The acceptance CSV labels partial/not-run items explicitly; 32 unit/integration tests do not mean all 53 original acceptance scenarios have passed.

The Chapters 4–5 PDF is the original separate research snapshot. Its empirical primary/ILI results are reproduced; it was not silently rewritten to imply that this branch is deployed or all objectives operationally accepted. Integrate manuscript changes only with the final agreed evidence state.
