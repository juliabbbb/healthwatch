"""Validate the classification method against a known real-world epidemic.

Run:  .venv\\Scripts\\python -m src.validate_known_epidemic

DOH declared a national dengue epidemic on 6 August 2019. Two checks:

1. HDX weekly check (independent fixture). Runs HEALTHWATCH's own
   percentile-threshold logic (pre-2020 history only) against the national
   weekly series around that declaration and reports the tiers. It reads its
   OWN fixed historical fixture — the old HDX export
   DOH-Epi-Dengue-2016-2021.csv — and is deliberately decoupled from the live
   monthly pipeline. Expected result: every week in the window classifies as
   High.

2. Line-list 2019 cross-check. The 2019 line-list data cannot build a weekly
   baseline (it has no pre-2019 weeks), so instead it feeds the live monthly
   methodology: national monthly percentiles (P75, month-of-year) pooled from
   the line-list over 2019..2024, then the 2019 monthly series is labelled
   against them. Expected result: the 2019 Aug-Sep epidemic peak classifies as
   High — the same signal, detected by the production monthly rule on real
   2019 line-list rows.
"""

import pandas as pd

from . import ingest
from .classify import compute_thresholds, compute_weekly_thresholds, label

EPIDEMIC_YEAR = 2019
WEEK_START = 29  # week ending 2019-07-21, two before the 6 Aug declaration
WEEK_END = 35  # week ending 2019-09-01

HDX_FILE = "DOH-Epi-Dengue-2016-2021.csv"
P75_END = pd.Timestamp("2024-12-31")


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


def check_hdx_weekly() -> pd.DataFrame:
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
    out = out.assign(date=out["date"].dt.date.astype(str), source="HDX-2016-2021")
    return out


def check_linelist_2019() -> pd.DataFrame:
    """Run the production monthly rule on real 2019 line-list rows.

    Month-of-year P50/P75 pooled over the line-list era (2019..2024, the
    pre-2025 validation pool), then label the 2019 national monthly counts.
    """
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_monthly.csv", parse_dates=["date"]
    )
    pool = national[national["date"] <= P75_END].query("region == 'National'").copy()
    thresholds = compute_thresholds(pool)
    thr = thresholds[thresholds["region"] == "National"].copy()

    y2019 = national[national["date"].dt.year == EPIDEMIC_YEAR].query(
        "region == 'National'"
    ).copy()
    m = y2019["date"].dt.month
    y2019["p50"] = thr.set_index("month")["p50"].loc[m.values].values
    y2019["p75"] = thr.set_index("month")["p75"].loc[m.values].values
    y2019["risk_level"] = label(y2019["cases"], y2019["p50"], y2019["p75"])
    out = y2019[
        ["date", "cases", "p50", "p75", "risk_level"]
    ].sort_values("date")
    out = out.assign(date=out["date"].dt.date.astype(str), source="line-list-2019")
    return out


def run():
    hdx = check_hdx_weekly()
    ll19 = check_linelist_2019()

    out = pd.concat([hdx, ll19], ignore_index=True)
    ingest.save_processed(
        out[["source", "date", "cases", "p50", "p75", "risk_level"]],
        "known_epidemic_check.csv",
    )

    print(f"1) HDX weekly check — national dengue, {EPIDEMIC_YEAR} epi weeks "
          f"{WEEK_START}-{WEEK_END}")
    print("   (DOH declared a national dengue epidemic on 6 August 2019)\n")
    print(hdx.to_string(index=False))
    high_hdx = int((hdx["risk_level"] == "High").sum())
    print(f"\n{high_hdx} of {len(hdx)} HDX weeks classified High.\n")

    print("2) Line-list 2019 monthly check — national 2019 by month, P75 pooled "
          "from line-list 2019-2024 (pre-2025 pool)\n")
    print(ll19.to_string(index=False))
    high_ll = int((ll19["risk_level"] == "High").sum())
    print(f"\n{high_ll} of {len(ll19)} line-list months classified High.")
    peak = ll19[(ll19["date"] >= "2019-07") & (ll19["date"] <= "2019-10")]
    print("Jul-Oct 2019 (epidemic peak): "
          f"{int((peak['risk_level'] == 'High').sum())} of {len(peak)} months High.")
    return out


if __name__ == "__main__":
    run()