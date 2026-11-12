# HealthWatch Step 2 data audit

Audit date: 12 November 2026. Input: supplied Data.zip. All five actual files inspected. Raw archive unchanged. Counts are source rows, not individual patients. No deduplication, zero filling, column swapping, case reclassification, regional mapping, or monthly aggregation performed.

## Inventory and verified counts

| Dataset | Source data rows | Observed regions | Observed period | Blank cells | Exact duplicate excess |
|---|---:|---:|---|---:|---:|
| Dengue | 749,683 | 18 | 2019-W01 to 2026-W53 | 0 | 0 |
| ILI | 62,490 | 18 | 2018-W01 to 2026-W34 | 0 | 0 |
| Leptospirosis | 30,792 | 18 | 2019-W01 to 2026-W38 | 28,225 | 193 |
| FWBD definitions | 5 | Not applicable | Not applicable | 2 | 0 |
| Heat-related events | 43 | 13 | 2019 to 2026 | 0 | 0 |

FWBD has five physical data rows after its first header: one header-like explanatory row and four disease definitions. It contains no case-count observations. Its period cells are unavailable; references to 2023/2024 describe definition applicability.

ILI's observed period above is a **swapped-header hypothesis**, not a verified date range. Original labels and values remain unchanged. Other weekly periods use source labels, with no assumed ISO/PIDSR calendar. Calendar date minima/maxima and monthly missingness are unavailable until the week convention is confirmed. Heat table heading covers 2018-01-01 to 2026-08-31; actual rows are 2019 and 2023-2026.

## Unresolved interpretations

**ILI:** `Year` contains 1.0 to 53.0, while `Morbidity Week` contains 2018.0 to 2026.0. Confirm whether headers are reversed, the morbidity-week calendar, reporting cutoff and the intended case definition with DOH before converting dates. Numeric `Cases` sums are source-field sums only.

**Leptospirosis:** This has mixed layouts. The 4,252 rows for 2023 have populated `Case Classification` (S/P/C) and numeric `Cases`. Other nonblank years have classification codes under `Cases`, with `Case Classification` blank. `Deaths` is numeric in both layouts. There are 187 entirely blank records, 30,605 nonblank rows and 7 nonblank duplicate excess rows. The total duplicate excess of 193 includes 186 repeated blank records. See leptospirosis_schema_by_year.csv. Do not equate row counts or the numeric `Deaths` sum with case counts or fatalities. Obtain the source column map for each layout, S/P/C meanings, numeric-field definition, row aggregation grain and death encoding. No leptospirosis case or fatality total is asserted.

**Dengue:** `No. of Cases` and `No. of Deaths` are numeric source fields. Classification categories remain separate in source; final inclusion criteria for research have not been selected. There are 1,025 rows labeled 2026-W53. Verify whether W53 is a calendar week, an unknown-week code or another convention, and confirm the source cutoff. No interpretation is assumed. Numeric totals are source arithmetic, not a validated epidemiologic estimate.

**Heat:** 43 annual aggregate rows, 113 reported health events, 1,275 cases and 20 deaths in the table. Deaths are already included in cases. No monthly history or advisory timing is provided. Omitted years mean no reported ESR events according to the PDF, not demonstrated zero population incidence. No synthetic zero rows created.

## Audit methods and limits

- CSVs decoded strictly as UTF-8 with optional BOM; all records parsed with CSV quoting support. Blank = empty or whitespace-only string. Text tokens such as UNKNOWN, NOT DONE, NULL and N/A are counted separately and never silently converted to nulls. column_audit.csv reports all fields, including numeric validity, ranges, sums, negative/zero/fractional values and encoding damage.
- Exact duplicate excess counts rows beyond the first identical full row, using original parsed field strings. Duplicate members count all rows in repeated groups. Repeated dimension keys omit numeric measure fields as documented in data_audit.csv. These are review candidates, not deletion instructions.
- regional_coverage.csv reports each observed region/year's week list and absent interior weeks. Absence versus the dataset's observed weeks is also listed. Neither measure establishes a missing report or a zero case count. No unverified national roster or assumed 52/53-week year is used. Years without any observation are not imputed.
- 202 descriptive spike flags in anomaly_flags.csv: observed region-week case totals exceeding that region's Q3 + 3 x IQR across all observed weeks. Dengue and ILI only; ILI dates remain hypothetical. All source rows retained. Flags may reflect genuine outbreaks, changing surveillance or partial coverage, and are not confirmed errors. No leptospirosis case anomalies computed because its count field is unresolved.
- Geography retains original spellings. U+FFFD replacement characters are counted as source encoding damage, not repaired by guessing. Province/city labels and changing region assignments require a verified crosswalk before comparisons.
- All series require reporting completeness, case definition and end-of-extract verification before Step 3. No dataset is certified forecast-ready by this initial audit.

## Files

- data_audit.csv: dataset-level quality and coverage summary; five inventory items including PDF transcription metrics.
- dataset_inventory.csv: all five source files, SHA-256 hashes, source periods, schemas and preprocessing status.
- column_audit.csv: every original CSV field; blank counts and numeric diagnostics.
- regional_coverage.csv and observed_periods.csv: observed weekly coverage and clearly labeled ILI hypothesis.
- schema_and_quality_issues.csv: unresolved schemas and other limitations.
- categorical_values.csv: complete low-cardinality field distributions, plus year/week/region distributions.
- anomaly_flags.csv: descriptive region-week spike screen.
- heat_events.csv: visually verified transcription of PDF Table 1, with page provenance and merged labels carried down; source category spelling retained.

Empty audit result cells mean unavailable/not applicable, never an inferred zero. Numeric fields named `numeric_sum` in column_audit.csv describe source-column arithmetic only and do not resolve field semantics. All files use UTF-8 BOM for CSV compatibility with Excel.
