"""Canonical regional ingestion for Leptospirosis.

Source: DOH PIDSR Leptospirosis Surveillance
(data/raw/new_diseases/[#DOH-249290475072] Santiago_2019-2026 Lepto Cases and Fatality - Leptospirosis.csv),
30,792 rows (2019-2026).

Layout verification and handling:
  - 187 completely blank physical rows dropped.
  - Year 2023 layout: 'Case Classification' contains S/P/C, 'Cases' contains
    numeric count of cases, 'Deaths' contains numeric count of deaths.
  - Non-2023 layout (2019-2022, 2024-2026): 'Case Classification' is blank,
    'Cases' column carries classification codes (S/P/C), and the 10th column
    (labeled 'Deaths') carries the group's numeric case count (min=1, max=77).
    Fatal outcomes for non-2023 are therefore unseparated in the raw export.

Conventions:
  - Date = calendar month of the Thursday of the morbidity week (weeks 53
    clipped into week 52, matching doh_eb_ingest convention).
  - Data window: 2019-01 .. 2026-08 (92 months); weeks in Sep 2026 excluded
    to align with DATA_END.
  - 18 canonical PSGC regions mapped via REGION_LABELS.
  - National series is strictly the sum of the 18 regional series.
"""

from pathlib import Path
import pandas as pd

from . import config, ingest

LEPTO_RAW_GLOB = "*Lepto*.csv"
DISEASE = "Leptospirosis"
DATA_END = pd.Timestamp("2026-08-31")

REGION_LABELS = {
    "NATIONAL CAPITAL REGION (NCR)": "National Capital Region",
    "CORDILLERA ADMINISTRATIVE REGION (CAR)": "Cordillera Administrative Region",
    "REGION I (ILOCOS REGION)": "Ilocos Region",
    "REGION II (CAGAYAN VALLEY)": "Cagayan Valley",
    "REGION III (CENTRAL LUZON)": "Central Luzon",
    "REGION IV-A (CALABARZON)": "CALABARZON",
    "MIMAROPA REGION": "MIMAROPA",
    "REGION IV-B (MIMAROPA)": "MIMAROPA",
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


def process_leptospirosis(raw_dir=None):
    raw_dir = Path(raw_dir) if raw_dir else Path("data/raw/new_diseases")
    matches = list(raw_dir.glob(LEPTO_RAW_GLOB))
    if not matches:
        raise FileNotFoundError(f"No Leptospirosis raw file found matching {LEPTO_RAW_GLOB} in {raw_dir}")
    raw_path = matches[0]

    df = pd.read_csv(raw_path, low_memory=False)

    # 1. Drop blank records
    df = df.dropna(subset=["Year"]).copy()
    df["Year"] = df["Year"].astype(int)
    df["Morbidity Week"] = df["Morbidity Week"].astype(int)

    # 2. Extract numeric cases & deaths respecting the schema layouts
    is_2023 = df["Year"] == 2023

    # Cases
    cases = pd.Series(0, index=df.index, dtype="int64")
    cases[is_2023] = pd.to_numeric(df.loc[is_2023, "Cases"], errors="coerce").fillna(0).astype("int64")
    cases[~is_2023] = pd.to_numeric(df.loc[~is_2023, "Deaths"], errors="coerce").fillna(0).astype("int64")
    df["cases"] = cases

    # Deaths (only 2023 has reliable separate deaths count in this file)
    deaths = pd.Series(0, index=df.index, dtype="int64")
    deaths[is_2023] = pd.to_numeric(df.loc[is_2023, "Deaths"], errors="coerce").fillna(0).astype("int64")
    df["deaths"] = deaths

    # 3. Derive calendar dates via Thursday of morbidity week
    df["date"] = _epi_week_month(df["Year"], df["Morbidity Week"])

    # 4. Enforce bounds: 2019-01-01 <= date <= DATA_END (2026-08-31)
    df = df[(df["date"] >= config.DATA_START) & (df["date"] <= DATA_END)].copy()

    # 5. Map regions
    df["region"] = df["Region"].map(REGION_LABELS)
    unmapped = df[df["region"].isna()]["Region"].unique()
    if len(unmapped) > 0:
        raise ValueError(f"Unmapped Leptospirosis region(s): {unmapped}")

    # 6. Monthly aggregation
    regional = (
        df.groupby(["date", "region"], as_index=False)[["cases", "deaths"]]
        .sum()
        .sort_values(["region", "date"], ignore_index=True)
    )
    regional["disease"] = DISEASE

    # Reindex to full 18-region x 92-month grid
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

    # Integrity assertion
    assert regional_full["cases"].sum() == national["cases"].sum(), "National sum mismatch in Leptospirosis!"

    # Save
    out_reg = ingest.PROCESSED_DIR / "regional_leptospirosis_monthly.csv"
    out_nat = ingest.PROCESSED_DIR / "national_leptospirosis_monthly.csv"
    regional_full.to_csv(out_reg, index=False)
    national.to_csv(out_nat, index=False)

    print(f"Leptospirosis processed: {len(regional_full)} regional rows, {len(national)} national rows.")
    print(f"Leptospirosis total cases: {national['cases'].sum():,}")
    return regional_full, national


if __name__ == "__main__":
    process_leptospirosis()
