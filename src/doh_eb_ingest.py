"""Canonical regional dengue ingestion from the DOH Epidemiology Bureau monthly
surveillance export (2022-01 .. 2026-08).

Source: DOH-EB "Regional Dengue Case Data 2022-2026" download (weekly,
monthly-by-region detail). Raw rows carry (Year, Month, Morbidity Week, Region,
Cases, Deaths) for each region — the Morbidity Week column is week-of-year
(1-53), so the monthly totals here are simply the sum of all morbidity weeks
within each calendar month. National is derived, never raw: the sum of the 18
regions per month, which keeps regional counts and the national total
consistent.

This module replaces the older UPRI-NOAH weekly ingest as the single canonical
source for BOTH the regional series and the derived National series. It is the
input node of the pipeline's DFD and feeds the relational database (ERD):
raw CSV -> monthly aggregations -> SQLAlchemy tables -> API.
"""

import pandas as pd

from . import ingest

DOH_FILE = "DOH-Epi-Dengue-2022-2026.csv"
DISEASE = "Dengue"

# Raw DOH CSV region labels -> HEALTHWATCH canonical labels (REGION_META names
# in the API / REGIONS in the frontend). 18 regions including NIR.
REGION_LABELS = {
    "NATIONAL CAPITAL REGION (NCR)": "National Capital Region",
    "CORDILLERA ADMINISTRATIVE REGION (CAR)": "Cordillera Administrative Region",
    "REGION I (ILOCOS REGION)": "Ilocos Region",
    "REGION II (CAGAYAN VALLEY)": "Cagayan Valley",
    "REGION III (CENTRAL LUZON)": "Central Luzon",
    "REGION IV-A (CALABARZON)": "CALABARZON",
    "MIMAROPA REGION": "MIMAROPA",
    "REGION V (BICOL REGION)": "Bicol Region",
    "NEGROS ISLAND REGION (NIR)": "Negros Island Region",
    "REGION VI (WESTERN VISAYAS)": "Western Visayas",
    "REGION VII (CENTRAL VISAYAS)": "Central Visayas",
    "REGION VIII (EASTERN VISAYAS)": "Eastern Visayas",
    "REGION IX (ZAMBOANGA PENINSULA)": "Zamboanga Peninsula",
    "REGION X (NORTHERN MINDANAO)": "Northern Mindanao",
    "REGION XI (DAVAO REGION)": "Davao Region",
    "REGION XII (SOCCSKSARGEN)": "SOCCSKSARGEN",
    "REGION XIII (CARAGA)": "Caraga",
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO (BARMM)": "Bangsamoro (BARMM)",
}


def load_regional_raw(data_dir=None):
    """Read the raw DOH monthly CSV and map rows to (date, region, cases, deaths)."""
    data_dir = data_dir if data_dir is not None else ingest.RAW_DIR
    path = data_dir / DOH_FILE
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing; place the DOH-EB monthly export in data/raw/ "
            "(DOH-Epi-Dengue-2022-2026.csv)."
        )
    df = pd.read_csv(path)
    # Header column is 'Morbidity Weel' in the source export; read it loosely.
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(
        columns={
            "Morbidity Weel": "morbidity_week",
            "Morbidity Week": "morbidity_week",
        }
    )
    required = ["Year", "Month", "Region", "Cases", "Deaths"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}; found {list(df.columns)}")
    df["region"] = df["Region"].map(REGION_LABELS)
    unmapped = sorted(df.loc[df["region"].isna(), "Region"].unique())
    if unmapped:
        raise ValueError(f"Unmapped DOH region labels: {unmapped}; extend REGION_LABELS.")
    df["date"] = pd.to_datetime(
        {"year": df["Year"], "month": df["Month"], "day": 1}, errors="coerce"
    )
    out = pd.DataFrame(
        {
            "date": df["date"],
            "region": df["region"],
            "disease": DISEASE,
            "cases": pd.to_numeric(df["Cases"], errors="coerce").clip(lower=0),
            "deaths": pd.to_numeric(df["Deaths"], errors="coerce").clip(lower=0),
        }
    )
    return out.dropna(subset=["date", "cases"]).sort_values(
        ["region", "date"], ignore_index=True
    )


def build_regional():
    """Monthly per-region case/death totals: sum of the morbidity weeks in month."""
    raw = load_regional_raw()
    regional = (
        raw.groupby(["date", "region", "disease"], as_index=False)[
            ["cases", "deaths"]
        ]
        .sum()
        .sort_values(["disease", "region", "date"], ignore_index=True)
    )
    # Reindex each region across the full 2022-01..2026-08 month grid so every
    # region has the same history length for the downstream modelling.
    regional = ingest.to_monthly(regional, fill_missing="zero")
    return regional


def build_national(regional=None):
    """Derive the National monthly series as the sum of the 18 regions."""
    regional = regional if regional is not None else build_regional()
    national = (
        regional.groupby(["date", "disease"], as_index=False)[["cases", "deaths"]]
        .sum()
        .assign(region="National")
    )
    return national.sort_values(["date"], ignore_index=True)


def save_all():
    regional = build_regional()
    n_regional = ingest.save_processed(regional, "regional_dengue_monthly.csv")
    national = build_national(regional)
    n_national = ingest.save_processed(national, "national_monthly.csv")
    return regional, national, n_regional, n_national


if __name__ == "__main__":
    regional, national, rpath, npath = save_all()
    print(f"Saved {len(regional)} regional monthly rows -> {rpath}")
    print(f"Saved {len(national)} national monthly rows -> {npath}")
    span = regional.groupby("region").agg(
        months=("cases", "size"),
        start=("date", "min"),
        end=("date", "max"),
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
    )
    print(span.to_string())
    print("\nNational annual totals (cases / deaths):")
    agg = (
        national.assign(y=national["date"].dt.year)
        .groupby("y")[["cases", "deaths"]]
        .sum()
        .round(0)
    )
    print(agg.to_string())