"""Seasonal outbreak indicator.

Deterministically flags a region as being at seasonal outbreak risk using data
already produced by the pipeline (O2 forecast + O3 percentile tiers) — no new
ML. Two complementary rules, per (disease, region, season):

  Rule A — consecutive High: the 12-week forecast contains a run of >= N
      consecutive weeks whose risk tier is 'High' (>P75). Sustained elevation,
      not a single anomalous week.

  Rule B — season P75 uplift: the forecast weeks falling inside the season sum
      to more than the region's historical P75 for that season (from
      seasonal_thresholds.csv). Captures an elevated *seasonal* load even when
      individual weeks sit near the boundary.

If either rule fires, the region is flagged for that season. Both rules reuse
pre-COVID history via the existing thresholds, keeping the method deterministic
and explainable (Objective 5).

Run: python -m src.outbreak
"""

from pathlib import Path

import pandas as pd

from . import ingest
from .classify import season_of

CONSECUTIVE_HIGH_N = 3


def load_classification():
    df = pd.read_csv(
        ingest.PROCESSED_DIR / "risk_classification.csv", parse_dates=["date"]
    )
    return df.sort_values(["region", "date"], ignore_index=True)


def load_seasonal_thresholds():
    return pd.read_csv(ingest.PROCESSED_DIR / "seasonal_thresholds.csv")


def _longest_high_run(classes):
    """Length of the longest consecutive run of 'High' in a sorted list."""
    best = run = 0
    for c in classes:
        if c == "High":
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def detect_outbreaks(classification=None, seasonal=None, consecutive_n=None):
    if classification is None:
        classification = load_classification()
    if seasonal is None:
        seasonal = load_seasonal_thresholds()
    if consecutive_n is None:
        consecutive_n = CONSECUTIVE_HIGH_N

    classification = classification.copy()
    classification["season"] = classification["date"].map(season_of)

    records = []
    # Per disease + region + season
    key = ["disease", "region", "season"]
    for (disease, region, season), grp in classification.groupby(key):
        grp = grp.sort_values("date")
        high_run = _longest_high_run(grp["risk_level"].tolist())
        rule_a = high_run >= consecutive_n
        a_weeks = f"{grp['date'].min():%Y-%m-%d}..{grp['date'].max():%Y-%m-%d}" \
            if rule_a else ""

        thresh_row = seasonal[
            (seasonal["disease"] == disease)
            & (seasonal["region"] == region)
            & (seasonal["season"] == season)
        ]
        if thresh_row.empty:
            season_p75 = float("nan")
            season_sum = float("nan")
            rule_b = False
        else:
            season_p75 = float(thresh_row["p75"].iloc[0])
            season_sum = float(grp["yhat"].sum())
            rule_b = season_sum > season_p75

        if rule_a and rule_b:
            trigger = "both"
        elif rule_a:
            trigger = "consecutive_high"
        elif rule_b:
            trigger = "season_p75"
        else:
            trigger = "none"

        records.append(
            {
                "disease": disease,
                "region": region,
                "season": season,
                "outbreak": bool(rule_a or rule_b),
                "trigger": trigger,
                "consecutive_high_n": int(high_run),
                "rule_a_weeks": a_weeks,
                "season_sum": round(season_sum, 1),
                "season_p75": round(season_p75, 1),
                "n_forecast_weeks": int(len(grp)),
            }
        )

    return pd.DataFrame(records).sort_values(
        ["region", "season"], ignore_index=True
    )


def save_indicators(indicators):
    return ingest.save_processed(indicators, "outbreak_indicators.csv")


def run():
    indicators = detect_outbreaks()
    path = save_indicators(indicators)
    print(f"Saved {len(indicators)} region-season indicators -> {path}")

    flagged = indicators[indicators["outbreak"]]
    print(f"\nFlagged outbreak regions/seasons: {len(flagged)}")
    if not flagged.empty:
        print(
            flagged[
                ["region", "season", "trigger", "consecutive_high_n",
                 "season_sum", "season_p75"]
            ].to_string(index=False)
        )

    print("\nBy trigger:")
    print(
        indicators["trigger"]
        .replace({"none": "no flag", "consecutive_high": "Rule A",
                  "season_p75": "Rule B", "both": "Rule A + B"})
        .value_counts()
        .to_string()
    )
    return indicators


if __name__ == "__main__":
    run()
