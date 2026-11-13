"""User-authorized supplementary leptospirosis reported-record target.

Each nonblank S/P/C-coded source row contributes one record, not one validated
individual case. Numeric weights and deaths are ignored. Raw rows and duplicate
candidates remain unchanged. Weekly calendar interpretation remains provisional.
"""
from pathlib import Path
import pandas as pd
from . import ingest
from .integrity import legacy_week_month
from .leptospirosis_ingest import REGION_LABELS

TARGET_UNIT = "reported_records"
DECISION_ID = "user_reported_records_2026_11_13"


def build_reported_records(raw_path=None, end="2025-12-31"):
    """Return observed regional and derived National counts; never fill gaps."""
    if raw_path is None:
        candidates = sorted((ingest.RAW_DIR / "new_diseases").glob("*Lepto*.csv"))
        if len(candidates) != 1:
            raise ValueError("Expected exactly one leptospirosis raw source")
        raw_path = candidates[0]
    raw_path = Path(raw_path)
    frame = pd.read_csv(raw_path, low_memory=False)
    required = {"Year", "Morbidity Week", "Region", "Cases", "Case Classification"}
    if not required.issubset(frame):
        raise ValueError("Missing leptospirosis source fields")
    frame = frame.loc[~frame.replace(r"^\s*$", pd.NA, regex=True).isna().all(axis=1)].copy()
    valid = frame["Cases"].astype("string").str.strip().str.upper().isin(["S", "P", "C"])
    valid |= frame["Case Classification"].astype("string").str.strip().str.upper().isin(["S", "P", "C"])
    if not valid.all():
        raise ValueError("Nonblank row lacks S/P/C inclusion code; source review required")
    years = pd.to_numeric(frame["Year"], errors="raise")
    weeks = pd.to_numeric(frame["Morbidity Week"], errors="raise")
    if (years.isna().any() or weeks.isna().any()
            or years.mod(1).ne(0).any() or weeks.mod(1).ne(0).any()):
        raise ValueError("Reporting year and week must be finite integers")
    frame["date"] = legacy_week_month(years.astype(int), weeks.astype(int))
    frame["region"] = frame["Region"].map(REGION_LABELS)
    if frame.region.isna().any():
        raise ValueError("Unmapped leptospirosis region")
    frame = frame[frame.date.between(pd.Timestamp("2019-01-01"), pd.Timestamp(end))]
    regional = frame.groupby(["date", "region"]).size().reset_index(name="cases")
    regional["disease"] = "Leptospirosis"
    regional["provisional"] = True
    regional["target_unit"] = TARGET_UNIT
    regional["counting_decision"] = DECISION_ID
    national = regional.groupby("date", as_index=False).agg(
        cases=("cases", "sum"), reporting_regions=("region", "nunique"))
    national["region"] = "National"
    national["disease"] = "Leptospirosis"
    national["provisional"] = True
    national["target_unit"] = TARGET_UNIT
    national["counting_decision"] = DECISION_ID
    national["coverage_complete"] = national.reporting_regions.eq(len(set(REGION_LABELS.values())))
    return regional.sort_values(["date", "region"]).reset_index(drop=True), national
