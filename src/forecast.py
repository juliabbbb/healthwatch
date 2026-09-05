"""Monthly dengue forecasting.

Monthly Prophet (~55 observed months per region, 3 full yearly cycles) with a
wet-season regressor, a 12-month production horizon and a 12-month walk-forward
validation that REFITS EVERY MONTH (REFIT_EVERY = 1). Two validation windows:

  last_12m         train through 2025-08, hold out 2025-09 .. 2026-08
  2025_prospective train through 2024-12, hold out 2025-01 .. 2025-12

Seasonal outbreak "probe" forecasts (dry = Jan-Mar, wet = Jul-Sep of the next
season) are fit on history through 2024-12-31 so the 2025 seasons are true
prospective holdouts for validate_2025.

Run: python -m src.forecast
"""

import logging

import numpy as np
import pandas as pd
from prophet import Prophet

from . import features, ingest

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

FORECAST_MONTHS = 12
VAL_MONTHS = 12
REFIT_EVERY = 1  # walk-forward refits every month (methodology text must match)
MIN_TRAIN_MONTHS = 24
WINDOWS = {
    "last_12m": "2025-08-31",
    "2025_prospective": "2024-12-31",
}
TRAIN_END = pd.Timestamp("2024-12-31")

# Seasonal outbreak "probe" forecasts: one 3-month window per season, expressed
# as month offsets after the training-end month. The dry probe is the immediate
# Jan-Mar window; the wet probe targets the historical dengue-peak window
# (Jul-Sep) of the next wet season so the outbreak indicator can compare each
# season's expected load against that season's own historical P75.
SEASON_PROBE_MONTHS = 3
DRY_PROBE_OFFSETS = (1, 3)
WET_PROBE_OFFSETS = (7, 9)  # Jul-Sep, the climatological wet-season peak
PROBE_HORIZON = 12

FREQ = "MS"


def load_series():
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_monthly.csv", parse_dates=["date"]
    )
    regional = pd.read_csv(
        ingest.PROCESSED_DIR / "regional_dengue_monthly.csv", parse_dates=["date"]
    )
    df = pd.concat([national, regional], ignore_index=True)
    return df.sort_values(["disease", "region", "date"], ignore_index=True)


def fit_prophet(train):
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
    )
    model.add_regressor("is_wet_season")
    flagged = features.add_season_flags(train, date_col="ds")
    model.fit(flagged[["ds", "y", "is_wet_season"]])
    return model


def predict(model, dates):
    future = pd.DataFrame({"ds": pd.to_datetime(dates)})
    flagged = features.add_season_flags(future, date_col="ds")
    fcst = model.predict(flagged[["ds", "is_wet_season"]])
    return fcst[["ds", "yhat", "yhat_lower", "yhat_upper"]]


def _split_index(series, val_months, end_date):
    if end_date is None:
        return len(series) - val_months
    eligible = series.index[series["ds"] <= pd.Timestamp(end_date)]
    if len(eligible) == 0:
        return -1
    return int(eligible[-1]) - val_months + 1


def walk_forward_validation(series, val_months=VAL_MONTHS, refit_every=REFIT_EVERY, end_date=None):
    series = series.reset_index(drop=True)
    split = _split_index(series, val_months, end_date)
    if split < MIN_TRAIN_MONTHS:
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
    }


def naive_scores(series, val_months=VAL_MONTHS, end_date=None):
    series = series.reset_index(drop=True)
    split = _split_index(series, val_months, end_date)
    if split < val_months:
        return None
    actual = series.iloc[split : split + val_months]["y"].to_numpy(dtype=float)
    naive = series["y"].shift(val_months).iloc[split : split + val_months].to_numpy(dtype=float)
    ok = ~(np.isnan(actual) | np.isnan(naive))
    return round(float(np.mean(np.abs(actual[ok] - naive[ok]))), 2)


def build_forecast(series, horizon=FORECAST_MONTHS):
    """Production forecast: fit on ALL observed history (through 2026-08) and
    forecast the next 12 months."""
    series = series[["ds", "y"]].reset_index(drop=True)
    model = fit_prophet(series)
    last = series["ds"].max()
    future_dates = pd.date_range(last, periods=horizon + 1, freq=FREQ)[1:]
    fcst = predict(model, future_dates)
    fcst["yhat"] = fcst["yhat"].clip(lower=0)
    fcst["yhat_lower"] = fcst["yhat_lower"].clip(lower=0)
    return fcst


def build_season_probes(series, horizon=PROBE_HORIZON):
    """One 3-month 'probe' forecast per season (dry, wet) for a region.

    Fits a single Prophet model on history up to TRAIN_END (2024-12-31),
    forecasts a horizon reaching both seasonal windows, then takes a 3-month
    slice from each season: DRY = the immediate Jan-Mar window, WET = the
    Jul-Sep climatological peak of the next season. Month offsets (1-based)
    count months after the last training month.
    """
    series = series[series["ds"] <= TRAIN_END].reset_index(drop=True)
    model = fit_prophet(series)
    last = series["ds"].max()
    future_dates = pd.date_range(last, periods=horizon + 1, freq=FREQ)[1:]
    fcst = predict(model, future_dates)
    fcst["yhat"] = fcst["yhat"].clip(lower=0)
    fcst["yhat_lower"] = fcst["yhat_lower"].clip(lower=0)
    fcst["month_offset"] = range(1, len(fcst) + 1)

    def slice_offsets(a, b):
        return fcst[(fcst["month_offset"] >= a) & (fcst["month_offset"] <= b)].copy()

    dry = slice_offsets(*DRY_PROBE_OFFSETS)
    wet = slice_offsets(*WET_PROBE_OFFSETS)
    dry["season"] = "dry"
    wet["season"] = "wet"
    out = pd.concat([dry, wet], ignore_index=True).drop(columns=["month_offset"])
    return out[["ds", "season", "yhat", "yhat_lower", "yhat_upper"]]


def run(probes_only=False):
    df = load_series()
    probe_frames = []
    forecast_frames = []
    metric_rows = []
    val_rows = []
    for (disease, region), group in df.groupby(["disease", "region"]):
        series = group.rename(columns={"date": "ds", "cases": "y"})[["ds", "y"]]
        probes = build_season_probes(series)
        probes.insert(0, "region", region)
        probes.insert(0, "disease", disease)
        probe_frames.append(probes)
        if probes_only:
            continue
        for window_name, end_date in WINDOWS.items():
            validation = walk_forward_validation(series, end_date=end_date)
            if validation is None:
                print(f"SKIP {region} [{window_name}]: not enough history")
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
        fcst = build_forecast(series)
        fcst.insert(0, "region", region)
        fcst.insert(0, "disease", disease)
        forecast_frames.append(fcst)

    probes_df = pd.concat(probe_frames, ignore_index=True)
    probes_df = probes_df.rename(columns={"ds": "target_date"})
    probes_df = probes_df[
        ["disease", "region", "target_date", "season", "yhat", "yhat_lower", "yhat_upper"]
    ]
    probes_path = ingest.save_processed(probes_df, "season_probes.csv")
    print(f"Saved {len(probes_df)} seasonal probe rows -> {probes_path}")
    if probes_only:
        print(
            probes_df.groupby("season")["target_date"]
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

    metrics_df = pd.DataFrame(metric_rows)
    metrics_df = metrics_df.sort_values(["region", "window"], ignore_index=True)
    metrics_path = ingest.save_processed(metrics_df, "validation_metrics.csv")

    val_df = pd.concat(val_rows, ignore_index=True)
    val_path = ingest.save_processed(val_df, "validation_predictions.csv")

    print(f"\nSaved {len(forecasts)} forecast rows -> {fcst_path}")
    print(f"Saved {len(metrics_df)} validation rows -> {metrics_path}")
    print(f"Saved {len(val_df)} validation prediction rows -> {val_path}")
    return forecasts, metrics_df


if __name__ == "__main__":
    import sys

    probes_only = "--probes-only" in sys.argv
    run(probes_only=probes_only)