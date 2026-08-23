import numpy as np
import pandas as pd

from . import ingest

HISTORY_END_YEAR = 2019
TIER_ORDER = {"Low": 0, "Moderate": 1, "High": 2}


def load_history():
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_weekly.csv", parse_dates=["date"]
    )
    regional = pd.read_csv(
        ingest.PROCESSED_DIR / "regional_dengue_weekly.csv", parse_dates=["date"]
    )
    df = pd.concat([national, regional], ignore_index=True)
    return df[df["date"].dt.year <= HISTORY_END_YEAR].copy()


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


def label(values, p50, p75):
    values = np.asarray(values, dtype=float)
    p50 = np.asarray(p50, dtype=float)
    p75 = np.asarray(p75, dtype=float)
    return np.where(values < p50, "Low", np.where(values <= p75, "Moderate", "High"))


def classify_forecasts(thresholds):
    forecasts = pd.read_csv(ingest.PROCESSED_DIR / "forecasts.csv").rename(
        columns={"target_date": "date"}
    )
    forecasts["date"] = pd.to_datetime(forecasts["date"])
    merged = with_iso_week(forecasts).merge(
        thresholds, on=["disease", "region", "iso_week"], how="left"
    )
    missing = merged[merged[["p50", "p75"]].isna().any(axis=1)]
    if not missing.empty:
        sample = missing[["region", "iso_week"]].drop_duplicates().head(5)
        raise ValueError(f"Missing historical thresholds for: {sample.to_dict('records')}")
    merged["risk_level"] = label(merged["yhat"], merged["p50"], merged["p75"])
    out = merged[["disease", "region", "date", "yhat", "p50", "p75", "risk_level"]]
    return out.sort_values(["region", "date"], ignore_index=True)


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

    classification = classify_forecasts(thresholds)
    classification_path = ingest.save_processed(classification, "risk_classification.csv")

    accuracy = tier_backtest(thresholds)
    accuracy_path = ingest.save_processed(accuracy, "tier_accuracy.csv")

    print(f"History used: {history['date'].min().year}-{HISTORY_END_YEAR} "
          f"({len(history)} rows, COVID years excluded)")
    print(f"Saved {len(thresholds)} region-week thresholds -> {thresholds_path}")
    print(f"Saved {len(classification)} classified forecasts -> {classification_path}")
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
