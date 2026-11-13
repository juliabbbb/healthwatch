"""Retrospective validation of the 2025 seasonal outbreak indicator.

The probe forecasts are fit through 2024-12-31, so the 2025 dry (Jan-Mar) and
wet (Jul-Sep) seasons were NOT part of training. This module validates the
predicted flags against the observed monthly DOH-EB 2025 data already in
regional_dengue_monthly.csv / national_monthly.csv (the same canonical source).

Ground truth mirrors the detector's own semantics, computed on observed data:
  Rule A (actual): longest run of >= 3 consecutive months whose cases exceed the
      region-month historical P75 (risk tier 'High' on observed cases).
  Rule B (actual): season's observed average monthly load exceeds the season's
      historical P75 (validation_seasonal_thresholds.csv, history <= 2024).
  actual_flag = RuleA_obs OR RuleB_obs.

Predicted flag comes from outbreak_indicators.csv. Result: per (region, season)
table plus an overall confusion matrix (TP / FP / FN / TN) and precision /
recall / F1, and forecast-error for each season probe.

Run: python -m src.validate_2025
"""

import pandas as pd

from . import ingest
from .classify import season_of, with_month_of_year
from .outbreak import CONSECUTIVE_HIGH_N, _longest_high_run

PROBE_WINDOWS = {
    # (season, start date, end date) — mirrors forecast.py wet/dry probe offsets
    "dry": (pd.Timestamp("2025-01-01"), pd.Timestamp("2025-03-31")),
    "wet": (pd.Timestamp("2025-07-01"), pd.Timestamp("2025-09-30")),
}


def load_observed():
    df = ingest.load_monthly_series()
    return df.sort_values(["disease", "region", "date"], ignore_index=True)


def load_indicators():
    from .classify import classify_seasonal
    from .outbreak import detect_outbreaks
    # Both predictions and actual reference labels use the same pre-2025 pools.
    cls = classify_seasonal(load_monthly_thresholds())
    indicators = detect_outbreaks(cls, load_seasonal_thresholds())
    ingest.save_processed(indicators, "evaluation_outbreak_indicators_2025.csv")
    return indicators


def load_monthly_thresholds():
    # Pre-2025 validation pool (classify.run writes these from history <= 2024-12-31).
    return pd.read_csv(ingest.PROCESSED_DIR / "validation_thresholds.csv")


def load_seasonal_thresholds():
    return pd.read_csv(ingest.PROCESSED_DIR / "validation_seasonal_thresholds.csv")


def _actual_high_run(month_cases, month_p75s):
    classes = ["High" if c > p75 else "not" for c, p75 in zip(month_cases, month_p75s)]
    return _longest_high_run(classes)


def validate(observed=None, indicators=None, monthly=None, seasonal=None):
    from .integrity import seasonal_rules
    observed = load_observed() if observed is None else observed
    indicators = load_indicators() if indicators is None else indicators
    monthly = load_monthly_thresholds() if monthly is None else monthly
    seasonal = load_seasonal_thresholds() if seasonal is None else seasonal
    rows, exclusions = [], []
    for disease,region in indicators[["disease","region"]].drop_duplicates().itertuples(index=False):
        for season,(start,end) in PROBE_WINDOWS.items():
            key=dict(disease=disease,region=region,season=season)
            dates=pd.date_range(start,end,freq="MS")
            seg=observed[(observed.disease==disease)&(observed.region==region)&observed.date.isin(dates)].sort_values("date")
            thr=monthly[(monthly.disease==disease)&(monthly.region==region)]
            seg=with_month_of_year(seg).merge(thr[["month","p50","p75"]],on="month",how="left",validate="many_to_one")
            pool=seasonal[(seasonal.disease==disease)&(seasonal.region==region)&(seasonal.season==season)]
            if len(pool)>1: raise ValueError("Duplicate seasonal pool")
            s75=float(pool.p75.iloc[0]) if len(pool) else float("nan")
            actual=seasonal_rules(seg.date,seg.cases,seg.p50,seg.p75,s75)
            pred=indicators[(indicators.disease==disease)&(indicators.region==region)&(indicators.season==season)]
            if len(pred)>1: raise ValueError("Duplicate predicted probe")
            pred_valid=len(pred)==1 and pd.notna(pred.outbreak.iloc[0])
            if pred_valid and "eligible" in pred: pred_valid=bool(pred.eligible.iloc[0])
            if pred_valid and {"target_start","target_end"}.issubset(pred):
                pred_valid=(pd.Timestamp(pred.target_start.iloc[0])==dates[0] and pd.Timestamp(pred.target_end.iloc[0])==dates[-1])
            if not actual["eligible"] or not pred_valid:
                exclusions.append(dict(**key,reason="incomplete_actual_prediction_threshold_or_dates"));continue
            p,a=bool(pred.outbreak.iloc[0]),actual["combined_flag"]
            rows.append(dict(**key,forecast_avg=float(pred.season_avg.iloc[0]),actual_avg=float(seg.cases.mean()),
                actual_max=float(seg.cases.max()),season_p75=s75,actual_high_run=_actual_high_run(seg.cases,seg.p75),
                predicted=p,actual_outbreak=a,rule_a_actual=actual["rule_a"],rule_b_actual=actual["rule_b"],
                tp=p and a,fp=p and not a,fn=not p and a,tn=not p and not a))
    ingest.save_processed(pd.DataFrame(exclusions,columns=["disease","region","season","reason"]),"outbreak_validation_exclusions.csv")
    return pd.DataFrame(rows,columns=["disease","region","season","forecast_avg","actual_avg","actual_max","season_p75","actual_high_run","predicted","actual_outbreak","rule_a_actual","rule_b_actual","tp","fp","fn","tn"])


def summarize(df):
    from .integrity import binary_metrics
    return str(binary_metrics(*(int(df[c].sum()) for c in ("tp","fp","fn","tn"))))


def run():
    result = validate()
    path = ingest.save_processed(result, "outbreak_validation_2025.csv")
    print(summarize(result))
    print()
    print(
        result[
            ["region", "season", "forecast_avg", "actual_avg", "actual_max",
             "season_p75", "predicted", "actual_outbreak"]
        ].to_string(index=False)
    )
    print(f"\nSaved -> {path}")
    return result


if __name__ == "__main__":
    run()