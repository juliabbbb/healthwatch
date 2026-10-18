"""Regional climate-type sensitivity run (PAGASA Modified Corona, Type II).

Re-runs the seasonal classification and the outbreak indicator under a
per-region season override for Type II regions (Bicol Region, Eastern Visayas,
Caraga), whose maximum rainfall falls Dec-Feb instead of the national Jun-Nov
wet window used by the production pipeline.

The month-anchored percentile tiers and Rule A are label-independent: they only
consume per-(region, month) empirical P50/P75 and run lengths, so they cannot
move under the override. Only the seasonal probe labels and Rule B's seasonal
P75 bucket change. This module quantifies exactly which region-season outbreak
flags flip and how the 2025 out-of-sample confusion matrix shifts when the local
calendar is enforced, so the manuscript can disclose the metric deltas (or the
absence of them) rather than hand-wave the limitation.

Run: python -m src.sensitivity
"""

import pandas as pd

from . import ingest, outbreak
from .classify import (
    classify_seasonal,
    compute_seasonal_thresholds,
    compute_thresholds,
    load_history,
    season_of,
    with_month_of_year,
)

PROBE_WINDOWS = {
    "dry": (pd.Timestamp("2025-01-01"), pd.Timestamp("2025-03-31")),
    "wet": (pd.Timestamp("2025-07-01"), pd.Timestamp("2025-09-30")),
}


def region_season(date, region):
    """Region-aware season (Type II override via classify.SEASON_RULES)."""
    return season_of(date, region)


def _national_season(date):
    return season_of(date, None)


def run_override(season_func):
    history = load_history()
    thresholds = compute_thresholds(history)  # month-anchored, never moves
    seasonal = compute_seasonal_thresholds(history, season_func=season_func)
    probes = pd.read_csv(ingest.PROCESSED_DIR / "season_probes.csv")
    seasonal_cls = classify_seasonal(thresholds, probes=probes, season_func=season_func)
    indicators = outbreak.detect_outbreaks(
        classification=seasonal_cls, seasonal=seasonal
    )
    return indicators


def _diff_flags(national, override):
    n = national.rename(columns={"outbreak": "flag_national", "trigger": "trigger_national"}).drop(
        columns=["consecutive_high_n", "season_avg", "season_p75", "n_forecast_months"],
        errors="ignore",
    )
    o = override.rename(columns={"outbreak": "flag_override", "trigger": "trigger_override"}).drop(
        columns=["consecutive_high_n", "season_avg", "season_p75", "n_forecast_months"],
        errors="ignore",
    )
    merged = n.merge(o, on=["disease", "region", "season"], how="outer").fillna(False)
    merged["flip"] = merged["flag_national"] != merged["flag_override"]
    return merged


def _validate_2025_under(indicators, season_func):
    """Replicates validate_2025 semantics but with a regional season function,
    so the 'actual' flags use the same monthly P75s with the region-aware
    seasonal P75 bucket on the observed 2025 months."""
    observed = pd.concat(
        [
            pd.read_csv(ingest.PROCESSED_DIR / "national_monthly.csv", parse_dates=["date"]),
            pd.read_csv(ingest.PROCESSED_DIR / "regional_dengue_monthly.csv", parse_dates=["date"]),
        ],
        ignore_index=True,
    )
    monthly = pd.read_csv(ingest.PROCESSED_DIR / "risk_thresholds.csv")
    seasonal = compute_seasonal_thresholds(
        observed[observed["date"] <= pd.Timestamp("2024-12-31")],
        season_func=season_func,
    )

    rows = []
    for region in indicators["region"].unique():
        for season, (start, end) in PROBE_WINDOWS.items():
            seg = observed[
                (observed["region"] == region)
                & (observed["date"] >= start)
                & (observed["date"] <= end)
            ].sort_values("date")
            if seg.empty:
                continue
            disease = seg["disease"].iloc[0]
            avg_actual = float(seg["cases"].mean())
            thr = monthly[(monthly["disease"] == disease) & (monthly["region"] == region)]
            seg = with_month_of_year(seg).merge(
                thr[["month", "p75", "p50"]], on="month", how="left"
            )
            p75s = seg["p75"].fillna(0).tolist()
            classes = ["High" if c > p75 else "not" for c, p75 in zip(seg["cases"].tolist(), p75s)]
            high_run = outbreak._longest_high_run(classes)
            rule_a = high_run >= outbreak.CONSECUTIVE_HIGH_N
            srow = seasonal[
                (seasonal["disease"] == disease)
                & (seasonal["region"] == region)
                & (seasonal["season"] == season)
            ]
            season_p75 = float(srow["p75"].iloc[0]) if not srow.empty else float("nan")
            rule_b = avg_actual > season_p75 if pd.notna(season_p75) else False
            ind = indicators[
                (indicators["region"] == region) & (indicators["season"] == season)
            ]
            predicted = bool(ind["outbreak"].iloc[0]) if not ind.empty else False
            rows.append({
                "region": region, "season": season,
                "predicted": predicted, "actual": bool(rule_a or rule_b),
                "rule_a_actual": rule_a, "rule_b_actual": rule_b,
                "avg_actual": round(avg_actual, 1), "season_p75": round(season_p75, 1),
            })
    return pd.DataFrame(rows)


def _confusion(df):
    df = df.copy()
    df["tp"] = df["predicted"] & df["actual"]
    df["fp"] = df["predicted"] & ~df["actual"]
    df["fn"] = ~df["predicted"] & df["actual"]
    df["tn"] = ~df["predicted"] & ~df["actual"]
    tp, fp, fn, tn = (int(df[c].sum()) for c in ("tp", "fp", "fn", "tn"))
    precision = tp / (tp + fp) if tp + fp else float("nan")
    recall = tp / (tp + fn) if tp + fn else float("nan")
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else float("nan")
    return {
        "n": int(len(df)), "TP": tp, "FP": fp, "FN": fn, "TN": tn,
        "precision": round(precision, 3), "recall": round(recall, 3), "F1": round(f1, 3),
    }


def run():
    national = run_override(lambda d, r: _national_season(d))
    override = run_override(region_season)

    diff = _diff_flags(national, override)
    path = ingest.save_processed(diff, "sensitivity_type2_flags.csv")
    print(f"Saved -> {path}")
    print("\nFlags that FLIP under the Type II override:")
    flipped = diff[diff["flip"]]
    if flipped.empty:
        print("  (none)")
    else:
        print(
            flipped[
                ["region", "season", "flag_national", "flag_override",
                 "trigger_national", "trigger_override"]
            ].to_string(index=False)
        )

    val_n = _validate_2025_under(national, lambda d, r: _national_season(d))
    val_o = _validate_2025_under(override, region_season)
    cn = _confusion(val_n)
    co = _confusion(val_o)
    print("\n2025 out-of-sample confusion (national calendar run):")
    print(" ", cn)
    print("2025 out-of-sample confusion (Type II local-calendar run):")
    print(" ", co)

    type2 = ["Bicol Region", "Eastern Visayas", "Caraga"]
    for r in type2:
        print(f"\nType II region: {r}")
        sub = diff[diff["region"] == r]
        if not sub.empty:
            print(
                sub[["region", "season", "flag_national", "trigger_national",
                     "flag_override", "trigger_override", "flip"]].to_string(index=False)
            )
        else:
            print("  no rows")

    return diff, cn, co


if __name__ == "__main__":
    run()