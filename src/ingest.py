from pathlib import Path

import pandas as pd

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")

COLUMN_ALIASES = {
    "date": ("date", "week", "report_date", "admission_date", "morbid_week"),
    "region": ("region", "region_res", "regions", "psgc_region", "admin_region"),
    "disease": ("disease", "illness", "case_type", "notifiable_disease", "diagnosis"),
    "cases": ("cases", "case_count", "number_of_cases", "count", "total_cases", "value"),
}


def _match_columns(df):
    rename = {}
    for col in df.columns:
        key = str(col).strip().lower()
        for canonical, aliases in COLUMN_ALIASES.items():
            if key in aliases:
                rename[col] = canonical
                break
    return df.rename(columns=rename)


def load_raw(path):
    path = Path(path)
    if path.suffix.lower() in {".xlsx", ".xls"}:
        df = pd.read_excel(path)
    else:
        df = pd.read_csv(path)
    return _match_columns(df)


def clean(df, disease=None):
    """Normalise an imported table: coerce types, group to one row per
    (date, region, disease), summing cases and (if present) deaths."""
    missing = [c for c in ("date", "region", "cases") if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required columns after alias matching: {missing}. "
            f"Found columns: {list(df.columns)}"
        )
    out = df.copy()
    if "disease" not in out.columns:
        if disease is None:
            raise ValueError("No 'disease' column found; pass disease='Dengue' for single-disease files.")
        out["disease"] = disease
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out["cases"] = pd.to_numeric(out["cases"], errors="coerce")
    out["region"] = out["region"].astype(str).str.strip()
    out["disease"] = out["disease"].astype(str).str.strip()
    sum_cols = ["cases"]
    if "deaths" in out.columns:
        out["deaths"] = pd.to_numeric(out["deaths"], errors="coerce")
        sum_cols.append("deaths")
    out = out.dropna(subset=["date", "cases"])
    out = (
        out.groupby(["date", "region", "disease"], as_index=False)[sum_cols]
        .sum()
        .sort_values(["disease", "region", "date"], ignore_index=True)
    )
    return out


def to_weekly(df, fill_missing="zero"):
    weekly = (
        df.set_index("date")
        .groupby(["disease", "region"])["cases"]
        .resample("W-SUN")
        .sum()
        .reset_index()
    )
    if fill_missing == "zero":
        idx = pd.date_range(weekly["date"].min(), weekly["date"].max(), freq="W-SUN")
        parts = []
        for (disease, region), group in weekly.groupby(["disease", "region"]):
            g = (
                group.set_index("date")
                .reindex(idx, fill_value=0)
                .rename_axis("date")
                .reset_index()
            )
            g["disease"] = disease
            g["region"] = region
            parts.append(g)
        weekly = pd.concat(parts, ignore_index=True)[["date", "region", "disease", "cases"]]
    elif fill_missing != "drop":
        raise ValueError(f"fill_missing must be 'zero' or 'drop', got '{fill_missing}'")
    return weekly


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
