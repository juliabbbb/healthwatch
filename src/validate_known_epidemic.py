"""Validate the classification method against a known real-world epidemic.

Run:  .venv\\Scripts\\python -m src.validate_known_epidemic

DOH declared a national dengue epidemic on 6 August 2019. This script runs
HEALTHWATCH's own percentile-threshold logic (pre-2020 history only) against
the national weekly series around that declaration and reports the tiers.

It reads its OWN fixed historical fixture — the old HDX export
DOH-Epi-Dengue-2016-2021.csv — and is deliberately decoupled from the live
monthly pipeline (2022+), because the 2019 epidemic predates the pipeline's
real-data window. Expected result: every week in the window classifies as High.
"""

import pandas as pd

from . import ingest
from .classify import compute_weekly_thresholds, label

EPIDEMIC_YEAR = 2019
WEEK_START = 29  # week ending 2019-07-21, two before the 6 Aug declaration
WEEK_END = 35  # week ending 2019-09-01

HDX_FILE = "DOH-Epi-Dengue-2016-2021.csv"


def load_national_weekly():
    """Build the national weekly series from the HDX fixture (sum of all
    locations per ISO week; rows are subnational reporting units)."""
    raw = ingest.load_raw(ingest.RAW_DIR / HDX_FILE)
    df = ingest.clean(raw, disease="Dengue")
    weekly = ingest.to_weekly(df, fill_missing="zero")
    national = (
        weekly.groupby(["date", "disease"], as_index=False)["cases"]
        .sum()
        .assign(region="National")
    )
    return national.sort_values(["date"], ignore_index=True)


def run() -> pd.DataFrame:
    national = load_national_weekly()
    thresholds = compute_weekly_thresholds(national[national["date"].dt.year < 2020])

    window = national[national["date"].dt.year == EPIDEMIC_YEAR].copy()
    iso = window["date"].dt.isocalendar()
    window["iso_week"] = iso.week.astype(int)
    window = window[(window["iso_week"] >= WEEK_START) & (window["iso_week"] <= WEEK_END)]

    merged = window.merge(
        thresholds, on=["disease", "region", "iso_week"], how="left", validate="1:1"
    )
    if merged[["p50", "p75"]].isna().any().any():
        raise ValueError("Missing thresholds inside the epidemic window")

    merged["risk_level"] = label(merged["cases"], merged["p50"], merged["p75"])
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