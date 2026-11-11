# HealthWatch Step 2 audit update: FWBD workbook

Audit date: 12 November 2026. Inspected all five sheets in the newly supplied workbook. Source unchanged. This update adds the workbook to the earlier Data.zip audit. The earlier finding that Data.zip contained only FWBD definitions was correct for that archive; the separate workbook now provides four disease sheets.

| Sheet | Data rows | Source Total Cases sum | Observed region labels | First source month | Last source month | Blank cells | Exact duplicate excess |
|---|---:|---:|---:|---|---|---:|---:|
| FWBD ABD | 75,988 | 102,352 | 18 | 2018-01 | 2026-09 | 61 | 23 |
| FWBD Cholera | 13,514 | 25,480 | 18 | 2018-01 | 2026-09 | 0 | 1 |
| FWBD Typhoid | 119,325 | 174,346 | 18 | 2018-01 | 2026-09 | 0 | 0 |
| FWBD Hep A | 1,313 | Unresolved | 18 | 2018-01 | 2025-09 | 217 | 45 |

## Material findings

- ABD, Cholera and Typhoid have a numeric `Total Cases` measure. Sums include all source classifications and all source rows. These are source arithmetic totals, not confirmed eligibility for the research case definition.
- 45,655 `Age Group` cells are Excel dates (ABD 12,524; Cholera 3,530; Typhoid 29,601). Examples include dates such as 2026-05-14. These may be spreadsheet conversion of a label, but the intended age band is unresolved. fwbd_cell_types.csv and categorical_values.csv quantify and preserve the typed values. No conversion to an assumed age group was made.
- Hep A has 175 blank morbidity weeks and 42 blank ages, and ends at September 2025. It has no count column. Its row grain, numeric/NCR region coding and fractional-age encoding need verification. Its row count is not presented as a case total. Outcome codes are not silently converted into deaths.
- The Case Definitions sheet distinguishes old definitions through 2023 and new definitions from 2024 for ABD and Cholera. Assess comparability across that boundary. Typhoid and Acute Viral Hepatitis have empty new-definition cells; applicability must be confirmed, not inferred.
- Coverage uses actual `Morbidity Month` values. Weeks are also audited separately without assuming an ISO or PIDSR calendar. A year/week may span more than one supplied month; this is flagged, not automatically corrected. Absent periods remain absent, not zero.
- Exact duplicates are retained for source review. Excel blank cells and whitespace are counted as blanks. Literal N/A and UNKNOWN remain source categories. No date, region, case-definition or death-code assumptions were introduced.
- The earlier unresolved ILI and mixed leptospirosis layouts remain unresolved. Their prior counts and flags are retained.

38 new monthly spike flags were identified (ABD 8, Cholera 26, Typhoid 4). These are descriptive review candidates, not confirmed errors. No negative or zero Total Cases values were found in those three sheets.

## Updated files

The combined data_audit.csv, dataset_inventory.csv, column_audit.csv, regional_coverage.csv, observed_periods.csv, categorical_values.csv, anomaly_flags.csv and schema_and_quality_issues.csv now include the new workbook sheets. Inventory contains one row per original archive file or workbook sheet, using sheet names and the workbook SHA-256 to disambiguate shared source files.

fwbd_monthly_coverage.csv adds observed source-month coverage by region/year. fwbd_cell_types.csv records original Excel value types. Weekly spike flags for Dengue/ILI and monthly spike flags for FWBD use the same Q3 + 3 x IQR descriptive rule; the month/week columns identify their different periods. No Hep A case spike screen is asserted.

Read audit_findings.md for the earlier archive audit. This update supersedes its archive-only statement about FWBD availability, while preserving the original evidence and unresolved schemas. Blank audit result cells mean unavailable/not applicable.

Workbook formula elements detected: 0. Numeric Total Cases sums were independently reconciled against original typed worksheet values.
