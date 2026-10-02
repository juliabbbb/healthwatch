"""Prospective validation of the 2025 seasonal outbreak indicator.

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

Predicted flag is recomputed IN-PROCESS by validation_pool_indicators() on the
same pre-2025 pool, NOT read from outbreak_indicators.csv. The production file
thresholds the probes against percentiles whose baseline runs through 2026-08
and therefore contains the 2025 months being predicted, so scoring a 2025
prospective check against it leaks the holdout into the predicted side (13 of
188 flags were contaminated). Result: per (region, season) table plus an overall
confusion matrix (TP / FP / FN / TN) and precision / recall / F1, and
forecast-error for each season probe.

Run: python -m src.validate_2025
"""

import pandas as pd

from . import classify, ingest, outbreak
from .classify import with_month_of_year
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
    """PRODUCTION indicators (baseline through 2026-08).

    Not a valid predicted side for the 2025 prospective check -- see
    validation_pool_indicators(). Retained for provenance/debugging only.
    """
    return pd.read_csv(
        ingest.PROCESSED_DIR / "outbreak_indicators.csv",
        parse_dates=["probe_anchor", "season_start", "season_end"],
    )


def validation_pool_indicators():
    """Predicted-side outbreak indicators rebuilt on the pre-2025 pool.

    Mirrors what classify.run() + outbreak.run() produce for the dashboard, but
    with the thresholds taken from `load_history(HISTORY_END)` so the baseline
    stops at 2024-12-31 and neither side of the confusion matrix can see 2025.
    """
    history = classify.load_history(classify.HISTORY_END)
    if history["date"].max() > classify.HISTORY_END:
        raise AssertionError(
            f"validation pool leaked past {classify.HISTORY_END.date()}: "
            f"max date {history['date'].max().date()}"
        )
    thresholds = classify.compute_thresholds(history)
    seasonal = classify.compute_seasonal_thresholds(history)
    probes = pd.read_csv(ingest.PROCESSED_DIR / "season_probes.csv")
    classification = classify.classify_seasonal(thresholds, probes=probes)
    return outbreak.detect_outbreaks(classification, seasonal)


def load_monthly_thresholds():
    # Pre-2025 validation pool (classify.run writes these from history <= 2024-12-31).
    return pd.read_csv(ingest.PROCESSED_DIR / "validation_thresholds.csv")


def load_seasonal_thresholds():
    return pd.read_csv(ingest.PROCESSED_DIR / "validation_seasonal_thresholds.csv")


def _actual_high_run(month_cases, month_p75s):
    classes = ["High" if c > p75 else "not" for c, p75 in zip(month_cases, month_p75s)]
    return _longest_high_run(classes)


def validate(observed=None, indicators=None, monthly=None, seasonal=None):
    observed = observed if observed is not None else load_observed()
    indicators = indicators if indicators is not None else validation_pool_indicators()
    monthly = monthly if monthly is not None else load_monthly_thresholds()
    seasonal = seasonal if seasonal is not None else load_seasonal_thresholds()

    rows = []
    for disease, region in indicators[["disease", "region"]].drop_duplicates().itertuples(index=False):
        for season, (start, end) in PROBE_WINDOWS.items():
            seg = observed[
                (observed["disease"] == disease)
                & (observed["region"] == region)
                & (observed["date"] >= start)
                & (observed["date"] <= end)
            ].sort_values("date")
            if seg.empty:
                continue

            avg_actual = float(seg["cases"].mean())
            max_actual = float(seg["cases"].max())

            thr = monthly[
                (monthly["disease"] == disease) & (monthly["region"] == region)
            ]
            seg = with_month_of_year(seg).merge(
                thr[["month", "p75", "p50"]], on="month", how="left"
            )
            p75s = seg["p75"].fillna(0).tolist()
            high_run_actual = _actual_high_run(seg["cases"].tolist(), p75s)
            rule_a_actual = high_run_actual >= CONSECUTIVE_HIGH_N

            srow = seasonal[
                (seasonal["disease"] == disease)
                & (seasonal["region"] == region)
                & (seasonal["season"] == season)
            ]
            season_p75 = float(srow["p75"].iloc[0]) if not srow.empty else float("nan")
            rule_b_actual = avg_actual > season_p75 if pd.notna(season_p75) else False
            actual_flag = bool(rule_a_actual or rule_b_actual)

            # Keyed on the anchor as well as the season: the production table is
            # keyed on probe_anchor so a season verdict carries its position in
            # time, and an unkeyed .iloc[0] would silently pick one anchor's
            # verdict if a second anchor were ever added.
            ind = indicators[
                (indicators["disease"] == disease)
                & (indicators["region"] == region)
                & (indicators["season"] == season)
                & (indicators["probe_anchor"] == start)
            ]
            predicted = bool(ind["outbreak"].iloc[0]) if not ind.empty else False
            forecast_avg = float(ind["season_avg"].iloc[0]) if not ind.empty else float("nan")

            rows.append(
                {
                    "disease": disease,
                    "region": region,
                    "season": season,
                    "forecast_avg": forecast_avg,
                    "actual_avg": round(avg_actual, 1),
                    "actual_max": round(max_actual, 1),
                    "season_p75": season_p75,
                    "actual_high_run": int(high_run_actual),
                    "predicted": predicted,
                    "actual_outbreak": actual_flag,
                    "rule_a_actual": rule_a_actual,
                    "rule_b_actual": rule_b_actual,
                }
            )

    df = pd.DataFrame(rows)
    df["tp"] = df["predicted"] & df["actual_outbreak"]
    df["fp"] = df["predicted"] & ~df["actual_outbreak"]
    df["fn"] = ~df["predicted"] & df["actual_outbreak"]
    df["tn"] = ~df["predicted"] & ~df["actual_outbreak"]
    return df.sort_values(["region", "season"], ignore_index=True)


def summarize(df):
    lines = []
    n = len(df)
    tp, fp = int(df["tp"].sum()), int(df["fp"].sum())
    fn, tn = int(df["fn"].sum()), int(df["tn"].sum())
    precision = tp / (tp + fp) if tp + fp else float("nan")
    recall = tp / (tp + fn) if tp + fn else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else float("nan")
    lines.append(f"region-seasons validated: {n}")
    lines.append(f"confusion  TP={tp}  FP={fp}  FN={fn}  TN={tn}")
    lines.append(f"precision  {precision:.2f}   recall  {recall:.2f}   F1  {f1:.2f}")

    # forecast accuracy per season
    for s in ["dry", "wet"]:
        sub = df[df["season"] == s].copy()
        sub["ape"] = (sub["forecast_avg"] - sub["actual_avg"]).abs() / sub["actual_avg"].replace(0, float("nan"))
        mape = sub["ape"].mean() * 100 if sub["ape"].notna().any() else float("nan")
        lines.append(
            f"[{s:>3}] MAPE={mape:.0f}%  mean_forecast={sub['forecast_avg'].mean():.0f}  "
            f"mean_actual={sub['actual_avg'].mean():.0f}"
        )
    return "\n".join(lines)


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