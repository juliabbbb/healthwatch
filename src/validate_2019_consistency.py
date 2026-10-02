"""2019 consistency check: does the production monthly rule flag the known epidemic?

Run:  .venv\\Scripts\\python -m src.validate_2019_consistency

DOH declared a national dengue epidemic on 6 August 2019. The 2019 line-list
carries no pre-2019 months, so it cannot build a baseline that precedes the
event. This check therefore feeds the live monthly methodology: national
month-of-year P50/P75 pooled from the line-list over 2019..2024, then the 2019
national monthly series is labelled against them. Expected result: the Jul-Oct
2019 epidemic peak classifies High.

WHAT THIS IS, AND WHAT IT IS NOT
--------------------------------
This is a CONSISTENCY check, not an independent validation, and the name says
so. The threshold pool (2019..2024) CONTAINS the twelve months being labelled,
so the epidemic months contribute to the cut-offs they are then compared
against -- roughly one sixth of each calendar month's samples. A method that
merely echoed the data would also flag the peak.

It is still worth running, because it exercises the deployed code path
(`classify.compute_thresholds` + `classify.label`) on real line-list rows and
shows the rule responds to a genuine epidemic rather than to a fixture. For a
check whose holdout is genuinely outside its training pool see
`src.validate_2025`, which trains through 2024-12 and holds out 2025.

Renamed from `validate_known_epidemic` / `known_epidemic_check.csv`: "known
epidemic validation" invited the reading that the 2019 result was independent,
which it is not.
"""

import pandas as pd

from . import ingest
from .classify import compute_thresholds, label

EPIDEMIC_YEAR = 2019
P75_END = pd.Timestamp("2024-12-31")
PEAK_MONTHS = ("2019-07", "2019-10")


def check_linelist_2019() -> pd.DataFrame:
    """Run the production monthly rule on real 2019 line-list rows.

    Month-of-year P50/P75 pooled over the line-list era (2019..2024, the
    pre-2025 validation pool), then label the 2019 national monthly counts.
    """
    national = pd.read_csv(
        ingest.PROCESSED_DIR / "national_monthly.csv", parse_dates=["date"]
    )
    # This check is specific to the 2019 national *dengue* epidemic; the other
    # disease groups have no independent 2019 outbreak to validate against.
    national = national[national["disease"] == "Dengue"].copy()
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
    out = y2019[["date", "cases", "p50", "p75", "risk_level"]].sort_values("date")
    out = out.assign(date=out["date"].dt.date.astype(str), source="line-list-2019")
    return out


def run():
    ll19 = check_linelist_2019()

    ingest.save_processed(
        ll19[["source", "date", "cases", "p50", "p75", "risk_level"]],
        "consistency_check_2019.csv",
    )

    print("Line-list 2019 monthly check - national 2019 by month, P50/P75 pooled "
          "from line-list 2019-2024 (pre-2025 pool)")
    print("(DOH declared a national dengue epidemic on 6 August 2019)")
    print("Consistency check only: the pool contains the months being labelled, "
          "so this is not an independent validation.\n")
    print(ll19.to_string(index=False))
    high_ll = int((ll19["risk_level"] == "High").sum())
    print(f"\n{high_ll} of {len(ll19)} line-list months classified High.")
    ym = ll19["date"].str[:7]
    peak = ll19[(ym >= PEAK_MONTHS[0]) & (ym <= PEAK_MONTHS[1])]
    print("Jul-Oct 2019 (epidemic peak): "
          f"{int((peak['risk_level'] == 'High').sum())} of {len(peak)} months High.")
    return ll19


if __name__ == "__main__":
    run()
