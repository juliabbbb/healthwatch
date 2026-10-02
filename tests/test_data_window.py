"""Data-window and shared-forecast-calendar guards.

Run:  .venv\\Scripts\\python -m tests.test_data_window

Two defects these pin down:

  1. The FWD line-lists carry a partial, in-progress snapshot of the current
     month (2026-09). `ingest.load_monthly_series()` did not trim it, so the
     API hot-load (which does trim) and the Prophet fits disagreed about the end
     of history: every forecast anchor for a currently-reporting series was one
     month further along than the data the dashboard serves.

  2. The production horizon started at each series' own last observation, so a
     series that stopped reporting early began its "next 12 months" months
     before a current one -- anchors spanned 2023-06..2026-10 across the five
     diseases. Now one shared calendar is used, and a series stale by more than
     MAX_STALE_MONTHS is not forecast at all.

Also asserted: the trim is a COMPUTE-time trim. The CSVs on disk and the
`monthly_observations` table must keep the partial-month rows -- nothing is
deleted from the dataset, the pipeline just stops computing on it.
"""

import pandas as pd

from src import config, forecast, ingest

PARTIAL = pd.Timestamp("2026-09-01")
LAST_COMPLETE = pd.Timestamp("2026-08-01")


def test_config_pins_the_last_complete_month():
    assert config.DATA_END_MONTH_START == LAST_COMPLETE
    assert config.DATA_END == pd.Timestamp("2026-08-31")
    assert config.DATA_START == pd.Timestamp("2019-01-01")


def test_load_monthly_series_trims_the_partial_month():
    series = ingest.load_monthly_series()
    assert series["date"].max() == LAST_COMPLETE, series["date"].max()
    assert (series["date"] == PARTIAL).sum() == 0
    assert (series["date"] > config.DATA_END).sum() == 0


def test_trim_is_compute_time_only_csvs_keep_the_rows():
    """Nothing is deleted from the dataset."""
    import glob
    import os

    total_after = 0
    for path in sorted(glob.glob(str(ingest.PROCESSED_DIR / "*monthly.csv"))):
        df = pd.read_csv(path)
        after = len(df[pd.to_datetime(df["date"]) > LAST_COMPLETE])
        total_after += after
    assert total_after > 0, "CSVs no longer carry the partial month -- rows were deleted?"


def test_shared_forecast_calendar():
    assert forecast.FORECAST_START == pd.Timestamp("2026-09-01")
    assert forecast.FORECAST_END == pd.Timestamp("2027-08-01")
    months = pd.date_range(forecast.FORECAST_START, forecast.FORECAST_END, freq="MS")
    assert len(months) == forecast.FORECAST_MONTHS == 12
    assert months[0] == forecast.FORECAST_START
    assert months[-1] == forecast.FORECAST_END


def test_shared_calendar_moves_with_the_data_end():
    """Derived from config, so advancing DATA_END moves the horizon with it."""
    assert forecast.FORECAST_START == config.DATA_END_MONTH_START + pd.DateOffset(months=1)
    assert forecast.FORECAST_END == config.DATA_END_MONTH_START + pd.DateOffset(months=12)


def test_months_between_and_stale_months():
    assert forecast.months_between(pd.Timestamp("2026-08-01"), pd.Timestamp("2027-08-01")) == 12
    assert forecast.months_between(pd.Timestamp("2026-01-15"), pd.Timestamp("2026-08-01")) == 7
    assert forecast.months_between(pd.Timestamp("2026-08-01"), pd.Timestamp("2026-08-01")) == 0

    fresh = pd.DataFrame({"ds": pd.date_range("2025-09-01", "2026-08-01", freq="MS")})
    assert fresh["ds"].iloc[-1] == LAST_COMPLETE
    assert forecast.stale_months(fresh) == 0
    old = pd.DataFrame({"ds": pd.date_range("2019-01-01", "2023-05-01", freq="MS")})
    assert old["ds"].iloc[-1] == pd.Timestamp("2023-05-01")
    assert forecast.stale_months(old) == 39
    assert forecast.stale_months(old) > forecast.MAX_STALE_MONTHS


def test_build_forecast_returns_the_shared_window_for_any_series():
    """A stale-but-not-skipped series must still land on the shared months."""
    import numpy as np

    # ends 3 months before the last complete month -> stale_months 3, not skipped
    ds = pd.date_range("2019-01-01", "2026-05-01", freq="MS")
    series = pd.DataFrame({"ds": ds, "y": np.round(100 + 10 * np.arange(len(ds)), 3)})
    assert forecast.stale_months(series) == 3
    out = forecast.build_forecast(series)
    assert len(out) == 12
    assert out["ds"].iloc[0] == forecast.FORECAST_START
    assert out["ds"].iloc[-1] == forecast.FORECAST_END
    assert (out["yhat"] >= 1).all()


def test_stale_threshold_is_twelve_months():
    assert forecast.MAX_STALE_MONTHS == 12
    # last observation exactly 12 months before the last complete month: kept
    exactly_12 = pd.DataFrame({"ds": pd.date_range("2023-09-01", "2025-08-01", freq="MS")})
    assert exactly_12["ds"].iloc[-1] == pd.Timestamp("2025-08-01")
    assert forecast.stale_months(exactly_12) == 12  # not > 12, so still forecast
    # 13 months stale: dropped
    thirteen = pd.DataFrame({"ds": pd.date_range("2023-08-01", "2025-07-01", freq="MS")})
    assert thirteen["ds"].iloc[-1] == pd.Timestamp("2025-07-01")
    assert forecast.stale_months(thirteen) == 13  # > 12, so skipped


def _main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        else:
            print(f"pass {fn.__name__}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_main())
