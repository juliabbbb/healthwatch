"""Canonical regional ingestion for Influenza-like Illness (ILI).

Source: DOH PIDSR ILI Surveillance (data/raw/new_diseases/ILI - Cases - Data.csv),
62,490 rows (2018-2026).

Known schema inversion:
  - 'Year' column contains Morbidity Week (1 to 53)
  - 'Morbidity Week' column contains Reporting Year (2018 to 2026)

Conventions:
  - Date = calendar month of the Thursday of the morbidity week
    (weeks 53 clipped to 52 to stay in-year, matching doh_eb_ingest convention).
  - All pre-2019 rows dropped at ingest boundary (DATA_START_YEAR = 2019).
  - Modelling cutoff ends at DATA_END (2026-08-31); week 34+ after cutoff excluded.
  - 18 canonical PSGC regions mapped via REGION_LABELS.
  - National series is strictly the sum of the 18 regional series.
"""

from pathlib import Path
import pandas as pd

from . import config, ingest

ILI_RAW_FILE = "data/raw/new_diseases/ILI - Cases - Data.csv"
DISEASE = "Influenza-like Illness"
DATA_END = pd.Timestamp("2026-08-31")

REGION_LABELS = {
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO (BARMM)": "Bangsamoro (BARMM)",
    "CORDILLERA ADMINISTRATIVE REGION (CAR)": "Cordillera Administrative Region",
    "NATIONAL CAPITAL REGION (NCR)": "National Capital Region",
    "NEGROS ISLAND REGION (NIR)": "Negros Island Region",
    "REGION I (ILOCOS REGION)": "Ilocos Region",
    "REGION II (CAGAYAN VALLEY)": "Cagayan Valley",
    "REGION III (CENTRAL LUZON)": "Central Luzon",
    "REGION IV-A (CALABARZON)": "CALABARZON",
    "REGION IV-B (MIMAROPA)": "MIMAROPA",
    "REGION IX (ZAMBOANGA PENINSULA)": "Zamboanga Peninsula",
    "REGION V (BICOL REGION)": "Bicol Region",
    "REGION VI (WESTERN VISAYAS)": "Western Visayas",
    "REGION VII (CENTRAL VISAYAS)": "Central Visayas",
    "REGION VIII (EASTERN VISAYAS)": "Eastern Visayas",
    "REGION X (NORTHERN MINDANAO)": "Northern Mindanao",
    "REGION XI (DAVAO REGION)": "Davao Region",
    "REGION XII (SOCCSKSARGEN)": "SOCCSKSARGEN",
    "REGION XIII (CARAGA)": "Caraga",
}


def _epi_week_month(year_series, week_series):
    """Calendar month that contains the Thursday of a morbidity week."""
    weeks = pd.Series(week_series, dtype="int64").clip(upper=52)
    years = pd.Series(year_series, dtype="int64")
    thu = pd.Series(
        [
            pd.Timestamp.fromisocalendar(int(y), int(w), 4)
            for y, w in zip(years, weeks)
        ]
    )
    return thu.dt.to_period("M").dt.to_timestamp()


def process_ili(raw_path=None):
    raw_path = Path(raw_path) if raw_path else Path(ILI_RAW_FILE)
    if not raw_path.exists():
        raise FileNotFoundError(f"ILI raw source not found: {raw_path}")

    df = pd.read_csv(raw_path, low_memory=False)

    # Inverted headers: 'Year' is week, 'Morbidity Week' is year
    raw_years = df["Morbidity Week"].astype(int)
    raw_weeks = df["Year"].astype(int)

    # Filter >= 2019
    mask_2019 = raw_years >= config.DATA_START_YEAR
    df_valid = df[mask_2019].copy()
    valid_years = raw_years[mask_2019]
    valid_weeks = raw_weeks[mask_2019]

    # Map dates
    df_valid["date"] = _epi_week_month(valid_years, valid_weeks)

    # Enforce cutoff <= DATA_END
    df_valid = df_valid[df_valid["date"] <= DATA_END].copy()

    # Map regions
    df_valid["region"] = df_valid["Region"].map(REGION_LABELS)
    unmapped = df_valid[df_valid["region"].isna()]["Region"].unique()
    if len(unmapped) > 0:
        raise ValueError(f"Unmapped ILI region(s): {unmapped}")

    # Cases
    df_valid["cases"] = pd.to_numeric(df_valid["Cases"], errors="coerce").fillna(0).astype(int)
    df_valid["deaths"] = 0  # No deaths column in ILI raw data

    # Aggregate monthly by region
    regional = (
        df_valid.groupby(["date", "region"], as_index=False)[["cases", "deaths"]]
        .sum()
        .sort_values(["region", "date"], ignore_index=True)
    )
    regional["disease"] = DISEASE

    # Reindex to ensure 18 regions x 92 months grid
    idx = pd.date_range("2019-01-01", DATA_END, freq="MS")
    canonical_regions = sorted(list(set(REGION_LABELS.values())))
    full_grid = []
    for reg in canonical_regions:
        sub = regional[regional["region"] == reg].set_index("date")
        reindexed = sub.reindex(idx).rename_axis("date").reset_index()
        reindexed["region"] = reg
        reindexed["disease"] = DISEASE
        reindexed["cases"] = reindexed["cases"].fillna(0).astype(int)
        reindexed["deaths"] = reindexed["deaths"].fillna(0).astype(int)
        full_grid.append(reindexed)

    regional_full = pd.concat(full_grid, ignore_index=True)[
        ["date", "region", "disease", "cases", "deaths"]
    ]

    # National series = sum of 18 regions
    national = (
        regional_full.groupby("date", as_index=False)[["cases", "deaths"]]
        .sum()
        .sort_values("date", ignore_index=True)
    )
    national["disease"] = DISEASE
    national["region"] = "National"
    national = national[["date", "disease", "cases", "deaths", "region"]]

    # Integrity assertion: sum of regional cases == national cases
    assert regional_full["cases"].sum() == national["cases"].sum(), "National sum mismatch in ILI!"

    # Save
    out_reg = ingest.PROCESSED_DIR / "regional_ili_monthly.csv"
    out_nat = ingest.PROCESSED_DIR / "national_ili_monthly.csv"
    regional_full.to_csv(out_reg, index=False)
    national.to_csv(out_nat, index=False)

    print(f"ILI processed: {len(regional_full)} regional rows, {len(national)} national rows.")
    print(f"ILI total cases: {national['cases'].sum():,}")
    return regional_full, national


if __name__ == "__main__":
    process_ili()
