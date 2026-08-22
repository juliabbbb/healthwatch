from pathlib import Path

import numpy as np
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
    out = out.dropna(subset=["date", "cases"])
    out = (
        out.groupby(["date", "region", "disease"], as_index=False)["cases"]
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


def make_demo_data(start="2019-01-06", end="2023-12-31", seed=42):
    rng = np.random.default_rng(seed)
    weeks = pd.date_range(start, end, freq="W-SUN")
    week_of_year = weeks.isocalendar().week.to_numpy(dtype=float)
    year_factor = np.where(weeks.year == 2022, 1.6, 1.0)
    t = np.arange(len(weeks), dtype=float)
    trend_bump = 4.0 * t / 52.0
    seasonal = 55.0 * np.cos(2.0 * np.pi * (week_of_year - 38) / 52.0)
    profiles = {"NCR": (120, 45), "Region III": (90, 35), "Region IV-A": (110, 40)}
    frames = []
    for region, (base, noise_sd) in profiles.items():
        level = base + trend_bump + seasonal
        cases = np.round(level * year_factor + rng.normal(0, noise_sd, len(weeks))).clip(min=0)
        frames.append(
            pd.DataFrame(
                {
                    "date": weeks,
                    "region": region,
                    "disease": "Dengue",
                    "cases": cases.astype(int),
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


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
