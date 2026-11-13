# Reported-data display restoration

The original reported counts were already present in the SARIMAX database. Importing the data module and mounting the page gate started duplicate batches of concurrent dashboard requests, each with a 15-second timeout. Live Typhoid and ILI requests took about 15 seconds. Failed illness requests were swallowed and became unavailable caches.

The display now shares one in-flight load, limits dashboard requests to two at a time, allows API cold-start time, and names failed illnesses so users can retry. The API prepares and compresses dashboard responses once per loaded snapshot; reloading invalidates its cache. No reported counts, model inputs, forecasts, database schema or risk thresholds were changed.

The map opens at the latest reported month. Switching to a disease without a value at the selected date moves to its latest reported month and announces the change. Explicit timeline selections retain missing values. Heat (annual) displays the original annual events separately from monthly surveillance.

## Original-source reconciliation

Within January 2019–August 2026, every original source-reported disease/region/month cell matched the approved snapshot. Extra cleaned cells introduced no additional nonzero cases.

| Illness | Original reported total | Reported-cell mismatches |
| --- | ---: | ---: |
| Dengue | 1,954,521 | 0 |
| Acute Bloody Diarrhea | 82,370 | 0 |
| Cholera | 23,333 | 0 |
| Typhoid Fever | 148,563 | 0 |
| Hepatitis A | 963 | 0 |
| Influenza-like Illness | 1,111,974 | 0 |
| Leptospirosis | 29,476 | 0 |

ILI retains the corrected year/week headers. Hepatitis A and Leptospirosis retain their approved provisional record-counting definitions. Reconciliation does not independently confirm source definitions, geography or completeness. Hepatitis A reports end in September 2025. Heat has 43 annual rows covering 2019 and 2023–2026; missing years are not zeros.

## Checks

- Backend: 59 tests passed, including original values, null/zero distinction, repeated compressed responses, cache invalidation and packaged Heat-source fallback.
- Frontend: type checking and production build passed. Run npm run test:data to verify one in-flight batch, bounded concurrency, all illnesses, missing values, dates and recovery.
- Impeccable detection: no findings for changed interface components.
