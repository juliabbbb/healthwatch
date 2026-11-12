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
    from .integrity import legacy_week_month
    return legacy_week_month(year_series, week_series)


def process_leptospirosis(raw_dir=None):
    raise ValueError("Leptospirosis case measure unresolved. No monthly case totals may be generated until the year-specific dictionary is confirmed.")


if __name__ == "__main__":
    process_leptospirosis()
