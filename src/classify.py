import numpy as np
import pandas as pd

from . import ingest

HISTORY_END = pd.Timestamp("2024-12-31")
TIER_ORDER = {"Low": 0, "Moderate": 1, "High": 2}

# Calendar wet/dry season mapping used by the outbreak indicator, matching
# features.py: wet = Jun-Nov (months 6-11), dry = Dec-May (12,1-5). The month
# (not the date-week) decides the season, so weeks never split across seasons.
def season_of(date):
    """Return 'wet' | 'dry' for a date-like, matching features.py wet/dry flag."""
    m = pd.Timestamp(date).month
    return "wet" if 6 <= m <= 11 else "dry"


def load_history():
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_weekly.csv", parse_dates=["date"]
    )
    regional = pd.read_csv(
        ingest.PROCESSED_DIR / "regional_dengue_weekly.csv", parse_dates=["date"]
    )
    df = pd.concat([national, regional], ignore_index=True)
    return df[df["date"] <= HISTORY_END].copy()


def with_iso_week(df, date_col="date"):
    out = df.copy()
    out["iso_week"] = pd.to_datetime(out[date_col]).dt.isocalendar().week.astype(int)
    # ISO calendars occasionally produce a 53rd week; fold it into week 1 so
    # threshold lookups always hit (mirrors the frontend's modulo bucketing).
    out.loc[out["iso_week"] > 52, "iso_week"] = 1
    return out


def compute_thresholds(history):
    h = with_iso_week(history)
    thresholds = (
        h.groupby(["disease", "region", "iso_week"])["cases"]
        .quantile([0.5, 0.75])
        .unstack()
        .rename(columns={0.5: "p50", 0.75: "p75"})
        .clip(lower=0)
        .reset_index()
    )
    return thresholds


def compute_seasonal_thresholds(history):
    """Per-(disease, region, season) P75 of pre-2020 historical cases.

    Pools every historical weekly case count that falls within the season
    (wet = Jun-Nov, dry = Dec-May) and takes the 75th percentile. This season
    baseline backs Rule B of the outbreak indicator (season sum up-lift) and
    reuses the same pre-COVID history as the weekly percentiles.
    """
    h = history.copy()
    h["season"] = h["date"].map(season_of)
    thresholds = (
        h.groupby(["disease", "region", "season"])["cases"]
        .quantile(0.75)
        .rename("p75")
        .clip(lower=0)
        .reset_index()
    )
    counts = h.groupby(["disease", "region", "season"])["cases"].size().rename("n_weeks")
    thresholds = thresholds.merge(counts, on=["disease", "region", "season"], how="left")
    thresholds["p75"] = thresholds["p75"].round(1)
    return thresholds.sort_values(["region", "season"], ignore_index=True)


def label(values, p50, p75):
    values = np.asarray(values, dtype=float)
    p50 = np.asarray(p50, dtype=float)
    p75 = np.asarray(p75, dtype=float)
    return np.where(values < p50, "Low", np.where(values <= p75, "Moderate", "High"))


def _apply_tiers(rows, thresholds):
    """Join risk tiers (p50/p75) onto forecast rows by iso_week and label them."""
    merged = with_iso_week(rows).merge(
        thresholds, on=["disease", "region", "iso_week"], how="left"
    )
    missing = merged[merged[["p50", "p75"]].isna().any(axis=1)]
    if not missing.empty:
        sample = missing[["region", "iso_week"]].drop_duplicates().head(5)
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


def classify_seasonal(thresholds):
    """Classify the season-probe forecasts (dry + wet windows) into risk tiers.

    Same weekly P75 thresholding as classify_forecasts, but applied to
    season_probes.csv so each region gets a dry- and wet-season risk label for
    the outbreak indicator, without altering the dashboard's next-12-weeks view.
    """
    probes = pd.read_csv(ingest.PROCESSED_DIR / "season_probes.csv").rename(
        columns={"target_date": "date"}
    )
    probes["date"] = pd.to_datetime(probes["date"])
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
    merged = with_iso_week(predictions).merge(
        thresholds, on=["disease", "region", "iso_week"], how="left"
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
        .agg(tier_accuracy_pct=("correct", "mean"), severe_miss_pct=("severe_miss", "mean"), weeks=("correct", "size"))
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
          f"({len(history)} rows, COVID years excluded)")
    print(f"Saved {len(thresholds)} region-week thresholds -> {thresholds_path}")
    print(f"Saved {len(seasonal_thr)} region-season thresholds -> {seasonal_thr_path}")
    print(f"Saved {len(classification)} classified forecasts -> {classification_path}")
    print(f"Saved {len(seasonal_cls)} classified seasonal probes -> {seasonal_cls_path}")
    print(f"Saved {len(accuracy)} backtest rows -> {accuracy_path}")

    summary = (
        classification.groupby("risk_level")["region"].count().reindex(["Low", "Moderate", "High"])
    )
    print("\nForecast risk distribution (next 12 weeks):")
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
