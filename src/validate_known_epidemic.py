"""Validate the classification method against a known real-world epidemic.

Run:  .venv\\Scripts\\python -m src.validate_known_epidemic

DOH declared a national dengue epidemic on 6 August 2019. The 2019 line-list
data carries no pre-2019 weeks, so it cannot build a weekly baseline. Instead
this check feeds the live monthly methodology: national monthly percentiles
(P50/P75, month-of-year) pooled from the line-list over 2019..2024 (the
pre-2025 validation pool), then the 2019 national monthly series is labelled
against them. Expected result: the 2019 Jul-Oct epidemic peak classifies as
High — the same signal, detected by the production monthly rule on real 2019
line-list rows.
"""

import pandas as pd

from . import ingest
from .classify import compute_thresholds, label

EPIDEMIC_YEAR = 2019
P75_END = pd.Timestamp("2024-12-31")


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
    ll19 = check_linelist_2019()

    ingest.save_processed(
        ll19[["source", "date", "cases", "p50", "p75", "risk_level"]],
        "known_epidemic_check.csv",
    )

    print("Line-list 2019 monthly check — national 2019 by month, P50/P75 pooled "
          "from line-list 2019-2024 (pre-2025 pool)")
    print("(DOH declared a national dengue epidemic on 6 August 2019)\n")
    print(ll19.to_string(index=False))
    high_ll = int((ll19["risk_level"] == "High").sum())
    print(f"\n{high_ll} of {len(ll19)} line-list months classified High.")
    ym = ll19["date"].str[:7]
    peak = ll19[(ym >= "2019-07") & (ym <= "2019-10")]
    print("Jul-Oct 2019 (epidemic peak): "
          f"{int((peak['risk_level'] == 'High').sum())} of {len(peak)} months High.")
    return ll19


if __name__ == "__main__":
    run()