"""Calendar-edge regression checks for the classification pipeline.

Run:  .venv\\Scripts\\python -m src.check_calendar_edges

Covers the ISO-week-53 bug class: week numbers outside 1..52 breaking
threshold lookups (backend) — the frontend twin lives in
frontend/scripts/calendar-edge-check.ts.
"""

from . import classify, ingest
import pandas as pd


def test_week53_folds_into_week1():
    iso53_dates = ["2015-12-31", "2020-12-31"]  # both fall in ISO week 53
    df = pd.DataFrame({"date": pd.to_datetime(iso53_dates)})
    weeks = classify.with_iso_week(df)["iso_week"].tolist()
    assert weeks == [1, 1], f"week-53 dates must fold to 1, got {weeks}"
    print("PASS  with_iso_week folds ISO week 53 -> 1")


def test_thresholds_cover_all_52_weeks():
    thresholds = classify.compute_thresholds(classify.load_history())
    grouped = thresholds.groupby(["disease", "region"])["iso_week"].apply(set)
    full = set(range(1, 53))
    bad = {k: sorted(v ^ full) for k, v in grouped.items() if v != full}
    assert not bad, f"regions missing/extra threshold weeks: {bad}"
    print(f"PASS  all {len(grouped)} disease-region groups cover exactly weeks 1..52")


def test_week53_forecast_classifies():
    thresholds = classify.compute_thresholds(classify.load_history())
    synth = pd.DataFrame(
        {
            "disease": ["Dengue"],
            "region": [thresholds["region"].iloc[0]],
            # a date that lands in ISO week 53 of its year
            "date": pd.to_datetime(["2020-12-31"]),
            "yhat": [500.0],
        }
    )
    merged = classify.with_iso_week(synth).merge(
        thresholds, on=["disease", "region", "iso_week"], how="left"
    )
    assert merged[["p50", "p75"]].notna().all().all(), (
        "week-53 forecast row must find thresholds after folding"
    )
    tier = classify.label(merged["yhat"], merged["p50"], merged["p75"])[0]
    assert tier in ("Low", "Moderate", "High")
    print(f"PASS  synthetic week-53 forecast classifies (tier={tier})")


def test_processed_thresholds_in_sync():
    path = ingest.PROCESSED_DIR / "risk_thresholds.csv"
    df = pd.read_csv(path)
    assert (df["iso_week"] <= 52).all() and (df["iso_week"] >= 1).all(), (
        f"{path.name} contains out-of-range weeks"
    )
    counts = df.groupby(["disease", "region"]).size().unique()
    assert list(counts) == [52], f"expected exactly 52 weeks per group, got {counts}"
    print(f"PASS  committed risk_thresholds.csv has 52 weeks x {len(df) // 52} groups")


if __name__ == "__main__":
    test_week53_folds_into_week1()
    test_thresholds_cover_all_52_weeks()
    test_week53_forecast_classifies()
    test_processed_thresholds_in_sync()
    print("\nAll calendar-edge checks passed.")
