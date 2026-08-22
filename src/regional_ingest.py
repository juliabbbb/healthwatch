from pathlib import Path

import pandas as pd

from . import ingest

# for regional cleaning 
HDX_FILE = "DOH-Epi-Dengue-2016-2021.csv"
DISEASE = "Dengue"

REGION_LABELS = {
    "NATIONAL CAPITAL REGION": "NCR",
    "CAR": "CAR",
    "BARMM": "BARMM",
    "CARAGA": "Caraga",
    "Region I-ILOCOS REGION": "Region I (Ilocos)",
    "Region II-CAGAYAN VALLEY": "Region II (Cagayan Valley)",
    "REGION III-CENTRAL LUZON": "Region III (Central Luzon)",
    "REGION IV-A-CALABARZON": "Region IV-A (CALABARZON)",
    "REGION IVB-MIMAROPA": "Region IV-B (MIMAROPA)",
    "REGION V-BICOL REGION": "Region V (Bicol)",
    "REGION VI-WESTERN VISAYAS": "Region VI (Western Visayas)",
    "REGION VII-CENTRAL VISAYAS": "Region VII (Central Visayas)",
    "REGION VII-EASTERN VISAYAS": "Region VIII (Eastern Visayas)",
    "REGION X-NORTHERN MINDANAO": "Region X (Northern Mindanao)",
    "REGION XI-DAVAO REGION": "Region XI (Davao)",
    "REGION XII-SOCCSKSARGEN": "Region XII (SOCCSKSARGEN)",
    "Region IX-ZAMBOANGA PENINSULA": "Region IX (Zamboanga Peninsula)",
}


def load_regional_raw(data_dir=None):
    data_dir = Path(data_dir) if data_dir else ingest.RAW_DIR
    path = data_dir / HDX_FILE
    if not path.exists():
        raise FileNotFoundError(f"{path} missing; download from HDX (see README).")
    df = pd.read_csv(path, skiprows=[1])
    df["date"] = pd.to_datetime(df["date"], format="%m/%d/%Y")
    df["region"] = df["Region"].map(REGION_LABELS)
    unmapped = sorted(df.loc[df["region"].isna(), "Region"].unique())
    if unmapped:
        raise ValueError(f"Unmapped region labels: {unmapped}; extend REGION_LABELS.")
    out = df[["date", "region"]].copy()
    out["disease"] = DISEASE
    out["cases"] = pd.to_numeric(df["cases"], errors="coerce").fillna(0)
    return out


def build_regional():
    raw = load_regional_raw()
    weekly = ingest.to_weekly(raw)
    weekly["cases"] = weekly["cases"].clip(lower=0)
    return weekly.sort_values(["disease", "region", "date"], ignore_index=True)


def save_regional(regional):
    return ingest.save_processed(regional, "regional_dengue_weekly.csv")


if __name__ == "__main__":
    regional = build_regional()
    path = save_regional(regional)
    print(f"Saved {len(regional)} rows -> {path}")
    summary = regional.groupby("region").agg(
        weeks=("cases", "size"),
        start=("date", "min"),
        end=("date", "max"),
        total_cases=("cases", "sum"),
    )
    print(summary.to_string())
