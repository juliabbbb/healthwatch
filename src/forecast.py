"""Monthly disease forecasting (dengue + food/waterborne disease groups).

Monthly Prophet (~92 observed months per region, 7 full yearly cycles) with a
wet-season regressor only -- Config B, the deployed default (`fit_prophet`'s
`use_year_seasonality=False, use_wet_regressor=True`), a 12-month production
horizon on one shared calendar and a 12-month walk-forward validation that
REFITS EVERY MONTH (REFIT_EVERY = 1).

Config B was originally adopted because the ablation reported Config C (the
yearly + wet-regressor stack) as strictly worse. ON THE CORRECTED WALK-FORWARD
WINDOWS THAT ORDERING REVERSES, and the reversal is not a rounding artefact:
across the 19 dengue series, C has the lowest MAE in 12 regions on
`2025_prospective` and 10 on `last_12m`, and the lowest MAPE in both windows
(101.75 and 79.91, vs B's 119.41 and 115.82). B still wins on RMSE. The
original result came from a validation window that leaked the holdout into its
own thresholds; see RESULTS_AFTER_FIX.md. B remains deployed because switching
is a modelling decision, not a bug fix, and because the collinearity that
motivated B in the first place is unresolved: the projected R2 of the wet step
on the Fourier columns is still 1.0 with a joint condition number of ~6.1e16, so
C's two seasonal channels are not separately identified and its edge is not
safely attributable. Re-deciding the deployed config is open work.

Two validation windows:
  last_12m         train through 2025-08, hold out 2025-09 .. 2026-08
  2025_prospective train through 2024-12, hold out 2025-01 .. 2025-12

Each window's `end_date` is the last month the model may TRAIN on, so the
holdout starts the month after it. A series that stops reporting before the
window ends cannot fill the holdout and is DROPPED from that window (it
contributes no metric row), so the per-window series count is reported
explicitly rather than assumed to be every region.

The production forecast shares ONE calendar across all five diseases --
FORECAST_START..FORECAST_END (2026-09..2027-08), derived from the last complete
reported month. It does not start at each series' own last observation. A series
that stopped reporting more than MAX_STALE_MONTHS (12) months before the last
complete month is not forecast; those skips, with their reason, are written to
forecast_skips.csv.

Seasonal outbreak "probe" forecasts (dry = Jan-Mar, wet = Jul-Sep of the next
season) are fit on history through 2024-12-31 so the 2025 seasons are true
prospective holdouts for validate_2025.

Run: python -m src.forecast
"""

import logging

import numpy as np
import pandas as pd
from prophet import Prophet

from . import config, features, ingest
from .doh_eb_ingest import DATA_END

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

FORECAST_MONTHS = 12
VAL_MONTHS = 12
REFIT_EVERY = 1  # walk-forward refits every month (methodology text must match)
MIN_TRAIN_MONTHS = 24
# A series whose reporting stops more than this many months before the last
# complete month is not forecast at all: its "next 12 months" would be an
# extrapolation across a reporting gap, presented with the same confidence as a
# current series. The skip is recorded in forecast_skips.csv.
MAX_STALE_MONTHS = 12
# One shared production calendar for EVERY disease, derived from the last
# complete reported month so it moves automatically when the data does:
#   FORECAST_START = 2026-09-01, FORECAST_END = 2027-08-01
# The horizon used to start at each series' own last observation, so a series
# that stopped reporting early began its "next 12 months" months earlier than a
# current one -- the five diseases spanned 2023-06..2026-10 as anchors and the
# frontend had to re-anchor each one on its own. Every series now carries the
# same 12 target months, which is what the shared dashboard calendar expects.
FORECAST_START = config.DATA_END_MONTH_START + pd.DateOffset(months=1)
FORECAST_END = config.DATA_END_MONTH_START + pd.DateOffset(months=FORECAST_MONTHS)
WINDOWS = {
    "last_12m": "2025-08-31",
    "2025_prospective": "2024-12-31",
}
TRAIN_END = pd.Timestamp("2024-12-31")


def months_between(start, end):
    """Whole months from `start` to `end` (calendar months, ignoring day)."""
    return (end.year - start.year) * 12 + (end.month - start.month)


def stale_months(series, as_of=None):
    """Months between a series' last observation and the last complete month."""
    as_of = as_of if as_of is not None else config.DATA_END_MONTH_START
    return max(0, months_between(series["ds"].max(), as_of))

# Seasonal outbreak "probe" forecasts: one 3-month window per season, anchored to
# the CALENDAR, not to the last observed month. The dry probe is Jan-Mar and the
# wet probe is Jul-Sep of the first full year after TRAIN_END, so the outbreak
# indicator can compare each season's expected load against that season's own
# historical P75.
#
# The previous scheme took month offsets from series["ds"].max(), which silently
# relabelled both windows for any series whose data ended mid-year -- Cholera
# MIMAROPA's "wet" probe resolved to Mar-May (dry months) and Hep A BARMM's
# "dry" probe to Jun-Aug (wet months). Calendar anchoring removes the dependence
# on where a series happens to stop, and gives every probe a real month range.
SEASON_PROBE_MONTHS = 3
DRY_PROBE_MONTHS = (1, 2, 3)
WET_PROBE_MONTHS = (7, 8, 9)  # Jul-Sep, the climatological wet-season peak
PROBE_HORIZON = 12

FREQ = "MS"


def load_series():
    return ingest.load_monthly_series().sort_values(
        ["disease", "region", "date"], ignore_index=True
    )


def fit_prophet(train, use_year_seasonality=False, use_wet_regressor=True):
    model = Prophet(
        yearly_seasonality=use_year_seasonality,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
    )
    if use_wet_regressor:
        model.add_regressor("is_wet_season")
    flagged = features.add_season_flags(train, date_col="ds")
    cols = ["ds", "y"]
    if use_wet_regressor:
        cols.append("is_wet_season")
    model.fit(flagged[cols])
    return model


def predict(model, dates, use_wet_regressor=True):
    future = pd.DataFrame({"ds": pd.to_datetime(dates)})
    flagged = features.add_season_flags(future, date_col="ds")
    cols = ["ds"]
    if use_wet_regressor:
        cols.append("is_wet_season")
    fcst = model.predict(flagged[cols])
    return fcst[["ds", "yhat", "yhat_lower", "yhat_upper"]]


def _split_index(series, val_months, end_date):
    """Index of the FIRST held-out month for a window whose training cutoff is
    `end_date`.

    `end_date` is the last month the model may TRAIN on, so the holdout starts
    the month after it. The previous expression (`eligible[-1] - val_months +
    1`) subtracted a whole window from the cutoff and therefore held out the
    twelve months BEFORE the window instead of the window itself, putting every
    published metric a year early.
    """
    if end_date is None:
        return len(series) - val_months
    eligible = series.index[series["ds"] <= pd.Timestamp(end_date)]
    if len(eligible) == 0:
        return -1
    return int(eligible[-1]) + 1


def _skip_reason(series, val_months, end_date):
    """Why a series cannot be scored on a window, or None when it can.

    Two distinct causes, previously reported under one vague message:
      * `history_too_short` - fewer than MIN_TRAIN_MONTHS months on or before
        the training cutoff, so Prophet cannot be fit at all;
      * `series_ends_in_window` - the series stops reporting before the
        holdout's last month, so there are no observed months to score.
    """
    series = series.reset_index(drop=True)
    split = _split_index(series, val_months, end_date)
    if split == -1:
        return "no history before cutoff"
    if split < MIN_TRAIN_MONTHS:
        return f"history_too_short ({split} months before cutoff, need {MIN_TRAIN_MONTHS})"
    if split + val_months > len(series):
        missing = split + val_months - len(series)
        last = series["ds"].iloc[-1].strftime("%Y-%m")
        return f"series_ends_in_window (last observed {last}, {missing} months short)"
    return None


def walk_forward_validation(series, val_months=VAL_MONTHS, refit_every=REFIT_EVERY, end_date=None):
    series = series.reset_index(drop=True)
    split = _split_index(series, val_months, end_date)
    # A series that stops reporting before the window ends cannot fill the
    # holdout: return None so it drops out instead of scoring a short window.
    if split < MIN_TRAIN_MONTHS or split + val_months > len(series):
        return None
    preds = []
    model = None
    for step in range(val_months):
        cutoff = split + step
        if model is None or step % refit_every == 0:
            model = fit_prophet(series.iloc[:cutoff][["ds", "y"]])
        preds.append(predict(model, [series.loc[cutoff, "ds"]])["yhat"].iloc[0])
    out = series.iloc[split : split + val_months][["ds", "y"]].copy()
    out["yhat"] = np.clip(preds, 0, None)
    return out


def score(validation):
    err = validation["y"] - validation["yhat"]
    nonzero = validation["y"] != 0
    return {
        "MAE": round(float(np.mean(np.abs(err))), 2),
        "RMSE": round(float(np.sqrt(np.mean(err**2))), 2),
        "MAPE": round(float(np.mean(np.abs(err[nonzero] / validation["y"][nonzero])) * 100), 2),
        "months": int(len(validation)),
        # Auditability for the MAPE zero-exclusion (methodology 3.5.5): the
        # module reports how many zero-actual months were dropped from the
        # percentage-error denominator, per window, so a future dataset where
        # zeros become common surfaces the data loss immediately instead of
        # silently.
        "excluded_zero_actual": int((~nonzero).sum()),
    }


def naive_scores(series, val_months=VAL_MONTHS, end_date=None):
    series = series.reset_index(drop=True)
    split = _split_index(series, val_months, end_date)
    if split < val_months or split + val_months > len(series):
        return None
    actual = series.iloc[split : split + val_months]["y"].to_numpy(dtype=float)
    naive = series["y"].shift(val_months).iloc[split : split + val_months].to_numpy(dtype=float)
    ok = ~(np.isnan(actual) | np.isnan(naive))
    return round(float(np.mean(np.abs(actual[ok] - naive[ok]))), 2)


def build_forecast(series, start=FORECAST_START, end=FORECAST_END):
    """Production forecast on the SHARED calendar.

    Fits on ALL observed history (through 2026-08) and predicts the fixed
    12-month window `start`..`end` for every series, regardless of where that
    series' own observations stop. A stale series is rejected by `run()` before
    it gets here, so a large `start - last_ds` gap is a bug, not a normal case.
    """
    series = series[["ds", "y"]].reset_index(drop=True)
    model = fit_prophet(series)
    future_dates = pd.date_range(start, end, freq=FREQ)
    fcst = predict(model, future_dates)
    fcst["yhat"] = fcst["yhat"].clip(lower=1)
    fcst["yhat_lower"] = fcst["yhat_lower"].clip(lower=1)
    return fcst


def _probe_window(season, year):
    """First month and full date index of `season`'s 3-month window in `year`."""
    first = DRY_PROBE_MONTHS[0] if season == "dry" else WET_PROBE_MONTHS[0]
    anchor = pd.Timestamp(year=year, month=first, day=1)
    return anchor, pd.date_range(anchor, periods=SEASON_PROBE_MONTHS, freq=FREQ)


def build_season_probes(series):
    """One 3-month 'probe' forecast per season (dry, wet) for a region.

    Fits a single Prophet model on history up to TRAIN_END (2024-12-31) and
    predicts the two calendar probe windows of the following year. Windows are
    fixed to the calendar, so a series whose data ends mid-year cannot shift its
    own probe months.

    Every row carries the probe's identity in time -- `probe_anchor`,
    `season_start`, `season_end` -- because the outbreak signal is a season-level
    verdict and must never be rendered against a single month. `history_status`
    marks the window 'observed' when it already falls inside reported data (a
    replay that can be checked against what happened) and 'extrapolated' when it
    lies beyond DATA_END (a genuine forward-looking signal).
    """
    series = series[series["ds"] <= TRAIN_END].reset_index(drop=True)
    model = fit_prophet(series)
    probe_year = (TRAIN_END + pd.DateOffset(months=1)).year

    frames = []
    for season in ("dry", "wet"):
        anchor, dates = _probe_window(season, probe_year)
        fcst = predict(model, dates)
        for col in ("yhat", "yhat_lower", "yhat_upper"):
            fcst[col] = fcst[col].clip(lower=0)
        fcst["season"] = season
        fcst["probe_anchor"] = anchor
        fcst["season_start"] = dates[0]
        fcst["season_end"] = dates[-1]
        fcst["history_status"] = (
            "extrapolated" if anchor > DATA_END else "observed"
        )
        frames.append(fcst)

    out = pd.concat(frames, ignore_index=True)
    return out[
        [
            "ds",
            "season",
            "probe_anchor",
            "season_start",
            "season_end",
            "history_status",
            "yhat",
            "yhat_lower",
            "yhat_upper",
        ]
    ]


def run(probes_only=False):
    df = load_series()
    probe_frames = []
    forecast_frames = []
    metric_rows = []
    val_rows = []
    skip_rows = []
    for (disease, region), group in df.groupby(["disease", "region"]):
        series = group.rename(columns={"date": "ds", "cases": "y"})[["ds", "y"]]
        if len(series) < MIN_TRAIN_MONTHS:
            print(
                f"SKIP {region:<32} [{disease}]: only {len(series)} months"
                f" (< {MIN_TRAIN_MONTHS})"
            )
            # Recorded too, so forecast_skips.csv accounts for every series that
            # produces no production forecast rather than only the stale ones.
            if not probes_only:
                skip_rows.append(
                    {
                        "disease": disease,
                        "region": region,
                        "last_observed": series["ds"].max(),
                        "stale_months": stale_months(series),
                        "months_observed": int(len(series)),
                        "reason": f"history_too_short ({len(series)} months < {MIN_TRAIN_MONTHS})",
                    }
                )
            continue
        probes = build_season_probes(series)
        probes.insert(0, "region", region)
        probes.insert(0, "disease", disease)
        probe_frames.append(probes)
        if probes_only:
            continue
        for window_name, end_date in WINDOWS.items():
            validation = walk_forward_validation(series, end_date=end_date)
            if validation is None:
                print(f"SKIP {region} [{window_name}]: {_skip_reason(series, VAL_MONTHS, end_date)}")
                continue
            val_rows.append(
                validation.assign(disease=disease, region=region, window=window_name)
            )
            scores = score(validation)
            naive_mae = naive_scores(series, end_date=end_date)
            skill = (
                round((1 - scores["MAE"] / naive_mae) * 100, 1) if naive_mae else None
            )
            metric_rows.append(
                {
                    "disease": disease,
                    "region": region,
                    "window": window_name,
                    **{k: v for k, v in scores.items()},
                    "naive_MAE": naive_mae,
                    "skill_vs_naive_pct": skill,
                }
            )
            print(
                f"{region:<32} [{window_name:<18}] MAE={scores['MAE']:>9.2f}  "
                f"naive={naive_mae:>9.2f}  skill={skill if skill is not None else 'n/a':>6}%"
            )
        gap = stale_months(series)
        if gap > MAX_STALE_MONTHS:
            # Still probed and still validated above -- only the PRODUCTION
            # forecast is withheld, because a series that stopped reporting is
            # not forecasting "the next 12 months".
            reason = (
                f"stale ({gap} months before last complete month "
                f"{config.DATA_END_MONTH_START.date()}, max {MAX_STALE_MONTHS})"
            )
            print(f"SKIP {region:<32} [{disease}]: {reason}")
            skip_rows.append(
                {
                    "disease": disease,
                    "region": region,
                    "last_observed": series["ds"].max(),
                    "stale_months": gap,
                    "months_observed": int(len(series)),
                    "reason": reason,
                }
            )
            continue
        fcst = build_forecast(series)
        fcst.insert(0, "region", region)
        fcst.insert(0, "disease", disease)
        forecast_frames.append(fcst)

    probes_df = pd.concat(probe_frames, ignore_index=True)
    probes_df = probes_df.rename(columns={"ds": "target_date"})
    probes_df = probes_df[
        [
            "disease",
            "region",
            "season",
            "probe_anchor",
            "season_start",
            "season_end",
            "history_status",
            "target_date",
            "yhat",
            "yhat_lower",
            "yhat_upper",
        ]
    ]
    probes_path = ingest.save_processed(probes_df, "season_probes.csv")
    print(f"Saved {len(probes_df)} seasonal probe rows -> {probes_path}")
    if probes_only:
        print(
            probes_df.groupby(["season", "history_status"])["target_date"]
            .agg(["min", "max", "count"])
            .to_string()
        )
        return probes_df, pd.DataFrame()

    forecasts = pd.concat(forecast_frames, ignore_index=True)
    forecasts = forecasts.rename(columns={"ds": "target_date"})
    forecasts = forecasts[
        ["disease", "region", "target_date", "yhat", "yhat_lower", "yhat_upper"]
    ]
    fcst_path = ingest.save_processed(forecasts, "forecasts.csv")

    skips_df = pd.DataFrame(
        skip_rows,
        columns=[
            "disease",
            "region",
            "last_observed",
            "stale_months",
            "months_observed",
            "reason",
        ],
    )
    if not skips_df.empty:
        skips_df = skips_df.sort_values(
            ["disease", "stale_months", "region"], ascending=[True, False, True], ignore_index=True
        )
    skips_path = ingest.save_processed(skips_df, "forecast_skips.csv")

    metrics_df = pd.DataFrame(metric_rows)
    metrics_df = metrics_df.sort_values(["region", "window"], ignore_index=True)
    metrics_path = ingest.save_processed(metrics_df, "validation_metrics.csv")

    val_df = pd.concat(val_rows, ignore_index=True)
    val_path = ingest.save_processed(val_df, "validation_predictions.csv")

    n_series = df.groupby(["disease", "region"]).ngroups
    print(f"\nSaved {len(forecasts)} forecast rows -> {fcst_path}")
    print(f"Forecast calendar {FORECAST_START.date()} .. {FORECAST_END.date()} "
          f"({FORECAST_MONTHS} months, shared by all diseases)")
    print(f"Forecasted {forecasts.groupby(['disease', 'region']).ngroups} of {n_series} series; "
          f"skipped {len(skips_df)} -> {skips_path}")
    if not skips_df.empty:
        print("\nSkipped series (no production forecast):")
        print(
            skips_df[["disease", "region", "last_observed", "stale_months", "reason"]]
            .to_string(index=False)
        )
        print()
        print(skips_df.groupby("disease").size().to_string())
    print(f"\nSaved {len(metrics_df)} validation rows -> {metrics_path}")
    print(f"Saved {len(val_df)} validation prediction rows -> {val_path}")
    return forecasts, metrics_df


if __name__ == "__main__":
    import sys

    probes_only = "--probes-only" in sys.argv
    run(probes_only=probes_only)