"""Risk-tier escalation ranking (hotspot prioritization).

Deterministic ranking of regions by how many upward risk-tier transitions
their forecast makes across the full prediction horizon. Derived entirely from
`risk_classification.csv` (produced by src.classify) — no new ML, no refit.

Metric (committed in the thesis, Objective 4):
    tier_climbs  - number of upward tier transitions across the horizon
                   (Low -> Moderate and Moderate -> High each count +1).
                   Flat or declining regions score 0.

Complementary fields, reported for interpretation but never the rank key:
    net_climb        - final tier rank minus initial tier rank (+ or -);
                       total risk levels gained/lost over the horizon
    n_high_months    - months forecast at High risk
    first_high_month - first month at High risk ("" when never reached)
    final_tier       - risk tier of the last forecast month

Run: python -m src.rank_escalation
"""

import numpy as np
import pandas as pd

from . import ingest
from .classify import TIER_ORDER


def load_classification():
    df = pd.read_csv(
        ingest.PROCESSED_DIR / "risk_classification.csv", parse_dates=["date"]
    )
    return df.sort_values(["region", "date"], ignore_index=True)


def _escalation_for(group):
    """Per-(disease, region) escalation summary over an ordered horizon."""
    group = group.sort_values("date")
    ranks = group["risk_level"].map(TIER_ORDER).to_numpy(dtype=int)
    diffs = np.diff(ranks)
    high = ranks == TIER_ORDER["High"]
    high_idx = int(np.argmax(high)) if high.any() else None
    return {
        "tier_climbs": int((diffs > 0).sum()),
        "net_climb": int(ranks[-1] - ranks[0]),
        "n_high_months": int(high.sum()),
        "first_high_month": (
            group["date"].dt.strftime("%Y-%m").iloc[high_idx] if high_idx is not None else ""
        ),
        "final_tier": group["risk_level"].iloc[-1],
    }


def rank_escalation(classification=None):
    if classification is None:
        classification = load_classification()

    records = []
    for (disease, region), grp in classification.groupby(["disease", "region"]):
        records.append({"disease": disease, "region": region, **_escalation_for(grp)})
    out = pd.DataFrame(records).sort_values(
        ["tier_climbs", "n_high_months"], ascending=[False, False], ignore_index=True
    )
    out.insert(0, "rank", np.arange(1, len(out) + 1))
    return out


def run():
    classification = load_classification()
    ranking = rank_escalation(classification)
    path = ingest.save_processed(ranking, "risk_escalation_ranking.csv")

    horizon = classification.groupby("disease", sort=True)["date"].agg(
        start="min", end="max"
    )
    print(f"Saved {len(ranking)} region rankings -> {path}")
    for disease, row in horizon.iterrows():
        print(
            f"  Horizon ({disease}): {row['start'].date()} .. {row['end'].date()} "
            f"({len(classification[classification['disease'] == disease]) // len(ranking)} months/region)"
        )

    print(ranking.to_string(index=False))

    climbing = ranking[ranking["tier_climbs"] > 0]
    high = ranking[ranking["n_high_months"] > 0]
    print(
        f"\n{len(climbing)} regions climb >=1 tier; "
        f"{len(ranking) - len(climbing)} stay flat or decline. "
        f"{len(high)} regions reach High at least once."
    )
    return ranking


if __name__ == "__main__":
    run()