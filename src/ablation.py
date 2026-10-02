"""Empirical ablation: does the deterministic wet/dry regressor double-count the
yearly seasonality that Prophet's Fourier terms already model?

Config A - yearly_seasonality=True, is_wet_season regressor omitted
Config B - DEPLOYED, the fit_prophet defaults: yearly_seasonality=False,
         is_wet_season present
Config C - both terms, i.e. the configuration this pipeline originally rejected

On the corrected walk-forward windows the original ordering REVERSES: C has the
lowest MAE in 12 of 19 dengue regions on 2025_prospective and 10 of 19 on
last_12m, and the lowest MAPE in both windows, while B keeps the lowest RMSE.
The projected R2 is 1.0 with a joint condition number of ~6.1e16, so the two
seasonal channels are not separately identified and C's edge is not safely
attributable. See forecast.py and RESULTS_AFTER_FIX.md.

For every region and every walk-forward window we report MAE / RMSE / MAPE on
the held-out months, the seasonal-naive baseline and skill, and the mean
predicted volume over the validation horizon (the inflation check). We also
report the overlap statistic: the fraction of variance of the is_wet_season
step function explained by the yearly Fourier columns (projected R2). This
quantifies how collinear the two seasonal channels are on the training calendar.

Run: python -m src.ablation (all five diseases, ~1,400 fits, run detached) or
python -m src.ablation --disease Dengue for a single-disease sweep.
"""

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from . import forecast, ingest

logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

CONFIGS = {
    "A": {"use_year_seasonality": True, "use_wet_regressor": False},
    "B": {"use_year_seasonality": False, "use_wet_regressor": True},
    "C": {"use_year_seasonality": True, "use_wet_regressor": True},
}

OUT = Path(__file__).resolve().parent.parent / "data" / "processed"


def fit_model(train, use_year_seasonality, use_wet_regressor):
    return forecast.fit_prophet(
        train, use_year_seasonality=use_year_seasonality,
        use_wet_regressor=use_wet_regressor,
    )


def predict(model, dates, use_wet_regressor):
    return forecast.predict(model, dates, use_wet_regressor=use_wet_regressor)


def walk_forward_validation(series, use_year_seasonality, use_wet_regressor,
                            val_months=forecast.VAL_MONTHS, end_date=None):
    series = series.reset_index(drop=True)
    split = forecast._split_index(series, val_months, end_date)
    # Same drop-out rule as forecast.walk_forward_validation: a series that
    # stops reporting inside the window has no holdout months to score.
    if split < forecast.MIN_TRAIN_MONTHS or split + val_months > len(series):
        return None
    preds = []
    model = None
    for step in range(val_months):
        cutoff = split + step
        if model is None or step % forecast.REFIT_EVERY == 0:
            model = fit_model(
                series.iloc[:cutoff][["ds", "y"]],
                use_year_seasonality, use_wet_regressor,
            )
        raw = predict(model, [series.loc[cutoff, "ds"]], use_wet_regressor)["yhat"].iloc[0]
        preds.append(raw)
    out = series.iloc[split: split + val_months][["ds", "y"]].copy()
    out["yhat"] = np.clip(preds, 0, None)
    return out


def score_row(validation, naive_mae):
    err = validation["y"] - validation["yhat"]
    nonzero = validation["y"] != 0
    return {
        "MAE": round(float(np.mean(np.abs(err))), 2),
        "RMSE": round(float(np.sqrt(np.mean(err ** 2))), 2),
        "MAPE": (
            round(float(np.mean(np.abs(err[nonzero] / validation["y"][nonzero])) * 100), 2)
            if nonzero.any() else float("nan")
        ),
        "val_mean_yhat": round(float(validation["yhat"].mean()), 2),
        "val_mean_y": round(float(validation["y"].mean()), 2),
        "months": int(len(validation)),
        "naive_MAE": naive_mae,
        "skill_pct": (
            round((1 - np.mean(np.abs(err)) / naive_mae) * 100, 1)
            if naive_mae else None
        ),
    }


def overlap_statistic(series):
    """Projected R2 of the wet-season step function on the yearly Fourier
    columns, plus the condition number of the joint (intercept, Fourier, wet)
    design matrix. Computed on the region's actual training calendar."""
    months = np.array(pd.to_datetime(series["ds"]).dt.month, dtype=float)
    wet = ((months >= 6) & (months <= 11)).astype(float)

    fourier = []
    for k in range(1, 11):
        fourier.append(np.cos(2 * np.pi * k * months / 12.0))
        fourier.append(np.sin(2 * np.pi * k * months / 12.0))
    F = np.column_stack([np.ones(len(months)), *fourier])

    w_centered = wet - wet.mean()
    F_centered = F - F.mean(axis=0)
    beta, *_ = np.linalg.lstsq(F_centered, w_centered, rcond=None)
    pred = F_centered @ beta
    ss_res = float(np.sum((w_centered - pred) ** 2))
    ss_tot = float(np.sum(w_centered ** 2)) or 1.0
    r2 = 1.0 - ss_res / ss_tot

    joint = np.column_stack([F, wet])
    cond = float(np.linalg.cond(joint))
    return round(r2, 4), round(cond, 2)


def _naive_mae(series, val_months, end_date):
    split = forecast._split_index(series, val_months, end_date)
    if split is None or split < val_months or split + val_months > len(series):
        return None
    actual = series.iloc[split: split + val_months]["y"].to_numpy(dtype=float)
    naive = series["y"].shift(val_months).iloc[split: split + val_months].to_numpy(dtype=float)
    ok = ~(np.isnan(actual) | np.isnan(naive))
    return round(float(np.mean(np.abs(actual[ok] - naive[ok]))), 2) if ok.any() else None


def production_volume(series, use_year_seasonality, use_wet_regressor):
    series = series[["ds", "y"]].reset_index(drop=True)
    model = fit_model(series, use_year_seasonality, use_wet_regressor)
    last = series["ds"].max()
    future_dates = pd.date_range(last, periods=forecast.FORECAST_MONTHS + 1,
                                 freq=forecast.FREQ)[1:]
    fcst = predict(model, future_dates, use_wet_regressor)
    yhat = fcst["yhat"].clip(lower=1.0)
    return round(float(yhat.mean()), 2)


def run(disease=None):
    """Fit configs A/B/C on the validation windows and report the cost.

    `disease` restricts the sweep to one disease. The full sweep is ~1,400
    Prophet fits and runs detached; a single-disease run is the practical unit
    and is what the chapter's numbers are computed from. The CSVs carry a
    `disease` column either way, so a filtered run stays self-describing.
    """
    df = forecast.load_series()
    if disease:
        if disease not in set(df["disease"].unique()):
            raise ValueError(
                f"Unknown disease {disease!r}. Choose from: "
                + ", ".join(sorted(df["disease"].unique()))
            )
        df = df[df["disease"] == disease]
    metric_rows = []
    overlap_rows = []
    volume_rows = []

    for (dis, region), group in df.groupby(["disease", "region"]):
        series = group.rename(columns={"date": "ds", "cases": "y"})[["ds", "y"]]
        r2, cond = overlap_statistic(series)
        overlap_rows.append({"disease": dis, "region": region,
                             "R2_fourier_explains_wet": r2, "cond_num_joint": cond})

        for config, params in CONFIGS.items():
            vol = production_volume(series, params["use_year_seasonality"],
                                    params["use_wet_regressor"])
            volume_rows.append({"disease": dis, "region": region, "config": config,
                                "y5": params["use_year_seasonality"],
                                "wet": params["use_wet_regressor"],
                                "mean_yhat_12mo": vol})
            for window_name, end_date in forecast.WINDOWS.items():
                validation = walk_forward_validation(
                    series, params["use_year_seasonality"],
                    params["use_wet_regressor"], end_date=end_date,
                )
                if validation is None:
                    continue
                row = score_row(validation, _naive_mae(series, forecast.VAL_MONTHS, end_date))
                metric_rows.append({
                    "disease": dis, "region": region, "window": window_name,
                    "config": config,
                    "year_seasonality": params["use_year_seasonality"],
                    "wet_regressor": params["use_wet_regressor"], **row,
                })

    metrics = pd.DataFrame(metric_rows)
    overlap = pd.DataFrame(overlap_rows)
    volumes = pd.DataFrame(volume_rows)

    metrics_path = ingest.save_processed(metrics, "ablation_metrics.csv")
    overlap_path = ingest.save_processed(overlap, "ablation_overlap.csv")
    volume_path = ingest.save_processed(volumes, "ablation_production_volumes.csv")

    scope = disease or "all diseases"
    print(f"Scope: {scope} "
          f"({metrics.groupby('disease')['region'].nunique().to_dict() if len(metrics) else {}})")
    print(f"Saved -> {metrics_path}")
    print(f"Saved -> {overlap_path}")
    print(f"Saved -> {volume_path}")

    print("\nOverlap statistic (collinearity of wet-step on Fourier columns):")
    print(overlap[["disease", "region", "R2_fourier_explains_wet", "cond_num_joint"]]
          .head(3).to_string(index=False))

    w = "2025_prospective"
    sub = metrics[metrics["window"] == w]
    pivot = sub.pivot_table(
        index=["disease", "region"], columns="config",
        values=["MAE", "RMSE", "MAPE", "val_mean_yhat"],
        aggfunc="first",
    )
    print(f"\nConfig comparison on {w} (means across the swept series):")
    print(pivot.groupby(level=0).mean().round(2).to_string())

    print("\nType II region: Eastern Visayas")
    ev = sub[sub["region"] == "Eastern Visayas"]
    print(ev[["disease", "config", "MAE", "RMSE", "MAPE", "val_mean_yhat",
              "val_mean_y", "skill_pct"]].to_string(index=False))

    print("\nProduction 12-month mean volume (inflation check) - Eastern Visayas,"
          " and means per config:")
    evv = volumes[volumes["region"] == "Eastern Visayas"]
    print(evv[["disease", "config", "mean_yhat_12mo"]].to_string(index=False))
    print(volumes.groupby(["disease", "config"])["mean_yhat_12mo"].mean().round(2).to_string())

    return metrics, overlap, volumes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--disease", default=None,
        help="Restrict the sweep to one disease (e.g. --disease Dengue). "
             "Omit for all five; the full sweep is ~1,400 Prophet fits.",
    )
    args = parser.parse_args()
    run(disease=args.disease)


if __name__ == "__main__":
    main()