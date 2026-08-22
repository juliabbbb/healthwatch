from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from . import ingest

NATIONAL_FILES = {
    "Dengue": "Dengue.csv",
}

# cleans the RAW 

WEEKS_PER_YEAR = 52

# reads FRACTIONAL YEAR (epi_year + epi_week / 52) and returns epi_year, epi_week
def parse_ts_index(year_col):
    year_col = pd.to_numeric(year_col, errors="coerce")
    epi_year = year_col.fillna(0).astype(int)
    frac = year_col - epi_year
    epi_week = ((frac * WEEKS_PER_YEAR).round().astype(int) + 1).clip(1, WEEKS_PER_YEAR)
    return epi_year, epi_week


def ts_to_sunday(epi_year, epi_week):
    return [
        datetime.fromisocalendar(int(y), int(w), 7)
        for y, w in zip(epi_year, epi_week)
    ]


def load_national_file(path, disease):
    df = pd.read_csv(path)
    df.columns = [str(c).strip() for c in df.columns]
    cases_col = "Cases" if "Cases" in df.columns else df.columns[1]
    year_col = "Year" if "Year" in df.columns else df.columns[2]
    epi_year, epi_week = parse_ts_index(df[year_col])
    out = pd.DataFrame(
        {
            "date": ts_to_sunday(epi_year, epi_week),
            "region": "National",
            "disease": disease,
            "cases": pd.to_numeric(df[cases_col], errors="coerce").clip(lower=0),
        }
    )
    return out.dropna(subset=["date", "cases"]).sort_values("date", ignore_index=True)


def build_national(data_dir=None):
    data_dir = Path(data_dir) if data_dir else ingest.RAW_DIR
    frames = []
    for disease, fname in NATIONAL_FILES.items():
        path = data_dir / fname
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; see README download step.")
        frames.append(load_national_file(path, disease))
    national = pd.concat(frames, ignore_index=True)
    national["cases"] = national["cases"].astype(float).clip(lower=0)
    return national.sort_values(["disease", "region", "date"], ignore_index=True)


def save_national(national):
    return ingest.save_processed(national, "national_weekly.csv")


if __name__ == "__main__":
    df = build_national()
    path = save_national(df)
    print(f"Saved {len(df)} rows -> {path}")
    summary = df.groupby("disease").agg(
        weeks=("cases", "size"),
        start=("date", "min"),
        end=("date", "max"),
        max_cases=("cases", "max"),
        negatives_before_clip=("cases", lambda s: int((s < 0).sum())),
    )
    print(summary.to_string())
