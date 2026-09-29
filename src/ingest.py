from pathlib import Path

import pandas as pd

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")


def to_monthly(df, fill_missing="zero"):
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
        .sum()
        .sort_values(["disease", "region", "date"], ignore_index=True)
    )
    if fill_missing == "zero":
        idx = pd.date_range(monthly["date"].min(), monthly["date"].max(), freq="MS")
        parts = []
        for (disease, region), group in monthly.groupby(["disease", "region"]):
            g = (
                group.set_index("date")
                .reindex(idx, fill_value=0)
                .rename_axis("date")
                .reset_index()
            )
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


def load_latest_processed():
    files = sorted(PROCESSED_DIR.glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No processed CSVs in {PROCESSED_DIR}; run ingest first.")
    return pd.read_csv(files[-1], parse_dates=["date"])
