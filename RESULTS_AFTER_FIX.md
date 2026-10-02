# Results After Fix

Command-backed record of the five correction tasks, what changed, what the
numbers now say, and what is still open. Every figure below was produced by the
command shown beside it. No source row, processed CSV row or database record was
deleted; see [Data integrity](#1-data-integrity).

Reproduce the fast checks:

```powershell
.venv\Scripts\python -m tests.test_validation_windows   # 8/8
.venv\Scripts\python -m tests.test_validation_pools     # 9/9
.venv\Scripts\python -m tests.test_data_window          # 8/8
```

---

## 1. Data integrity

The corrections change **what the models read**, never **what is stored**.

| Artifact | Command | Rows | Note |
|---|---|---|---|
| `regional_dengue_monthly.csv` | row count | 1,656 | 2019-01…2026-08, unchanged |
| `regional_fwbd_monthly.csv` | row count | 6,821 | 2018-01…2026-09, unchanged |
| `national_monthly.csv` | row count | 92 | unchanged |
| `national_fwbd_monthly.csv` | row count | 408 | unchanged |
| `dengue_case_records` (Postgres) | `SELECT count(*)` | 749,683 | preserved |
| `fwbd_case_records` (Postgres) | `SELECT count(*)` | 179,034 | preserved |
| `monthly_observations` (Postgres) | `SELECT count(*)` | 8,977 | includes the partial month |
| `_archive_pre_task1/` | `Get-ChildItem` | 25 files | pre-correction snapshots |

1,656 + 6,821 + 92 + 408 = **8,977**, matching the database table exactly.

The compute loader returns 8,149 rows, and the 828-row difference is fully
accounted for:

- **784 rows** dated before `2019-01-01` (the FWD files carry 2018 history; 736
  regional + 48 national). Excluded by `DATA_START` so the training calendar is
  uniform.
- **44 rows** in the partial `2026-09` month (41 regional + 3 national). These
  remain physically present in both the CSVs and Postgres.

```
$ .venv\Scripts\python -c "from src.ingest import load_monthly_series; ..."
compute rows: 8149  max date: 2026-08-01
rows after 2026-08-01: 0
```

`/status` reports the distinction rather than hiding it:
`data_through = 2026-08-01` (served history) and
`pipeline_data_through = 2026-09-01` (raw data on disk).

---

## 2. Task 1 — validation windows were wrong

### The defect

`forecast._split_index` chose the holdout boundary wrongly, so the "training"
portion of each window included part of the period it was scored on. Every
reported error was therefore optimistic in an unquantified way, and the bias
differed per disease because it depended on where the boundary landed.

### The fix

`_split_index` now starts the holdout at the first month strictly after the
cutoff, and the full-window guard is applied in `walk_forward_validation`,
`naive_scores` and the ablation validation/naive paths. Series that cannot fill
a window are recorded through `_skip_reason()` rather than silently dropped.

### Before → after

`2025_prospective` (train ≤ 2024-12, score 2025-01…2025-12):

| Disease | n | MAE | RMSE | MAPE | Skill % | Tier acc % |
|---|---|---|---|---|---|---|
| Dengue | 19 | 1867.4 → **1843.2** | 2509.2 → **2294.8** | 64.4 → 119.4 | −15.4 → **12.5** | 34.7 → **39.9** |
| Acute Bloody Diarrhea | 19 | 34.9 → **44.8** | 41.3 → **51.7** | 69.3 → 118.2 | 26.9 → **8.9** | 44.3 → **55.3** |
| Cholera | 16 → **15** | 34.4 → **23.6** | 37.1 → **25.7** | 162.0 → 311.5 | 13.4 → **−5.6** | 50.5 → **63.9** |
| Typhoid Fever | 19 | 84.4 → **92.5** | 96.6 → **112.0** | 39.0 → 109.0 | 6.1 → **3.0** | 46.9 → **50.0** |

`last_12m` (train ≤ 2025-08, score 2025-09…2026-08):

| Disease | n | MAE | RMSE | MAPE | Skill % | Tier acc % |
|---|---|---|---|---|---|---|
| Dengue | 19 | 1926.4 → **1317.6** | 2393.6 → **1682.2** | 83.1 → 115.8 | 1.6 → **6.6** | 47.4 → **39.9** |
| Acute Bloody Diarrhea | 19 → **18** | 40.4 → **30.2** | 47.0 → **38.5** | 62.4 → 129.7 | 16.1 → **20.4** | 51.8 → **56.9** |
| Cholera | 17 → **13** | 26.7 → **23.0** | 29.8 → **26.7** | 177.3 → 425.6 | −5.9 → **−10.6** | 59.8 → **62.2** |
| Typhoid Fever | 19 | 67.8 → **102.4** | 81.2 → **122.3** | 39.8 → 150.1 | 15.2 → **5.3** | 60.1 → **40.3** |

Two honest consequences:

- **MAPE roughly doubles for the sparse FWD diseases.** That is not a
  regression; it is the first unbiased reading. A month with 1–3 cases makes
  any percentage error explosive. MAPE stays in the report as a secondary
  metric with that caveat, not as a headline.
- **Cholera's `last_12m` n falls 17 → 13** and Acute Viral Hepatitis has **no
  eligible window at all**: its history is too short to fill the window, and it
  is now recorded in `forecast_skips.csv` instead of contributing a partial,
  flattering score.

Outputs: `validation_predictions.csv` 1,692 rows, `validation_metrics.csv` 141
rows, `season_probes.csv` 564 rows.

**Not a data change:** the committed pre-Task-1 `forecasts.csv` disagreed with a
fresh fit in 135 of 1,128 tier assignments. That was pre-existing artifact/code
skew, surfaced by regenerating; no rows were removed to hide it.

---

## 3. Task 2 — the 2025 validation leaked its holdout

### The defect

`validate_2025.validate()` read the production `outbreak_indicators.csv` to build
its P75 pool, and that pool was computed from the full baseline including 2025 —
the year being scored. The evaluator was reading the answer.

### The fix

`validation_pool_indicators()` now truncates at `HISTORY_END` behind a hard
cutoff assertion, and `validate()` builds its own pool from
`validation_thresholds.csv` with `probe_anchor` in the join key. The same fix
was applied to `sensitivity._validate_2025_under`.

### Before → after

Combined across five diseases, 174 validated region-seasons:

| | TP | FP | FN | TN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|
| Leaky (as shipped) | 38 | 34 | 60 | 42 | 0.530 | 0.388 | 0.450 |
| **Correct** | **47** | **34** | **51** | **42** | **0.580** | **0.480** | **0.525** |

Removing the leak made recall *better*, which is counter-intuitive and worth
stating plainly: the leaked thresholds were derived from the holdout year
itself, so they moved with the very series they were scoring and added noise
rather than signal. 13 of 188 predicted flags and 13 of 174 validated rows were
affected, and **907 of 1,139 P75 values changed** — the differences run in both
directions, so this is not a uniform shift that could be absorbed by an offset.

Per-disease (correct):

| Disease | n | TP | FP | FN | TN | F1 |
|---|---|---|---|---|---|---|
| Dengue | 38 | 7 | 13 | 13 | 5 | 0.350 |
| Acute Bloody Diarrhea | 38 | 9 | 4 | 16 | 9 | 0.474 |
| Cholera | 35 | 12 | 6 | 3 | 14 | 0.727 |
| Typhoid Fever | 38 | 15 | 7 | 8 | 8 | 0.667 |
| Acute Viral Hepatitis | 25 | 4 | 4 | 11 | 6 | 0.348 |

Type II climate-calendar sensitivity now covers all five diseases. 8 of 188
flags flip; the override scores TP 48 / FP 33 / FN 50 / TN 43, F1 **0.536**
versus 0.525 national-calendar.

---

## 4. Task 3 — partial month, shared horizon, stale-series ledger

`src/config.py` is now the single source of truth:
`DATA_START=2019-01-01`, `DATA_END_MONTH_START=2026-08-01`, `DATA_END=2026-08-31`,
`trim_to_data_end()`.

- The partial in-progress reporting month is excluded **at compute time only**.
  The 44 rows stay in the CSVs and in Postgres (§1).
- All series forecast on **one shared calendar, 2026-09-01…2027-08-01**,
  replacing per-series start dates. `/dashboard` now serves 104 points per
  series (92 observed + 12 forecast) on an identical calendar.
- Series whose last observation is more than 12 months stale are skipped and
  **recorded in `data/processed/forecast_skips.csv` (9 rows)** rather than
  forecast from a stale anchor:

| Disease | Region | Stale months | Reason |
|---|---|---|---|
| Acute Viral Hepatitis | BARMM | 39 | stale |
| Acute Viral Hepatitis | MIMAROPA | 33 | stale |
| Acute Viral Hepatitis | Cagayan Valley | 31 | stale |
| Acute Viral Hepatitis | Bicol | 30 | stale |
| Acute Viral Hepatitis | Ilocos | 30 | stale |
| Acute Viral Hepatitis | Caraga | 15 | stale |
| Acute Viral Hepatitis | NIR | 19 | history too short |
| Cholera | MIMAROPA | 24 | stale |
| Cholera | Cagayan Valley | 16 | stale |

Full pipeline output row counts after the rerun:

| File | Rows |
|---|---|
| `forecasts.csv` | 1,032 (86 series × 12) |
| `risk_classification.csv` | 1,032 |
| `risk_escalation_ranking.csv` | 86 |
| `risk_thresholds.csv` | 1,140 |
| `outbreak_indicators.csv` | 188 |
| `outbreak_validation_2025.csv` | 174 |
| `season_probes.csv` | 564 |
| `sensitivity_type2_flags.csv` | 188 |

---

## 5. Task 4 — API thresholds, tier basis, escalation table

`/dashboard` now carries a `thresholds` block (region code + name × calendar
month × P50/P75). Live check:

```
$ GET /dashboard?disease=Dengue
thresholds = 228   regions = 19   months = 12   p75 < p50 = 0   negative p50 = 0
calendar = 2019-01 … 2027-08 (104 points, identical across all 18 series)
```

`/escalation` returns a ranked tier-climb ordering per disease, and the counts
sum to the 86 forecast series:

| Disease | Regions |
|---|---|
| Dengue | 19 |
| Acute Bloody Diarrhea | 19 |
| Typhoid Fever | 19 |
| Cholera | 17 |
| Acute Viral Hepatitis | 12 |

Frontend: `TierBasis` (`hotspot` \| `burden`) replaces the dead
`DataLayer` control, wired through the map fills, `ForecastCard`, the mobile
bottom sheet, `ClassificationInfo`, the seasonality export and the PDF report
(`Tier basis` label). A new `EscalationTable` sits on the Compare page.
"Hotspot" compares against the region's own seasonal P75; "Relative burden"
compares against a pooled national per-100k yardstick. When the pooled
fallback is used, the UI says so rather than silently substituting.

The CSV export was also internally inconsistent and is now fixed: it computed
month-point tiers from the legacy `getThresholds()` (a **national pooled**
distribution that ignores the region) while the region cards next to it came from
`assessRegion()` (the region's own percentile) — two different yardsticks in one
file, neither user-visible. `ExportCustomizationModal` now takes a `basis` prop,
routes every tier through `resolveThresholds()`, and Compare derives
`tierBasis` once and passes it to the map, the explanation panel and the export,
so the screen and the CSV cannot disagree. Every CSV gained a `tier_basis`
column, making the yardstick self-describing after the fact.

Gates: `npx tsc --noEmit` **pass**, `npm run lint` **0 errors** (8 pre-existing
warnings), `npm run build` **pass**.

### Defect found and fixed in this task — unit-unsafe tiers

The tier basis was wired but **not unit-correct**. I flagged this rather than
closing it, then fixed it after the decision was made:

- `risk_thresholds` stores **raw case counts**, but the map's active metric mode
  defaults to **per-capita**, so "Hotspot" tiers compared a per-100k value
  against a raw-count threshold.
- The burden label was "Relative burden (national per-100k)" but was not
  enforced: selecting it in raw mode compared raw counts and still printed
  "per-100k".

**Decision taken:** convert the regional thresholds into the active unit rather
than pinning the basis to its own units. Hotspot tiers must stay mode-agnostic —
P50/P75 of a region's own history is a *within-region* statistic, so it means
the same thing at any unit.

`resolveThresholds()` gained a `toMetric()` conversion applied to the hotspot
P50/P75 whenever the active mode is per-capita, dividing by the region's
population. Raw mode is a pass-through, so the pipeline yardstick is unchanged.
A missing or invalid population returns to pooled fallback rather than dividing
by zero.

**Measured effect.** For Dengue, comparing the last observed month (2026-08)
per-capita against the raw thresholds, then against the fixed behaviour:

| metric | before fix | after fix |
|---|---|---|
| regions tiered | 18 | 18 |
| **mis-tiered vs raw-unit truth** | **11** | **0** |
| tiers rendered Low (green) | 11 | 0 |

Three regions that were showing green **Low** are correctly **High**:
Region IV-B, Region VII, Region XI. The remaining eight move to **Moderate**.
Checked at the first forecast month (2026-09) as well: **0 of 18** mismatches.

The verification compares the per-capita tier against the *raw-unit* tier
computed directly from raw cases — a unit-invariant reference. Per-capita and
raw modes now agree for every region, which is the property hotspot was
supposed to have.

### Also fixed in this task

- `pooled=true` no longer means "a burden basis was requested". An explicit
  burden basis is the pooled distribution, not a substitute, so it returns
  `pooled=false` and `pooledFallback` is only ever true for a hotspot fallback.
  `PooledFallbackReason` now distinguishes `all_illnesses` (a sum of five
  unrelated case scales has no percentile) from `no_threshold_row`, so
  `ClassificationInfo` prints the reason it actually fell back instead of
  guessing from the basis.
- The two remaining basis-less call sites were passing the default basis and
  silently tiering by hotspot: the Compare page's **detailed card modal**
  (the table showed burden while the modal showed hotspot) and the
  seasonality page's PDF basis label, which is now derived from the resolved
  object rather than a hand-written `illness === "all"` ternary.
- The burden copy is now **"Relative burden (national distribution)"**. It
  states the distribution being compared without asserting a unit the
  underlying yardstick may not use.

---

## 6. Task 5

### 5a — 2019 consistency check renamed

`src/validate_known_epidemic.py` → `src/validate_2019_consistency.py`, output
`consistency_check_2019.csv`. The legacy `known_epidemic_check.csv` is
**preserved**, not deleted.

The module and paper now state plainly that this check is **in-sample, not an
independent validation**, because the P50/P75 pool contains the twelve months it
labels. It establishes that the deployed rule responds to the documented 2019
epidemic (Jul–Oct 2019 all High; 10 of 12 months High overall). The weekly
fixture claim was removed — the 2019 line-list carries no pre-2019 weeks, so no
7-of-7 weekly check exists.

### 5b — the ablation result **reversed** (most consequential finding)

`src/ablation.py` gained a `disease` column and `--disease` filter:

```
.venv\Scripts\python -m src.ablation --disease Dengue    # 1,425 Prophet fits
```

Nationwide means over the 19 dengue series, on the corrected windows:

| Config | Seasonal channels | MAE 2025 | RMSE 2025 | MAPE 2025 | MAE last_12m | RMSE last_12m | MAPE last_12m |
|---|---|---|---|---|---|---|---|
| A | yearly Fourier only | 1963.60 | 2844.92 | 131.44 | 1100.81 | 1421.61 | 96.33 |
| **B (deployed)** | wet step only | 1843.22 | **2294.81** | 119.41 | 1317.60 | 1682.17 | 115.82 |
| C | both | **1708.52** | 2556.83 | **101.75** | **989.54** | **1291.78** | **79.91** |

Per-region MAE wins: C best in **12/19** regions on `2025_prospective` and
**10/19** on `last_12m` (strict pairwise). The old shipped result had B
dominating on every metric, with A 2382.09 / B 1715.84 / C 2072.37.

**Config C — the configuration this pipeline rejected — is now the best on MAE
and MAPE in both windows.** B keeps the lowest RMSE. The earlier ordering was an
artifact of the Task 1 window bug, so the stated justification for shipping B
no longer holds.

**I did not switch the shipped model.** Doing so would rewrite every forecast,
threshold, classification and escalation row in the released artifacts, which is
a modelling decision rather than a defect fix. The objection that motivated B is
also still unresolved: the wet-step/Fourier collinearity is unchanged
(projected R² = 1.0, joint condition number ≈ 6.1e16), so in C the two seasonal
channels are not separately identified and its lower error cannot be cleanly
attributed to an extra seasonal effect rather than to that non-identifiability.
C also produces the highest mean predicted volume (3663.26 vs B's 3119.31 on
`2025_prospective`), consistent with that reading.

I corrected the now-false claims this reversal invalidated — in `src/forecast.py`
(module docstring), `src/ablation.py` (which had also mislabelled C as the
deployed config; the deployed default is B), `PAPER.md` §3.5.1 and the
methodology page — and recorded the reversal as open work rather than deleting
the original result. **This needs an explicit decision from you.**

### 5c — narrative corpus regeneration: **blocked by provider quota**

Not complete. The corpus needs 1,015 rows (9 surfaces × 5 diseases × region
keying). The file held 20 before this run; at the last check it held **91** and
a resumable background run is still banking rows whenever quota frees. Treat
every count here as a snapshot, not a total.

```
$ .venv\Scripts\python -m src.generate_narratives --dry-run
Already have: 20   To generate: 995
$ .venv\Scripts\python -m src.generate_narratives --force
[80/1015] rate limited
RateLimitError: Rate limit reached for model `openai/gpt-oss-120b` ...
  on tokens per day (TPD): Limit 200000, Used 199996, Requested 1536
```

The Groq free tier caps at **200,000 tokens/day**; each narrative costs ~1,500,
so roughly 130 narratives/day are obtainable and the remaining 943 need about a
week of quota. `OPENAI_API_KEY`, the configured fallback provider, is absent
from `.env`, so there is no second provider to fail over to. I stopped the
background run rather than let it hold the corpus open, and **I will not
fabricate narratives to fill the gap**.

**State at the end of this session: 72 rows, all unique keys, all clean.**

```
$ .venv\Scripts\python -m src.generate_narratives --dry-run
Already have: 72    To generate: 943      # 72 + 943 = 1015
```

0 empty narratives, 0 with `fallback_fired=true`, 61 written by
`groq:openai/gpt-oss-120b` and 11 by `groq:openai/gpt-oss-20b`. Surfaces render
their deterministic fallback for every missing key, so the dashboard is
coherent — just less narrated than intended.

### Duplicate-key defect found and fixed here

The corpus held **92 rows but only 72 unique keys** — 20 keys appeared twice.
The generator appends, so a re-generated key writes a new row *beside* the old
one instead of replacing it, and `--force` ignores existing rows without
truncating them.

This was not cosmetic. `existing_keys()` returns a *set*, so a duplicated key
counts as present and a **resumed run would skip it permanently**, leaving the
stale text in the corpus forever while the newer row it had already paid for
sat unused in the file. `src.db` was deduplicating on the key, which is why the
database showed 72 while the CSV showed 92.

`load_existing()` now drops duplicate keys keeping the **last** occurrence, and
the corpus file was rewritten to 72 unique rows. `src.db` and the CSV now agree,
and `--dry-run` correctly reports 72 + 943.

To finish, after quota resets or with `OPENAI_API_KEY` set:

```powershell
.venv\Scripts\python -m src.generate_narratives          # resumable
.venv\Scripts\python -m src.validate_narratives          # fidelity audit
.venv\Scripts\python -m src.db                           # sync corpus to Postgres
```

`src.db` has been rerun against the deduplicated corpus, so the database and the
CSV agree right now. **Rerun it again once the corpus is complete** so the
database reflects all 1,015 rows. Every other table is current and verified
(749,683 / 179,034 / 8,977 / 1,032 / 86 / 1,140 / 188 / 174 / 141 / 1,692).

### 5d — documentation reconciled

Corrected across `README.md`, `PAPER.md`, `AGENTS.md`, `SYSTEM_REQUIREMENTS.md`,
`update-data.ps1` and the methodology page: the stale 0.316/0.300/0.308
validation metrics, the "55 observed months / 3 yearly cycles" claim (now 92
months / 7 cycles), the removed weekly-fixture claim, the "~55 months" Prophet
section, the database table list, and the false "Fourier scored worse" claim.

The README table list named three tables (`seasonal_classification`,
`seasonal_thresholds`, `tier_accuracy`) that **do not exist in Postgres** — they
are CSV-only artifacts. Verified against `src.db.metadata` (14 tables) and
corrected; the count of 14 is right, the contents were not.

### 5e — this document

---

## 7. Verification summary

| Check | Command | Result |
|---|---|---|
| Validation-window tests | `python -m tests.test_validation_windows` | **8/8** |
| Leakage-pool tests | `python -m tests.test_validation_pools` | **9/9** |
| Data-window tests | `python -m tests.test_data_window` | **8/8** |
| Type check | `npx tsc --noEmit` | **pass** |
| Lint | `npm run lint` | **0 errors**, 8 pre-existing warnings |
| Build | `npm run build` | **pass** |
| API status | `GET /status` | `data_through=2026-08`, `pipeline_data_through=2026-09` |
| API thresholds | `GET /dashboard?disease=Dengue` | 228 rows, 19×12, no invalid pairs |
| API escalation | `GET /escalation?disease=…` | 19/19/19/17/12, sums to 86 |
| **Tier unit correctness** | per-capita vs raw-unit reference, 2 months | **0/18 and 0/18 mis-tiered** (was 11/18) |
| **Narrative corpus** | `generate_narratives --dry-run` | 72 unique, 943 to go, 0 empty, 0 fallback |
| **Narrative DB sync** | `src.db` + `GET /narratives` | CSV 72 = DB 72 = API 72 |

### Could not run

- **`impeccable detect`** — the CLI is not installed at the documented path
  (`~/.config/opencode/skills/impeccable/scripts/impeccable.cmd`). The
  design-system check required after UI edits was therefore not performed.
- **Full-corpus narrative generation** — provider quota, §5c. The corpus is
  resumable and consistent, just incomplete.
- **Full five-disease ablation** — only the Dengue sweep was rerun. The
  `--disease` filter is in place; the other four diseases must be rerun before
  the chapter's ablation table claims five-disease coverage.
- **`src/vocabulary.py`** — deliberately untouched pending final paper wording.

## 8. Open items for you

1. **Task 5b: re-decide the deployed seasonal configuration.** The ablation no
   longer selects Config B. Either adopt C, or record a documented reason to keep
   B, or run a discriminating experiment (the collinearity is the obvious
   candidate) that can separate the two channels.
2. **Task 5c: supply quota or a fallback key** to finish the corpus (943 rows).
3. **Install the Impeccable CLI** so the UI check can actually run.
4. **Note the mechanical formatting churn.** `AlertsPanel.tsx`, `KpiCard.tsx`,
   `useBodyScrollLock.ts`, `chartConfig.ts` and `schemas.ts` carried
   **pre-existing** prettier violations and are mechanically reformatted, not
   logically changed — `git diff --ignore-all-space` reports no diff in any of
   them. Reverting them makes `npm run lint` fail again, so they are left fixed.
   `endOfLine` is `auto` because the working copy is CRLF.
