"""Monthly disease forecasting (dengue + food/waterborne disease groups).

Monthly Prophet (~55 observed months per region, 3 full yearly cycles) with a
wet-season regressor only (Config B, the deployed default: yearly Fourier
seasonality disabled after the ablation in src/ablation reported Config C, the
former yearly + wet-regressor stack, as strictly worse, with a projected R2 of
1.0 between the wet step and the Fourier columns on the training calendar), a
12-month production horizon and a 12-month walk-forward validation that REFITS
EVERY MONTH (REFIT_EVERY = 1). Two validation windows:

  last_12m         train through 2025-08, hold out 2025-09 .. 2026-08
  2025_prospective train through 2024-12, hold out 2025-01 .. 2025-12

Seasonal outbreak "probe" forecasts (dry = Jan-Mar, wet = Jul-Sep of the next
season) are fit on history through 2024-12-31 so the 2025 seasons are retrospective evaluation targets for validate_2025.

Run: python -m src.forecast
"""

import logging

import numpy as np
import pandas as pd
from prophet import Prophet
from pathlib import Path

from . import config, features, ingest

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
    observations = ingest.load_monthly_series()
    end = pd.Timestamp(year=config.DATA_END_YEAR,month=config.DATA_END_MONTH,day=1)
    return observations[observations.date <= end].sort_values(["disease","region","date"],ignore_index=True)


def fit_prophet(train, use_year_seasonality=False, use_wet_regressor=True):
    observed = train.dropna(subset=["y"])
    if len(observed) < MIN_TRAIN_MONTHS:
        raise ValueError("Insufficient observed training history")
    if observed.y.eq(0).all():
        raise ValueError("All-zero series requires a separately declared deterministic method")
    model = Prophet(
        yearly_seasonality=use_year_seasonality,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        interval_width=0.8,
    )
    if use_wet_regressor:
        model.add_regressor("is_wet_season")
    flagged = features.add_season_flags(train, date_col="ds")
    cols = ["ds", "y"]
    if use_wet_regressor:
        cols.append("is_wet_season")
    model.fit(flagged[cols].dropna(subset=["y"]))
    return model


def predict(model, dates, use_wet_regressor=True):
    future = pd.DataFrame({"ds": pd.to_datetime(dates)})
    flagged = features.add_season_flags(future, date_col="ds")
    cols = ["ds"]
    if use_wet_regressor:
        cols.append("is_wet_season")
    np.random.seed(2026)
    fcst = model.predict(flagged[cols])
    fields = ["yhat", "yhat_lower", "yhat_upper"]
    fcst[fields] = fcst[fields].clip(lower=0)
    if not np.isfinite(fcst[fields]).all().all() or not (fcst.yhat_lower <= fcst.yhat_upper).all():
        raise ValueError("Invalid model prediction or interval")
    return fcst[["ds", "yhat", "yhat_lower", "yhat_upper"]]


def _split_index(series, val_months, end_date):
    # end_date is the last allowed training date, never the last target date.
    if end_date is None:
        return len(series) - val_months
    targets = series.index[series["ds"] > pd.Timestamp(end_date)]
    return int(targets[0]) if len(targets) else -1


def walk_forward_validation(series, val_months=VAL_MONTHS, refit_every=REFIT_EVERY, end_date=None, use_year_seasonality=False, use_wet_regressor=True):
    series = series.sort_values("ds").reset_index(drop=True)
    if series.ds.duplicated().any():
        raise ValueError("Duplicate month targets")
    if end_date is None:
        if len(series) <= val_months:
            return None
        end_date = series.iloc[-val_months].ds - pd.offsets.MonthBegin(1)
    origin = pd.Timestamp(end_date).to_period("M").to_timestamp()
    targets = pd.date_range(origin + pd.offsets.MonthBegin(1), periods=val_months, freq="MS")
    history = series[series.ds <= origin].dropna(subset=["y"])
    if len(history) < MIN_TRAIN_MONTHS:
        return None
    actuals = series.set_index("ds").y.reindex(targets)
    if not actuals.notna().any():
        return None
    preds, model = [], None
    for step, target in enumerate(targets):
        train = series[series.ds < target].dropna(subset=["y"])
        if model is None or step % refit_every == 0:
            model = fit_prophet(train[["ds", "y"]], use_year_seasonality=use_year_seasonality, use_wet_regressor=use_wet_regressor)
        preds.append(float(predict(model, [target], use_wet_regressor=use_wet_regressor).yhat.iloc[0]))
    return pd.DataFrame({"ds": targets, "y": actuals.to_numpy(), "yhat": np.clip(preds, 0, None)})


def score(validation):
    from .integrity import paired_score
    return paired_score(validation["y"], validation["yhat"])


def naive_scores(series, val_months=VAL_MONTHS, end_date=None):
    series = series.sort_values("ds").reset_index(drop=True)
    if end_date is None:
        if len(series) <= val_months:
            return None
        end_date = series.iloc[-val_months].ds - pd.offsets.MonthBegin(1)
    origin = pd.Timestamp(end_date).to_period("M").to_timestamp()
    targets = pd.date_range(origin + pd.offsets.MonthBegin(1), periods=val_months, freq="MS")
    lookup = series.set_index("ds").y
    actual = lookup.reindex(targets).to_numpy()
    baseline = lookup.reindex(targets - pd.DateOffset(years=1)).to_numpy()
    paired = np.isfinite(actual) & np.isfinite(baseline)
    return float(np.abs(actual[paired] - baseline[paired]).mean()) if paired.any() else None


def build_forecast(series, horizon=FORECAST_MONTHS):
    """Operational horizon starts after its own declared training calendar."""
    series = series[["ds","y"]].sort_values("ds").reset_index(drop=True)
    if series.y.notna().sum() < MIN_TRAIN_MONTHS:
        return pd.DataFrame(columns=["ds","yhat","yhat_lower","yhat_upper"])
    model = fit_prophet(series)
    origin = series.ds.max()
    dates = pd.date_range(origin + pd.offsets.MonthBegin(1), periods=horizon, freq="MS")
    fcst = predict(model,dates)
    if not (fcst.ds > origin).all(): raise ValueError("Production targets must follow training")
    return fcst[["ds","yhat","yhat_lower","yhat_upper"]]



def build_season_probes(series, horizon=PROBE_HORIZON):
    """One 3-month 'probe' forecast per season (dry, wet) for a region.

    Fits a single Prophet model on history up to TRAIN_END (2024-12-31),
    forecasts a horizon reaching both seasonal windows, then takes a 3-month
    slice from each season: DRY = the immediate Jan-Mar window, WET = the
    Jul-Sep climatological peak of the next season. Month offsets (1-based)
    count months after the last training month.
    """
    series = series[series["ds"] <= TRAIN_END].reset_index(drop=True)
    if series["y"].notna().sum() < MIN_TRAIN_MONTHS:
        return pd.DataFrame(columns=["ds", "season", "yhat", "yhat_lower", "yhat_upper"])
    model = fit_prophet(series)
    future_dates = pd.date_range(TRAIN_END.to_period("M").to_timestamp() + pd.offsets.MonthBegin(1), periods=horizon, freq=FREQ)
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


def _series_job(job):
    """Independent, resumable region job; caches are keyed by input and code hashes."""
    import hashlib, json
    disease, region, group, probes_only = job
    series = group.rename(columns={"date":"ds","cases":"y"})[["ds","y"]].sort_values("ds")
    digest = hashlib.sha256(series.to_csv(index=False).encode() + Path(__file__).read_bytes() + str(probes_only).encode()).hexdigest()
    cache = ingest.PROCESSED_DIR / "checkpoints" / (hashlib.sha256((disease+region).encode()).hexdigest()[:16]+".json")
    if cache.exists():
        saved=json.loads(cache.read_text(encoding="utf-8"))
        if saved.get("input_code_hash")==digest:return saved
    result=dict(disease=disease,region=region,input_code_hash=digest,forecasts=[],probes=[],metrics=[],validation=[],exclusions=[])
    if series.y.notna().sum()<MIN_TRAIN_MONTHS or series.y.dropna().eq(0).all():
        result["exclusions"].append(dict(reason="insufficient_observed_history_or_all_zero"))
    else:
        def records(frame):
            frame=frame.copy()
            if "ds" in frame:frame["ds"]=pd.to_datetime(frame.ds).dt.strftime("%Y-%m-%d")
            return frame.astype(object).where(pd.notna(frame),None).to_dict(orient="records")
        result["probes"]=records(build_season_probes(series))
        if not probes_only:
            for window,end in WINDOWS.items():
                validation=walk_forward_validation(series,end_date=end)
                if validation is None:
                    result["exclusions"].append(dict(window=window,reason="insufficient_train_or_no_observed_targets"));continue
                # Shared actual/prior-year mask for comparable model/baseline scores.
                lookup=series.set_index("ds").y
                baseline=lookup.reindex(pd.DatetimeIndex(validation.ds)-pd.DateOffset(years=1)).to_numpy()
                scoreable=validation.y.notna().to_numpy() & np.isfinite(baseline)
                scored=validation.copy();scored.loc[~scoreable,"y"]=np.nan
                scores=score(scored)
                naive=float(np.abs(validation.y.to_numpy()[scoreable]-baseline[scoreable]).mean()) if scoreable.any() else None
                result["validation"].extend(records(validation.assign(window=window)))
                if scores["months"]==0:
                    result["exclusions"].append(dict(window=window,reason="no_paired_actual_and_prior_year"));continue
                result["metrics"].append(dict(window=window,**scores,naive_MAE=naive,skill_vs_naive_pct=(1-scores["MAE"]/naive)*100 if naive is not None and naive>0 else None))
            result["forecasts"]=records(build_forecast(series))
    cache.parent.mkdir(parents=True,exist_ok=True)
    temporary=cache.with_suffix(".tmp");temporary.write_text(json.dumps(result,allow_nan=False),encoding="utf-8");temporary.replace(cache)
    return result


def run(probes_only=False):
    from concurrent.futures import ProcessPoolExecutor
    import os
    for key in ["OMP_NUM_THREADS","OPENBLAS_NUM_THREADS","MKL_NUM_THREADS"]:os.environ[key]="1"
    df=load_series()
    jobs=[(disease,region,group,probes_only) for (disease,region),group in df.groupby(["disease","region"]) if disease in config.FORECAST_READY_DISEASES]
    collected={"forecasts":[],"probes":[],"metrics":[],"validation":[],"exclusions":[]}
    with ProcessPoolExecutor(max_workers=int(os.environ.get("HEALTHWATCH_WORKERS","4"))) as pool:
        for result in pool.map(_series_job,jobs):
            for kind in collected:
                collected[kind].extend(dict(disease=result["disease"],region=result["region"],**row) for row in result[kind])
            print("COMPLETE",result["disease"],result["region"],flush=True)
    mapping={"forecasts":"forecasts.csv","probes":"season_probes.csv","metrics":"validation_metrics.csv","validation":"validation_predictions.csv","exclusions":"forecast_exclusions.csv"}
    for kind,rows in collected.items():
        if probes_only and kind not in {"probes","exclusions"}:continue
        frame=pd.DataFrame(rows)
        if kind in {"forecasts","probes"}:frame=frame.rename(columns={"ds":"target_date"})
        ingest.save_processed(frame,mapping[kind])
    return pd.DataFrame(collected["forecasts"]),pd.DataFrame(collected["metrics"])



if __name__ == "__main__":
    import sys

    probes_only = "--probes-only" in sys.argv
    run(probes_only=probes_only)