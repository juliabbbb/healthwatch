import numpy as np
import pandas as pd

from . import ingest

HISTORY_END = pd.Timestamp("2024-12-31")
TIER_ORDER = {"Low": 0, "Moderate": 1, "High": 2}

# Calendar wet/dry season mapping used by the outbreak indicator, matching
# features.py: wet = Jun-Nov (months 6-11), dry = Dec-May (12,1-5). The month
# (not the date-week) decides the season, so months never split across seasons.
#
# PAGASA Modified Corona Climate Classification overrides: Type II regions
# (Bicol Region, Eastern Visayas, Caraga) receive their maximum rainfall during
# Dec-Feb, inverting the national monsoon-driven wet window. The production
# pipeline keeps the national calendar (Type I generalization); SEASON_RULES
# exists so the regional sensitivity study can re-run Rule B and the seasonal
# probes under each region's local calendar without touching the month-anchored
# percentile tiers (which are climate-agnostic by construction).
SEASON_RULES = {
    "Bicol Region": {12, 1, 2, 3, 4, 5},     # Type II
    "Eastern Visayas": {12, 1, 2, 3, 4, 5},  # Type II
    "Caraga": {12, 1, 2, 3, 4, 5},           # Type II
}


def wet_months_of(region):
    return SEASON_RULES.get(region) or set(range(6, 12))


def season_of(date, region=None):
    """Return 'wet' | 'dry' for a date-like. Defaults to the national calendar
    (features.py wet/dry flag); honours SEASON_RULES when a region is given."""
    m = pd.Timestamp(date).month
    return "wet" if m in wet_months_of(region) else "dry"


def load_history():
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_monthly.csv", parse_dates=["date"]
    )
    regional = pd.read_csv(
        ingest.PROCESSED_DIR / "regional_dengue_monthly.csv", parse_dates=["date"]
    )
    df = pd.concat([national, regional], ignore_index=True)
    return df[df["date"] <= HISTORY_END].copy()


def with_month_of_year(df, date_col="date"):
    out = df.copy()
    out["month"] = pd.to_datetime(out[date_col]).dt.month.astype(int)
    return out


def with_iso_week(df, date_col="date"):
    """ISO-week bucketing used only by the standalone known-epidemic check on
    the historical weekly fixture; the live pipeline is monthly."""
    out = df.copy()
    out["iso_week"] = pd.to_datetime(out[date_col]).dt.isocalendar().week.astype(int)
    out.loc[out["iso_week"] > 52, "iso_week"] = 1
    return out


def compute_weekly_thresholds(history):
    """Per-(disease, region, iso_week) P50/P75 of historical weekly cases.

    Weekly variant for the known-epidemic fixture (2016-2021); the monthly
    pipeline uses `compute_thresholds` instead."""
    h = with_iso_week(history)
    thresholds = (
        h.groupby(["disease", "region", "iso_week"])["cases"]
        .quantile([0.5, 0.75])
        .unstack()
        .rename(columns={0.5: "p50", 0.75: "p75"})
        .clip(lower=0)
        .reset_index()
    )
    return thresholds.sort_values(["region", "iso_week"], ignore_index=True)


def compute_thresholds(history):
    h = with_month_of_year(history)
    thresholds = (
        h.groupby(["disease", "region", "month"])["cases"]
        .quantile([0.5, 0.75])
        .unstack()
        .rename(columns={0.5: "p50", 0.75: "p75"})
        .clip(lower=0)
        .reset_index()
    )
    return thresholds.sort_values(["region", "month"], ignore_index=True)


def compute_seasonal_thresholds(history, season_func=None):
    """Per-(disease, region, season) P75 of pre-2025 historical cases.

    Pools every historical monthly case count that falls within the season
    (wet = Jun-Nov, dry = Dec-May) and takes the 75th percentile. This season
    baseline backs Rule B of the outbreak indicator (season sum up-lift) and
    reuses the same pre-2025 history as the monthly percentiles. Pass a
    per-region `season_func(date, region)` to apply a climate-type override.
    """
    h = history.copy()
    if season_func is None:
        h["season"] = np.where(
            (h["date"].dt.month >= 6) & (h["date"].dt.month <= 11), "wet", "dry"
        )
    else:
        h["season"] = h.apply(
            lambda r: season_func(r["date"], r["region"]), axis=1
        )
    thresholds = (
        h.groupby(["disease", "region", "season"])["cases"]
        .quantile(0.75)
        .rename("p75")
        .clip(lower=0)
        .reset_index()
    )
    counts = (
        h.groupby(["disease", "region", "season"])["cases"].size().rename("n_months")
    )
    thresholds = thresholds.merge(counts, on=["disease", "region", "season"], how="left")
    thresholds["p75"] = thresholds["p75"].round(1)
    return thresholds.sort_values(["region", "season"], ignore_index=True)


def label(values, p50, p75):
    values = np.asarray(values, dtype=float)
    p50 = np.asarray(p50, dtype=float)
    p75 = np.asarray(p75, dtype=float)
    return np.where(values < p50, "Low", np.where(values <= p75, "Moderate", "High"))


def _apply_tiers(rows, thresholds):
    """Join risk tiers (p50/p75) onto monthly forecast rows by month-of-year."""
    merged = with_month_of_year(rows).merge(
        thresholds, on=["disease", "region", "month"], how="left"
    )
    missing = merged[merged[["p50", "p75"]].isna().any(axis=1)]
    if not missing.empty:
        sample = missing[["region", "month"]].drop_duplicates().head(5)
        raise ValueError(f"Missing historical thresholds for: {sample.to_dict('records')}")
    merged["risk_level"] = label(merged["yhat"], merged["p50"], merged["p75"])
    return merged


def classify_forecasts(thresholds):
    forecasts = pd.read_csv(ingest.PROCESSED_DIR / "forecasts.csv").rename(
        columns={"target_date": "date"}
    )
    forecasts["date"] = pd.to_datetime(forecasts["date"])
    merged = _apply_tiers(forecasts, thresholds)
    out = merged[["disease", "region", "date", "yhat", "p50", "p75", "risk_level"]]
    return out.sort_values(["region", "date"], ignore_index=True)


def classify_seasonal(thresholds, probes=None, season_func=None):
    """Classify the season-probe forecasts (dry + wet windows) into risk tiers.

    Same monthly P75 thresholding as classify_forecasts, but applied to
    season_probes.csv so each region gets a dry- and wet-season risk label for
    the outbreak indicator, without altering the dashboard's next-12-months view.
    Pass `season_func(date, region)` to relabel probes under a regional
    climate-type override (Type II regions: the Jan-Mar 'dry' probe is actually
    their local wet peak).
    """
    if probes is None:
        probes = pd.read_csv(ingest.PROCESSED_DIR / "season_probes.csv").rename(
            columns={"target_date": "date"}
        )
    else:
        probes = probes.rename(columns={"target_date": "date"})
    probes["date"] = pd.to_datetime(probes["date"])
    if season_func is not None:
        probes["season"] = probes.apply(
            lambda r: season_func(r["date"], r["region"]), axis=1
        )
    merged = _apply_tiers(probes, thresholds)
    out = merged[
        ["disease", "region", "season", "date", "yhat", "p50", "p75", "risk_level"]
    ]
    return out.sort_values(["region", "season", "date"], ignore_index=True)


def tier_backtest(thresholds):
    predictions = pd.read_csv(
        ingest.PROCESSED_DIR / "validation_predictions.csv"
    )
    predictions = predictions.rename(columns={"ds": "date"})
    predictions["date"] = pd.to_datetime(predictions["date"])
    merged = with_month_of_year(predictions).merge(
        thresholds, on=["disease", "region", "month"], how="left"
    )
    merged = merged.dropna(subset=["p50", "p75"])
    merged["actual_tier"] = label(merged["y"], merged["p50"], merged["p75"])
    merged["pred_tier"] = label(merged["yhat"], merged["p50"], merged["p75"])
    actual_rank = merged["actual_tier"].map(TIER_ORDER)
    pred_rank = merged["pred_tier"].map(TIER_ORDER)
    merged["correct"] = merged["actual_tier"] == merged["pred_tier"]
    merged["severe_miss"] = (actual_rank - pred_rank).abs() >= 2
    accuracy = (
        merged.groupby(["disease", "region", "window"])
        .agg(
            tier_accuracy_pct=("correct", "mean"),
            severe_miss_pct=("severe_miss", "mean"),
            months=("correct", "size"),
        )
        .reset_index()
    )
    accuracy["tier_accuracy_pct"] = (accuracy["tier_accuracy_pct"] * 100).round(1)
    accuracy["severe_miss_pct"] = (accuracy["severe_miss_pct"] * 100).round(1)
    return accuracy


def run():
    history = load_history()
    thresholds = compute_thresholds(history)
    thresholds_path = ingest.save_processed(thresholds, "risk_thresholds.csv")

    seasonal_thr = compute_seasonal_thresholds(history)
    seasonal_thr_path = ingest.save_processed(seasonal_thr, "seasonal_thresholds.csv")

    classification = classify_forecasts(thresholds)
    classification_path = ingest.save_processed(classification, "risk_classification.csv")

    seasonal_cls = classify_seasonal(thresholds)
    seasonal_cls_path = ingest.save_processed(seasonal_cls, "seasonal_classification.csv")

    accuracy = tier_backtest(thresholds)
    accuracy_path = ingest.save_processed(accuracy, "tier_accuracy.csv")

    print(f"History used: {history['date'].min().year}-{HISTORY_END.year} "
          f"({len(history)} rows, pre-2025 baseline)")
    print(f"Saved {len(thresholds)} region-month thresholds -> {thresholds_path}")
    print(f"Saved {len(seasonal_thr)} region-season thresholds -> {seasonal_thr_path}")
    print(f"Saved {len(classification)} classified forecasts -> {classification_path}")
    print(f"Saved {len(seasonal_cls)} classified seasonal probes -> {seasonal_cls_path}")
    print(f"Saved {len(accuracy)} backtest rows -> {accuracy_path}")

    summary = (
        classification.groupby("risk_level")["region"].count().reindex(["Low", "Moderate", "High"])
    )
    print("\nForecast risk distribution (next 12 months):")
    print(summary.to_string())

    print("\nTier accuracy by window:")
    window_summary = (
        accuracy.groupby("window")
        .agg(mean_accuracy=("tier_accuracy_pct", "mean"), mean_severe_miss=("severe_miss_pct", "mean"))
        .round(1)
    )
    print(window_summary.to_string())

    best = accuracy.sort_values("tier_accuracy_pct", ascending=False).head(3)
    worst = accuracy.sort_values("tier_accuracy_pct").head(3)
    print("\nBest regions:")
    print(best.to_string(index=False))
    print("\nWorst regions:")
    print(worst.to_string(index=False))
    return classification, accuracy


if __name__ == "__main__":
    run()