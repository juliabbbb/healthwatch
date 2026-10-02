"""Single source of truth for computation bounds across the pipeline.

All modelling is restricted to the 2019-2026 calendar. The FWD line-lists
open earlier (2018-01) while the dengue line-list opens 2019-01, so the
ingest filters pre-2019 rows once at the raw-file boundary (see
fwbd_ingest/doh_eb_ingest) and every shared loader re-asserts the lower
boundary so no pre-2019 row can reach a computation. The reported window
is also capped at the last COMPLETE month (DATA_END): the four FWD
line-lists carry an in-progress snapshot of the current month (2026-09)
that must never be served as a full reported month, so the API hot-load
trims observations after DATA_END. This module is the only place that
defines these constants — modules import them, never hardcode years.
"""

import pandas as pd

DATA_START_YEAR = 2019
DATA_END_YEAR = 2026
DATA_END_MONTH = 8  # last complete reported month (2026-09 is in-progress)
DATA_START = pd.Timestamp(f"{DATA_START_YEAR}-01-01")
# The last COMPLETE reported month, expressed both ways consumers need it: as a
# month-start for series alignment, and as the end of that month for the
# inclusive `<= DATA_END` row filters the ingest modules use. Single source of
# truth -- doh_eb_ingest and classify import these rather than hardcoding.
DATA_END_MONTH_START = pd.Timestamp(f"{DATA_END_YEAR}-{DATA_END_MONTH:02d}-01")
DATA_END = DATA_END_MONTH_START + pd.offsets.MonthEnd(0)


def at_or_after_data_start(df, date_col="date"):
    """Drop rows before DATA_START (applied once, at ingest)."""
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    return out[out[date_col] >= DATA_START].reset_index(drop=True)


def at_or_before_data_end(df, year_col="year", month_col="month"):
    """Drop rows after the last complete reported month.

    The FWD line-lists include a partial, in-progress snapshot of the
    current month (2026-09); treating it as a full reported month would
    leak an incomplete count onto the slider/snapshot. Applied at the API
    hot-load, and again at `ingest.load_monthly_series` so the pipeline's own
    fits cannot train on the partial month either (see `trim_to_data_end`).
    """
    out = df.copy()
    end_ym = DATA_END_YEAR * 100 + DATA_END_MONTH
    out["_ym"] = out[year_col] * 100 + out[month_col]
    out = out[out["_ym"] <= end_ym].drop(columns="_ym").reset_index(drop=True)
    return out


def trim_to_data_end(df, date_col="date"):
    """Drop rows after the last complete reported month (date-column form).

    The monthly series CSVs carry a `date` column rather than year/month, so
    they use this instead of `at_or_before_data_end`. Applied once in
    `ingest.load_monthly_series`, the shared chokepoint, so the Prophet fits,
    the percentile thresholds and the validation all inherit the trim. The CSVs
    on disk keep their partial-month rows; only computation excludes them.
    """
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    return out[out[date_col] <= DATA_END].reset_index(drop=True)


def assert_data_window(df, date_col="date", context=""):
    """Fail loudly if any row predates DATA_START.

    Defensive chokepoint: computes must never silently shrink to a partial
    calendar, so a pre-2019 row reaching a shared loader is an error, not a
    trimmed series.
    """
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    pre = (out[date_col] < DATA_START).sum()
    if pre:
        raise ValueError(
            f"{context}{pre} row(s) before DATA_START_YEAR={DATA_START_YEAR} "
            f"reached computation (min {out.loc[out[date_col] < DATA_START, date_col].min().date()})"
        )
    return out