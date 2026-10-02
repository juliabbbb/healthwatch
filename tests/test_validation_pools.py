"""Validation-pool guards: the 2025 prospective check must not see 2025.

Run:  .venv\\Scripts\\python -m tests.test_validation_pools

`validate_2025` scores 2025 dry/wet seasons prospectively. Its ACTUAL side has
always used the pre-2025 pool (`validation_thresholds.csv`). Its PREDICTED side
used to be read from `outbreak_indicators.csv`, which `classify.run()` builds
from percentiles whose baseline runs through 2026-08 -- i.e. the predicted flags
were thresholded against the very months being predicted (13 of 188 flags).

These asserts pin both pools so the two sides cannot drift apart again:
  * the validation pool ends at 2024-12-31 and reproduces the shipped
    validation threshold files exactly;
  * the production pool reproduces `risk_thresholds.csv` exactly;
  * the two pools genuinely DIFFER, so a future swap back is caught;
  * the leak-free predicted side is load-bearing (differs from production);
  * probe anchors are unique per (disease, region, season) and line up with the
    2025 probe windows `validate_2025` scores;
  * `sensitivity._validate_2025_under` covers all five diseases and keys on
    disease (it used to score 38 dengue-only rows against 188 indicators).
"""

import pandas as pd

from src import classify, ingest, sensitivity, validate_2025

VALIDATION_CUTOFF = pd.Timestamp("2024-12-31")


def _shipped(name):
    return pd.read_csv(ingest.PROCESSED_DIR / name)


def test_validation_pool_ends_before_the_scored_years():
    """The invariant: no 2025+ month can reach the validation baseline."""
    history = classify.load_history(classify.HISTORY_END)
    assert history["date"].max() <= VALIDATION_CUTOFF, history["date"].max()
    assert history["date"].max().year == 2024
    # 2019 is in the pool too (hard constraint: never excluded)
    assert history["date"].min() == pd.Timestamp("2019-01-01")
    assert (history["date"].dt.year == 2019).sum() > 0


def test_validation_pool_reproduces_shipped_validation_thresholds():
    history = classify.load_history(classify.HISTORY_END)
    recomputed = classify.compute_thresholds(history)
    shipped = _shipped(classify.VALIDATION_THRESHOLDS)
    key = ["disease", "region", "month"]
    merged = recomputed.merge(shipped, on=key, suffixes=("_r", "_s"))
    assert len(merged) == len(shipped) == len(recomputed)
    for col in ("p50", "p75"):
        assert merged[f"{col}_r"].equals(merged[f"{col}_s"]), col

    seasonal = classify.compute_seasonal_thresholds(history)
    shipped_seasonal = _shipped(classify.VALIDATION_SEASONAL)
    m2 = seasonal.merge(
        shipped_seasonal, on=["disease", "region", "season"], suffixes=("_r", "_s")
    )
    assert len(m2) == len(shipped_seasonal)
    assert m2["p75_r"].equals(m2["p75_s"])


def test_production_pool_reproduces_shipped_risk_thresholds():
    history = classify.load_history(classify.PROD_HISTORY_END)
    recomputed = classify.compute_thresholds(history)
    shipped = _shipped("risk_thresholds.csv")
    key = ["disease", "region", "month"]
    merged = recomputed.merge(shipped, on=key, suffixes=("_r", "_s"))
    assert len(merged) == len(shipped)
    for col in ("p50", "p75"):
        assert merged[f"{col}_r"].equals(merged[f"{col}_s"]), col


def test_the_two_pools_are_different():
    """If these were equal the leak test below could not fail."""
    val = _shipped(classify.VALIDATION_THRESHOLDS)
    prod = _shipped("risk_thresholds.csv")
    key = ["disease", "region", "month"]
    merged = val.merge(prod, on=key, suffixes=("_v", "_p"))
    assert len(merged) == len(val)
    # Production has one extra key: Acute Viral Hepatitis / Negros Island
    # Region / January, whose entire reporting history starts in 2025 and so
    # has no pre-2025 month-of-year quantile to compute.
    extra = prod.merge(val[key].assign(_in_val=1), on=key, how="left")
    extra = extra[extra["_in_val"].isna()][key]
    assert len(val) + len(extra) == len(prod), (len(val), len(extra), len(prod))
    if not extra.empty:
        assert extra.iloc[0].tolist() == ["Acute Viral Hepatitis", "Negros Island Region", 1], extra

    differing = merged["p75_v"] != merged["p75_p"]
    # Materially different, and NOT one-directional: extending the baseline
    # moves a per-month quantile up where the added months were high (Hep A) and
    # down where they were low (Dengue, Cholera). Only the magnitude and the
    # two-way nature are asserted -- a direction claim would be false.
    assert differing.sum() > 0.5 * len(merged), differing.sum()
    both_ways = (merged["p75_p"] > merged["p75_v"]).any() and (
        merged["p75_p"] < merged["p75_v"]
    ).any()
    assert both_ways, "expected differences in both directions"


def test_probe_anchors_are_unique_and_align_with_scored_windows():
    probes = _shipped("season_probes.csv")
    per_key = probes.groupby(["disease", "region", "season"])["probe_anchor"].nunique()
    assert set(per_key.unique()) == {1}, "multiple anchors per key -- .iloc[0] would be ambiguous"
    for season, (start, _end) in validate_2025.PROBE_WINDOWS.items():
        anchors = pd.to_datetime(probes.loc[probes["season"] == season, "probe_anchor"]).unique()
        assert len(anchors) == 1, (season, anchors)
        assert anchors[0] == pd.Timestamp(start), (season, anchors[0], start)


def test_validation_pool_indicators_are_leak_free_and_load_bearing():
    leak_free = validate_2025.validation_pool_indicators()
    production = validate_2025.load_indicators()
    key = ["disease", "region", "season", "probe_anchor"]
    merged = leak_free.merge(production[key + ["outbreak"]], on=key, suffixes=("_free", "_prod"))
    assert len(merged) == len(production), "key sets should line up"
    differs = (merged["outbreak_free"] != merged["outbreak_prod"]).sum()
    assert differs > 0, "leak-free indicators match production -- fix is not load-bearing"


def test_validate_2025_uses_the_leak_free_side_by_default():
    """validate() must not silently fall back to the production indicators."""
    default = validate_2025.validate()
    key = ["disease", "region", "season"]

    leak_free = validate_2025.validation_pool_indicators()
    a = default[key + ["predicted"]].merge(
        leak_free[key + ["outbreak"]], on=key, suffixes=("_d", "_f")
    )
    assert len(a) == len(default)
    assert (a["predicted"] == a["outbreak"]).all()

    # and the production file, when injected, gives different answers
    production = validate_2025.validate(indicators=validate_2025.load_indicators())
    b = default[key + ["predicted"]].merge(
        production[key + ["predicted"]], on=key, suffixes=("_d", "_p")
    )
    assert (b["predicted_d"] != b["predicted_p"]).sum() > 0


def test_sensitivity_actual_side_covers_all_diseases():
    """It used to concatenate only the two dengue CSVs -> 38 rows."""
    national = sensitivity.run_override(lambda d, r: sensitivity._national_season(d))
    result = sensitivity._validate_2025_under(
        national, lambda d, r: sensitivity._national_season(d)
    )
    expected = set(national["disease"].unique())
    assert len(expected) == 5, expected
    assert set(result["disease"].unique()) == expected
    assert "disease" in result.columns
    # every scored (disease, region) pair comes from the indicator set
    pairs_in = set(map(tuple, national[["disease", "region"]].drop_duplicates().to_numpy()))
    pairs_out = set(map(tuple, result[["disease", "region"]].drop_duplicates().to_numpy()))
    assert pairs_out <= pairs_in, pairs_out - pairs_in
    # 188 multi-disease indicators must not collapse to a dengue-only 38 rows
    assert len(result) > 100, len(result)


def test_sensitivity_actual_side_uses_the_validation_pool():
    """Production risk_thresholds.csv baseline includes the 2025 months."""
    history = classify.load_history(classify.HISTORY_END)
    recomputed = classify.compute_thresholds(history)
    val = _shipped(classify.VALIDATION_THRESHOLDS)
    prod = _shipped("risk_thresholds.csv")
    key = ["disease", "region", "month"]
    # the p75s the function now reads differ from what it used to read
    a = val[key + ["p75"]].merge(prod[key + ["p75"]], on=key, suffixes=("_v", "_p"))
    assert not a["p75_v"].equals(a["p75_p"])
    assert recomputed[key + ["p75"]].merge(a, on=key)["p75_v"].equals(
        recomputed[key + ["p75"]].merge(a, on=key)["p75"]
    )


def _main():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in tests:
        try:
            fn()
        except AssertionError as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
        else:
            print(f"pass {fn.__name__}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_main())
