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
    history = history[history.disease == "Dengue"].copy()
    thresholds = compute_thresholds(history)  # dengue-only, frozen pre-2025 pool
    seasonal = compute_seasonal_thresholds(history, season_func=season_func)
    probes = pd.read_csv(ingest.PROCESSED_DIR / "season_probes.csv")
    probes = probes[probes.disease == "Dengue"].copy()
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
    from .integrity import seasonal_rules
    history=load_history();history=history[history.disease=="Dengue"]
    monthly=compute_thresholds(history)
    seasonal=compute_seasonal_thresholds(history,season_func=season_func)
    observed=ingest.load_monthly_series();observed=observed[observed.disease=="Dengue"]
    rows=[]
    for ind in indicators[indicators.disease=="Dengue"].itertuples():
        if not ind.eligible:continue
        dates=pd.date_range(ind.target_start,ind.target_end,freq="MS")
        seg=observed[(observed.region==ind.region)&observed.date.isin(dates)].sort_values("date")
        thr=monthly[monthly.region==ind.region]
        seg=with_month_of_year(seg).merge(thr[["month","p50","p75"]],on="month",validate="many_to_one")
        pool=seasonal[(seasonal.region==ind.region)&(seasonal.season==ind.season)]
        s75=float(pool.p75.iloc[0]) if len(pool)==1 else float("nan")
        actual=seasonal_rules(seg.date,seg.cases,seg.p50,seg.p75,s75)
        if not actual["eligible"]:continue
        rows.append(dict(region=ind.region,disease="Dengue",season=ind.season,predicted=bool(ind.outbreak),actual=actual["combined_flag"],rule_a_actual=actual["rule_a"],rule_b_actual=actual["rule_b"],avg_actual=seg.cases.mean(),season_p75=s75))
    return pd.DataFrame(rows,columns=["region","disease","season","predicted","actual","rule_a_actual","rule_b_actual","avg_actual","season_p75"])


def _confusion(df):
    from .integrity import binary_metrics
    p,a=df.predicted.astype(bool),df.actual.astype(bool)
    result=binary_metrics(int((p&a).sum()),int((p&~a).sum()),int((~p&a).sum()),int((~p&~a).sum()))
    return {"n":result["n"],"TP":result["tp"],"FP":result["fp"],"FN":result["fn"],"TN":result["tn"],"precision":result["precision"],"recall":result["recall"],"F1":result["f1"]}


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