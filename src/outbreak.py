"""Seasonal outbreak indicator.

Deterministically flags a region-season as being at seasonal outbreak risk using
data already produced by the pipeline (O2 forecasts + percentile tiers) — no new
ML. Two complementary rules, per (disease, region, season):

  Rule A — consecutive High: the season's 3-month probe forecast contains a run
      of >= N consecutive months whose risk tier is 'High' (>monthly P75).
      Sustained elevation, not a single anomalous month.

  Rule B — season P75 uplift: the average expected monthly load over the
      season's probe months exceeds the region's historical P75 for that season
      (from seasonal_thresholds.csv). Captures elevated *seasonal* load even
      when individual months sit near the boundary.

If either rule fires, the region is flagged for that season. Both rules reuse
pre-2025 history via the existing thresholds, keeping the method deterministic
and explainable (Objective 5).

Run: python -m src.outbreak
"""

import pandas as pd

from . import ingest

CONSECUTIVE_HIGH_N = 3


def load_seasonal_classification():
    df = pd.read_csv(
        ingest.PROCESSED_DIR / "seasonal_classification.csv", parse_dates=["date"]
    )
    return df.sort_values(["region", "season", "date"], ignore_index=True)


def load_seasonal_thresholds():
    return pd.read_csv(ingest.PROCESSED_DIR / "seasonal_thresholds.csv")


def _longest_high_run(classes):
    """Length of the longest consecutive run of 'High' in an ordered list."""
    best = run = 0
    for c in classes:
        if c == "High":
            run += 1
            best = max(best, run)
        else:
            run = 0
    return best


def detect_outbreaks(classification=None, seasonal=None, consecutive_n=None):
    from .integrity import seasonal_rules
    classification = load_seasonal_classification() if classification is None else classification
    seasonal = load_seasonal_thresholds() if seasonal is None else seasonal
    records = []
    for (disease, region, season), grp in classification.groupby(["disease","region","season"]):
        grp = grp.sort_values("date")
        pool = seasonal[(seasonal.disease==disease)&(seasonal.region==region)&(seasonal.season==season)]
        if len(pool)>1:
            raise ValueError("Duplicate seasonal threshold key")
        p75 = float(pool.p75.iloc[0]) if len(pool) else float("nan")
        result = seasonal_rules(grp.date,grp.yhat,grp.p50,grp.p75,p75)
        a,b = result["rule_a"],result["rule_b"]
        records.append(dict(disease=disease,region=region,season=season,
            outbreak=result["combined_flag"],eligible=result["eligible"],exclusion_reason=result["reason"],
            rule_a=a,rule_b=b,trigger="unavailable" if not result["eligible"] else "both" if a and b else "consecutive_high" if a else "season_p75" if b else "none",
            consecutive_high_n=_longest_high_run(grp.risk_level.tolist()),season_avg=float(grp.yhat.mean()),
            season_p75=p75,n_forecast_months=len(grp),target_start=grp.date.min(),target_end=grp.date.max()))
    return pd.DataFrame(records)


def save_indicators(indicators):
    return ingest.save_processed(indicators, "outbreak_indicators.csv")


def run():
    indicators = detect_outbreaks()
    path = save_indicators(indicators)
    print(f"Saved {len(indicators)} region-season indicators -> {path}")

    flagged = indicators[indicators["outbreak"].eq(True)]
    print(f"\nFlagged outbreak regions/seasons: {len(flagged)} / {len(indicators)}")
    if not flagged.empty:
        print(
            flagged[
                ["region", "season", "trigger", "consecutive_high_n",
                 "season_avg", "season_p75"]
            ].to_string(index=False)
        )

    ok = indicators[indicators["outbreak"].eq(False)]
    if not ok.empty:
        print("\nNot flagged:")
        print(
            ok[
                ["region", "season", "consecutive_high_n", "season_avg", "season_p75"]
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