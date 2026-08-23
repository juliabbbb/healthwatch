"""Validate the classification method against a known real-world epidemic.

Run:  .venv\\Scripts\\python -m src.validate_known_epidemic

DOH declared a national dengue epidemic on 6 August 2019. This script runs
HEALTHWATCH's own percentile-threshold logic (pre-2020 history only) against
the national weekly series around that declaration and reports the tiers.
Expected result: every week in the window classifies as High.
"""

import pandas as pd

from . import classify, ingest

EPIDEMIC_YEAR = 2019
WEEK_START = 29  # week ending 2019-07-21, two before the 6 Aug declaration
WEEK_END = 35  # week ending 2019-09-01


def run() -> pd.DataFrame:
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_weekly.csv", parse_dates=["date"]
    )
    thresholds = classify.compute_thresholds(classify.load_history())

    window = national[national["date"].dt.year == EPIDEMIC_YEAR].copy()
    iso = window["date"].dt.isocalendar()
    window["iso_week"] = iso.week.astype(int)
    window = window[(window["iso_week"] >= WEEK_START) & (window["iso_week"] <= WEEK_END)]

    merged = window.merge(
        thresholds, on=["disease", "region", "iso_week"], how="left", validate="1:1"
    )
    if merged[["p50", "p75"]].isna().any().any():
        raise ValueError("Missing thresholds inside the epidemic window")

    merged["risk_level"] = classify.label(merged["cases"], merged["p50"], merged["p75"])
    out = merged[["date", "cases", "p50", "p75", "risk_level"]].sort_values("date")
    out = out.assign(date=out["date"].dt.date.astype(str))

    ingest.save_processed(out, "known_epidemic_check.csv")
    print(f"National dengue, {EPIDEMIC_YEAR} epi weeks {WEEK_START}-{WEEK_END}")
    print("(DOH declared a national dengue epidemic on 6 August 2019)\n")
    print(out.to_string(index=False))
    high = int((out["risk_level"] == "High").sum())
    print(f"\n{high} of {len(out)} weeks classified High.")
    return out


if __name__ == "__main__":
    run()
