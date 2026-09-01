"""Canonical regional dengue ingestion from DOH Epidemiology Bureau (PIDSR)
surveillance data as curated by UPRI-NOAH.

Source: "Weekly dengue incidence linked to meteorological variables at city,
regional, and multi-setting scales" (UPRI-NOAH; Zenodo DOI 10.5281/zenodo.19448854,
GitHub UPRI-NOAH/dengue-rainfall-dataset, licensed ODC-ODbL). The Regional Data
sheet carries weekly dengue cases by Philippine administrative region from the
DOH Epidemiology Bureau (FOI release 2026-031, Jan 2026).

Coverage: 17 regions, 2016-2025, EXCLUDING 2020-2021 (a structural gap in the
source). Weekly index WN uses ISO epidemiology weeks; we map (YR, WN) to the
week-ending Sunday to match the rest of the pipeline.

This module replaces the older HDX (2016-2021) ingest as the single canonical
source for BOTH the regional series and the derived National series (sum of the
17 regions per week), keeping regional counts and the national total consistent.
"""

from datetime import datetime
from pathlib import Path

import pandas as pd

from . import ingest

UPRI_FILE = "DOH-Epi-Dengue-2016-2025-UPRI-NOAH.xlsx"
UPRI_SHEET = "Regional Data"
DISEASE = "Dengue"

# UPRI-NOAH / DOH-EB region labels -> HEALTHWATCH canonical labels
REGION_LABELS = {
    "NCR": "NCR",
    "CAR": "CAR",
    "BARMM": "BARMM",
    "REGION XIII": "Caraga",
    "MIMAROPA": "Region IV-B (MIMAROPA)",
    "REGION I": "Region I (Ilocos)",
    "REGION II": "Region II (Cagayan Valley)",
    "REGION III": "Region III (Central Luzon)",
    "REGION IV-A": "Region IV-A (CALABARZON)",
    "REGION V": "Region V (Bicol)",
    "REGION VI": "Region VI (Western Visayas)",
    "REGION VII": "Region VII (Central Visayas)",
    "REGION VIII": "Region VIII (Eastern Visayas)",
    "REGION IX": "Region IX (Zamboanga Peninsula)",
    "REGION X": "Region X (Northern Mindanao)",
    "REGION XI": "Region XI (Davao)",
    "REGION XII": "Region XII (SOCCSKSARGEN)",
}


def _iso_week_to_sunday(year, week):
    """Map (ISO year, ISO week) to the week-ending Sunday; fold week 53 -> 1."""
    year = int(year)
    week = int(week)
    if week > 52:
        week = 1
    return datetime.fromisocalendar(year, week, 7)


def load_regional_raw(data_dir=None):
    data_dir = Path(data_dir) if data_dir else ingest.RAW_DIR
    path = data_dir / UPRI_FILE
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing; download from GitHub "
            "UPRI-NOAH/dengue-rainfall-dataset (ODC-ODbL), see README."
        )
    df = pd.read_excel(path, sheet_name=UPRI_SHEET)
    df = df.dropna(subset=["DC_DOH"])
    df["region"] = df["REGION"].map(REGION_LABELS)
    unmapped = sorted(df.loc[df["region"].isna(), "REGION"].unique())
    if unmapped:
        raise ValueError(f"Unmapped region labels: {unmapped}; extend REGION_LABELS.")
    df["date"] = [
        _iso_week_to_sunday(y, w) for y, w in zip(df["YR"], df["WN"])
    ]
    out = pd.DataFrame(
        {
            "date": df["date"],
            "region": df["region"],
            "disease": DISEASE,
            "cases": pd.to_numeric(df["DC_DOH"], errors="coerce").clip(lower=0),
        }
    )
    return out.dropna(subset=["date", "cases"]).sort_values(
        ["region", "date"], ignore_index=True
    )


def build_regional():
    df = load_regional_raw()
    return df.sort_values(["disease", "region", "date"], ignore_index=True)


def build_national(regional=None):
    """Derive the National weekly series as the sum of the 17 regions per week."""
    regional = regional if regional is not None else build_regional()
    national = (
        regional.groupby(["date", "disease"], as_index=False)["cases"]
        .sum()
        .assign(region="National")
    )
    return national.sort_values(["date"], ignore_index=True)


def save_all():
    regional = build_regional()
    regional_path = ingest.save_processed(regional, "regional_dengue_weekly.csv")
    national = build_national(regional)
    national_path = ingest.save_processed(national, "national_weekly.csv")
    return regional, national, regional_path, national_path


if __name__ == "__main__":
    regional, national, rpath, npath = save_all()
    print(f"Saved {len(regional)} regional rows -> {rpath}")
    print(f"Saved {len(national)} national rows -> {npath}")
    span = regional.groupby("region").agg(
        weeks=("cases", "size"),
        start=("date", "min"),
        end=("date", "max"),
        total_cases=("cases", "sum"),
    )
    print(span.to_string())
    print("\nNational annual totals:")
    print(
        national.assign(y=national["date"].dt.year)
        .groupby("y")["cases"]
        .sum()
        .round(0)
        .to_string()
    )