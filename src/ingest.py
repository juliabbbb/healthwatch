from pathlib import Path
import os

import pandas as pd

from . import config

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path(os.environ.get("HEALTHWATCH_RAW_DIR", ROOT / "data/raw"))
PROCESSED_DIR = Path(os.environ.get("HEALTHWATCH_OUTPUT_DIR", ROOT / "data/processed"))


def to_monthly(df, fill_missing="preserve"):
    """Aggregate any cleaned series to calendar-month totals (month-start dates).

    Preserves deaths when present alongside cases."""
    out = df.copy()
    out["date"] = (
        pd.to_datetime(out["date"])
        .dt.to_period("M")
        .dt.to_timestamp()
    )
    sum_cols = ["cases"] + (["deaths"] if "deaths" in out.columns else [])
    monthly = (
        out.groupby(["date", "region", "disease"], as_index=False)[sum_cols]
        .sum(min_count=1)
        .sort_values(["disease", "region", "date"], ignore_index=True)
    )
    if fill_missing in {"zero", "preserve"}:
        idx = pd.date_range(monthly["date"].min(), monthly["date"].max(), freq="MS")
        parts = []
        for (disease, region), group in monthly.groupby(["disease", "region"]):
            g = (
                group.set_index("date")
                .reindex(idx)
                .rename_axis("date")
                .reset_index()
            )
            if fill_missing == "zero":
                g[sum_cols] = g[sum_cols].fillna(0)
            g["disease"] = disease
            g["region"] = region
            parts.append(g)
        monthly = pd.concat(parts, ignore_index=True)[
            ["date", "region", "disease"] + sum_cols
        ]
    elif fill_missing != "drop":
        raise ValueError(f"fill_missing must be 'zero' or 'drop', got '{fill_missing}'")
    return monthly


def save_processed(df, name):
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = PROCESSED_DIR / name
    df.to_csv(path, index=False)
    return path


# Monthly series CSVs across disease groups. Existence-guarded so a partial
# pipeline (e.g. a dengue-only reprocess) still runs.
MONTHLY_FILES = (
    "national_monthly.csv",
    "regional_dengue_monthly.csv",
    "national_fwbd_monthly.csv",
    "regional_fwbd_monthly.csv",
    "national_ili_monthly.csv",
    "regional_ili_monthly.csv",
    "national_leptospirosis_monthly.csv",
    "regional_leptospirosis_monthly.csv",
)


def load_monthly_series():
    """Concatenate every monthly series CSV (dengue + food/waterborne).

    Shared chokepoint: the raw FWD line-lists open in 2018 and the shared
    lower bound (2019-2026, src/config.py) is enforced and asserted here so
    every consumer (Prophet, thresholds, validation, API hot-load) inherits
    it even from stale on-disk CSVs.
    """
    frames = []
    for name in MONTHLY_FILES:
        path = PROCESSED_DIR / name
        if path.exists():
            if "leptospirosis" in name:
                from .source_decisions import require_lepto_audit
                require_lepto_audit(PROCESSED_DIR)
            frames.append(pd.read_csv(path, parse_dates=["date"]))
    if not frames:
        raise FileNotFoundError(
            f"No monthly series CSVs in {PROCESSED_DIR}; run the ingest first."
        )
    combined = pd.concat(frames, ignore_index=True)
    return config.assert_data_window(
        config.at_or_after_data_start(combined),
        date_col="date",
        context="load_monthly_series: ",
    )


def load_latest_processed():
    files = sorted(PROCESSED_DIR.glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No processed CSVs in {PROCESSED_DIR}; run ingest first.")
    return pd.read_csv(files[-1], parse_dates=["date"])
