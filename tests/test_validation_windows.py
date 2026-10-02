"""Validation-window guards for the walk-forward holdout (dependency-free asserts).

Run:  .venv\\Scripts\\python -m tests.test_validation_windows

The regression these lock down: `_split_index` used to return
`eligible[-1] - val_months + 1`, i.e. it held out the twelve months BEFORE the
window instead of the window itself, putting every published validation metric a
full year early (2025_prospective scored 2022-06..2024-12).

Asserts, on the shipped 92-month modelling grid (2019-01..2026-08):
  * "2025_prospective" holds out 2025-01..2025-12, trained through 2024-12
  * "last_12m" holds out 2025-09..2026-08, trained through 2025-08
  * a series that stops reporting before the window ends is DROPPED (None)
  * 2019-01 is inside the training portion of every window (hard constraint:
    no pre-2019 exclusion and no shortened baseline)

Uses a synthetic series so the assertions are about the window arithmetic, not
about whatever the current raw files happen to contain; the one Prophet fit
path is exercised on a short series so the guard is proven on real output too.
"""

import numpy as np
import pandas as pd

from src import forecast

# The shipped modelling grid: 2019-01 .. 2026-08 (DATA_START .. last complete month).
GRID = pd.date_range("2019-01-01", "2026-08-01", freq="MS")
assert len(GRID) == 92, f"expected the 92-month grid, got {len(GRID)}"


def _series(ds):
    """Deterministic monthly series (seasonal + trend) so MAE/MAPE stay finite."""
    n = len(ds)
    y = (
        100
        + 10 * np.arange(n)
        + 20 * np.sin(2 * np.pi * np.arange(n) / 12)
        + 5 * np.cos(2 * np.pi * np.arange(n) / 6)
    )
    return pd.DataFrame({"ds": pd.to_datetime(ds), "y": np.round(y, 3)})


def test_grid_is_the_shipped_window():
    assert GRID[0] == pd.Timestamp("2019-01-01")
    assert GRID[-1] == pd.Timestamp("2026-08-01")


def test_2025_prospective_holds_out_2025():
    series = _series(GRID)
    split = forecast._split_index(series, forecast.VAL_MONTHS, forecast.WINDOWS["2025_prospective"])
    assert split == 72, split
    # trained through 2024-12
    assert series.loc[split - 1, "ds"] == pd.Timestamp("2024-12-01")
    # holdout 2025-01 .. 2025-12
    held_out = series.iloc[split : split + forecast.VAL_MONTHS]["ds"]
    assert held_out.iloc[0] == pd.Timestamp("2025-01-01")
    assert held_out.iloc[-1] == pd.Timestamp("2025-12-01")
    assert len(held_out) == 12


def test_last_12m_holds_out_2025_09_to_2026_08():
    series = _series(GRID)
    split = forecast._split_index(series, forecast.VAL_MONTHS, forecast.WINDOWS["last_12m"])
    assert split == 80, split
    # trained through 2025-08
    assert series.loc[split - 1, "ds"] == pd.Timestamp("2025-08-01")
    held_out = series.iloc[split : split + forecast.VAL_MONTHS]["ds"]
    assert held_out.iloc[0] == pd.Timestamp("2025-09-01")
    assert held_out.iloc[-1] == pd.Timestamp("2026-08-01")
    assert len(held_out) == 12


def test_2019_stays_in_every_training_window():
    """Hard constraint: 2019 is in the pool, never excluded."""
    series = _series(GRID)
    for name, end_date in forecast.WINDOWS.items():
        split = forecast._split_index(series, forecast.VAL_MONTHS, end_date)
        train = series.iloc[:split]
        assert train["ds"].iloc[0] == pd.Timestamp("2019-01-01"), name
        # the whole 2019 calendar year is inside the training portion
        assert train["ds"].iloc[0].year == 2019, name
        assert (train["ds"].dt.year == 2019).sum() == 12, name


def test_series_ending_before_window_drops_out():
    """A series that stops reporting inside the window has no holdout to score."""
    # Hep A's real shape: reports through 2025-09, i.e. 9 months short of the
    # 2025_prospective holdout ending 2025-12.
    short = _series(GRID[:81])
    assert short["ds"].iloc[-1] == pd.Timestamp("2025-09-01")
    assert forecast.walk_forward_validation(
        short, end_date=forecast.WINDOWS["2025_prospective"]
    ) is None
    assert forecast.walk_forward_validation(
        short, end_date=forecast.WINDOWS["last_12m"]
    ) is None
    assert forecast.naive_scores(
        short, end_date=forecast.WINDOWS["2025_prospective"]
    ) is None
    assert forecast.naive_scores(short, end_date=forecast.WINDOWS["last_12m"]) is None


def test_short_history_below_min_train_drops_out():
    tiny = _series(GRID[:20])
    assert (
        forecast.walk_forward_validation(
            tiny, end_date=forecast.WINDOWS["2025_prospective"]
        )
        is None
    )


def test_skip_reason_names_the_actual_cause():
    """The two drop-out causes must be reported as themselves, not one blur."""
    full = _series(GRID)
    assert forecast._skip_reason(full, forecast.VAL_MONTHS, forecast.WINDOWS["2025_prospective"]) is None
    assert forecast._skip_reason(full, forecast.VAL_MONTHS, forecast.WINDOWS["last_12m"]) is None

    # stops reporting 9 months short of the 2025 holdout
    ends_in_window = _series(GRID[:81])
    reason = forecast._skip_reason(
        ends_in_window, forecast.VAL_MONTHS, forecast.WINDOWS["2025_prospective"]
    )
    assert reason.startswith("series_ends_in_window"), reason
    assert "2025-09" in reason and "3 months short" in reason, reason

    # too little history on or before the cutoff to fit Prophet at all
    too_short = _series(GRID[:12])
    reason = forecast._skip_reason(
        too_short, forecast.VAL_MONTHS, forecast.WINDOWS["2025_prospective"]
    )
    assert reason.startswith("history_too_short"), reason


def test_walk_forward_returns_the_window_months():
    """End-to-end on a real fit: the scored months ARE the window months."""
    # Training cutoff 2024-06 -> 42 eligible months (2021-01..2024-06), so the
    # series must carry the full 12-month holdout through 2025-06.
    series = _series(pd.date_range("2021-01-01", periods=54, freq="MS"))
    assert series["ds"].iloc[-1] == pd.Timestamp("2025-06-01")
    out = forecast.walk_forward_validation(series, end_date="2024-06-30")
    assert out is not None
    assert out["ds"].iloc[0] == pd.Timestamp("2024-07-01")
    assert out["ds"].iloc[-1] == pd.Timestamp("2025-06-01")
    assert len(out) == 12
    assert (out["yhat"] >= 0).all()
    # the model was trained on history that starts before the first held-out month
    assert series["ds"].iloc[0] < out["ds"].iloc[0]


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