"""Canonical regional ingestion for the four food/waterborne disease (FWD)
line-lists (2018-01 .. 2026-09, data/raw download from DOH-EB).

Source files (each one already a pre-aggregated case-level line-list sharing
the dengue row shape, minus dengue's clinical/final-classification split):

  Acute Bloody Diarrhea (ABD)  _FWBD_2018-2026 Data  - ABD.csv
  Cholera                      _FWBD_2018-2026 Data  - Cholera.csv
  Typhoid Fever                _FWBD_2018-2026 Data  - Typhoid.csv
  Acute Viral Hepatitis        _FWBD_2018-2026 Data  - Hep A.csv

Every row carries (Year, Morbidity Month, Morbidity Week, Region, Province,
Age Group, Sex, Admitted, Outcome, Case Classification, Total Cases) with two
exceptions: ABD adds Laboratory Result + Organism, and the Hepatitis file is a
case-per-row table (no Total Cases; Age as an integer instead of an age-group
bucket; Region as a short numeric/NCR/CAR/... code).

Conventions (documented with the dengue ingest in ARCHITECTURE and the thesis
methodology):

  - Date = calendar month of the row's explicit Morbidity Month; no epi-week
    rule is needed because the FWD files carry a real month column.
  - "Reported cases" = sum of ALL final case classifications (Suspect +
    Probable + Confirmed; S/P/C letter codes are mapped to labels). This is
    what the dashboard forecasts, exactly as dengue does.
  - Deaths are embedded in the line-list as Outcome = 'D' (Died); the death
    count for a record is its own case count when the outcome is D, else 0.
  - The monitoring may follow a disease, never a lump. Each of the four
    diseases runs its own monthly series, forecast, risk tiers, outbreak
    flags and escalation ranking (the pipeline is disease-parameterized);
    `FWD_GROUP` is only a presentation tag so the UI can group them under
    "Food and Waterborne Diseases".
  - Limited data is honoured: each (disease, region) series spans its own
    first-reported .. last-reported months (per-region grids, so a region
    that stopped reporting does not get fake trailing/leading zeros across
    the disease-wide calendar), and each disease's national series spans the
    disease's own min..max calendar. Hepatitis contributes nothing after
    2025-09; the other three run through 2026-09.

National is derived, never raw: the sum of the reporting regions per month.

This module is the FWD input node of the pipeline's DFD and feeds the
relational database (ERD): raw CSV -> monthly aggregations -> SQLAlchemy
tables -> API.

Run: python -m src.fwbd_ingest
"""

import pandas as pd

from . import config, ingest
from .doh_eb_ingest import REGION_LABELS

FWD_GROUP = "Food and Waterborne Diseases"

FWD_DISEASES = [
    "Acute Bloody Diarrhea",
    "Cholera",
    "Typhoid Fever",
    "Acute Viral Hepatitis",
]

# Exact raw filenames (note the double space before the dash) -> canonical
# HEALTHWATCH disease labels (SUPPORTED_DISEASES in the API).
FWD_FILES = {
    "Acute Bloody Diarrhea": "_FWBD_2018-2026 Data  - ABD.csv",
    "Cholera": "_FWBD_2018-2026 Data  - Cholera.csv",
    "Typhoid Fever": "_FWBD_2018-2026 Data  - Typhoid.csv",
    "Acute Viral Hepatitis": "_FWBD_2018-2026 Data  - Hep A.csv",
}

# The Hepatitis file keys Region with short codes instead of the DOH long
# labels; map every code it can contain to the canonical HEALTHWATCH label.
_HEPA_REGION_CODES = {
    "1": "Ilocos Region",
    "2": "Cagayan Valley",
    "3": "Central Luzon",
    "4A": "CALABARZON",
    "4B": "MIMAROPA",
    "5": "Bicol Region",
    "6": "Western Visayas",
    "7": "Central Visayas",
    "8": "Eastern Visayas",
    "9": "Zamboanga Peninsula",
    "10": "Northern Mindanao",
    "11": "Davao Region",
    "12": "SOCCSKSARGEN",
    "13": "Caraga",
    "NCR": "National Capital Region",
    "CAR": "Cordillera Administrative Region",
    "CARAGA": "Caraga",
    "NIR": "Negros Island Region",
    "BARMM": "Bangsamoro (BARMM)",
}

# S/P/C -> the Suspect/Probable/Confirmed labels the API and UI present.
_CASE_CLASSIFICATION = {"S": "Suspect", "P": "Probable", "C": "Confirmed"}

# FWD age-group buckets (the shared column of the three case tables).
_FWD_AGE_GROUPS = ("0-4", "5-14", "15-24", "25-64", "65+", "Unknown")

_CASE_COL = "Total Cases"
_MONTH_COL = "Morbidity Month"


def _age_bucket(age):
    """Bucket an integer age the way the DOH FWD tables already bucket theirs
    (0-4 / 5-14 / 15-24 / 25-64 / 65+); missing ages are 'Unknown'."""
    if pd.isna(age):
        return "Unknown"
    a = int(age)
    if a <= 4:
        return "0-4"
    if a <= 14:
        return "5-14"
    if a <= 24:
        return "15-24"
    if a <= 64:
        return "25-64"
    return "65+"


def _read_fwd_file(disease, data_dir=None):
    """Read one FWD line-list into long-form (date, region, disease, cases,
    deaths) rows with the canonical region labels. Raises on unmapped region
    codes (fail loudly keeps a mis-export from silently shortening a series)."""
    data_dir = data_dir if data_dir is not None else ingest.RAW_DIR
    path = data_dir / FWD_FILES[disease]
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing; place the DOH FWD line-list in data/raw/ "
            f"({FWD_FILES[disease]})."
        )
    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]

    if disease == "Acute Viral Hepatitis":
        df["region"] = df["Region"].astype(str).map(_HEPA_REGION_CODES)
        df["age_group"] = df["Age"].map(_age_bucket)
        prov_col = "Province" if "Province" in df.columns else (
            "Province/City" if "Province/City" in df.columns else None
        )
    else:
        df["region"] = df["Region"].map(REGION_LABELS)
        df["age_group"] = df["Age Group"].fillna("Unknown")
        prov_col = (
            "Province/Highly Urbanized Cities"
            if "Province/Highly Urbanized Cities" in df.columns
            else ("Province" if "Province" in df.columns else None)
        )

    unmapped = sorted(df.loc[df["region"].isna(), "Region"].astype(str).unique())
    if unmapped:
        raise ValueError(
            f"Unmapped FWD region labels for {disease}: {unmapped}; "
            f"extend REGION_LABELS/_HEPA_REGION_CODES."
        )

    df["date"] = pd.to_datetime(
        df["Year"].astype("int64").astype(str)
        + "-"
        + df[_MONTH_COL].astype("int64").astype(str).str.zfill(2)
        + "-01"
    )
    # Computation is restricted to 2019-2026 (src/config.py); the raw
    # line-lists still open in 2018, so the once-at-ingest lower bound
    # drops those rows at the file boundary.
    df = config.at_or_after_data_start(df)
    if _CASE_COL in df.columns:
        df["cases"] = (
            pd.to_numeric(df[_CASE_COL], errors="coerce")
            .clip(lower=0)
            .fillna(0)
            .astype("float64")
        )
    else:
        # Case-per-row table (Hepatitis): each record IS one case.
        df["cases"] = 1.0
    df["deaths"] = (
        df["cases"] * df["Outcome"].astype(str).str.upper().eq("D")
    ).astype("float64")
    df["province"] = (
        df[prov_col].fillna("").astype(str).str.strip()
        if prov_col is not None
        else ""
    )
    df["disease"] = disease
    return df[["date", "region", "disease", "cases", "deaths"]].sort_values(
        ["region", "date"], ignore_index=True
    )


def load_regional_raw(data_dir=None):
    """Concatenate all four FWD files into one long monthly-ish frame."""
    frames = [
        _read_fwd_file(disease, data_dir=data_dir) for disease in FWD_DISEASES
    ]
    return pd.concat(frames, ignore_index=True)


def _to_monthly(df, sum_cols):
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"]).dt.to_period("M").dt.to_timestamp()
    return (
        out.groupby(["date", "region", "disease"], as_index=False)[sum_cols]
        .sum()
        .sort_values(["disease", "region", "date"], ignore_index=True)
    )


def build_regional(regional=None):
    """Monthly per-region case/death totals, one per-(disease, region) grid.

    Each (disease, region) series spans that region's OWN first-to-last
    reported months, so a region (or disease, e.g. Hepatitis through 2025-09)
    that stopped reporting is never padded with fake zeros outside its real
    reporting window."""
    regional = regional if regional is not None else load_regional_raw()
    data = _to_monthly(regional, ["cases", "deaths"])
    sum_cols = ["cases", "deaths"]
    parts = []
    for (disease, region), group in data.groupby(["disease", "region"]):
        idx = pd.date_range(group["date"].min(), group["date"].max(), freq="MS")
        g = (
            group[["date"] + sum_cols]
            .set_index("date")
            .reindex(idx, fill_value=0)
            .rename_axis("date")
            .reset_index()
        )
        g["disease"] = disease
        g["region"] = region
        parts.append(g)
    return pd.concat(parts, ignore_index=True)[
        ["date", "region", "disease"] + sum_cols
    ].sort_values(["disease", "region", "date"], ignore_index=True)


def build_national(regional=None):
    """Derive each disease's National monthly series as the sum of its
    reporting regions, over the disease's own calendar span."""
    regional = regional if regional is not None else build_regional()
    data = _to_monthly(regional, ["cases", "deaths"])
    sum_cols = ["cases", "deaths"]
    parts = []
    for disease, group in data.groupby("disease"):
        idx = pd.date_range(group["date"].min(), group["date"].max(), freq="MS")
        g = (
            group.groupby("date", as_index=False)[sum_cols]
            .sum()
            .set_index("date")
            .reindex(idx, fill_value=0)
            .rename_axis("date")
            .reset_index()
        )
        g["disease"] = disease
        g["region"] = "National"
        parts.append(g)
    return pd.concat(parts, ignore_index=True)[
        ["date", "region", "disease"] + sum_cols
    ].sort_values(["disease", "date"], ignore_index=True)


def load_fwbd_case_records(data_dir=None):
    """Return all four FWD line-lists as case records (region-mapped, raw dims).

    No monthly aggregation — every 2019-2026 record (pre-2019 rows are
    dropped once at this raw-file boundary; see src/config.py), for the
    relational `fwbd_case_records` table backing the reported-data breakdown
    endpoint (`/reported/{region}?disease=...`). Carries only the dimensions
    the FWD files actually have: case_classification (Suspect/Probable/
    Confirmed), age_group, sex, admitted, outcome (Alive/Died); ABD alone has
    laboratory_result/organism. Cases never drop below 1 per record; deaths
    equal the record's cases when the outcome is D, else 0.
    """
    records = []
    for disease in FWD_DISEASES:
        data_dir = data_dir if data_dir is not None else ingest.RAW_DIR
        path = data_dir / FWD_FILES[disease]
        if not path.exists():
            raise FileNotFoundError(f"{path} missing; place the FWD line-list in data/raw/.")
        df = pd.read_csv(path)
        df.columns = [c.strip() for c in df.columns]

        if disease == "Acute Viral Hepatitis":
            df["region_label"] = df["Region"].astype(str)
            df["age_group"] = df["Age"].map(_age_bucket)
            df["province"] = (
                df["Province"].fillna(df["Province/City"]).fillna("").astype(str).str.strip()
            )
        else:
            df["region_label"] = df["Region"]
            df["age_group"] = df["Age Group"].fillna("Unknown")
            df["province"] = df["Province/Highly Urbanized Cities"].fillna("").astype(str).str.strip()

        df["region"] = df["region_label"].map(REGION_LABELS)
        df.loc[df["region"].isna() & df["region_label"].isin(_HEPA_REGION_CODES),
               "region"] = df["region_label"].map(_HEPA_REGION_CODES)
        unmapped = sorted(df.loc[df["region"].isna(), "region_label"].astype(str).unique())
        if unmapped:
            raise ValueError(f"Unmapped FWD region labels ({disease}): {unmapped}")

        df["case_classification"] = (
            df["Case Classification"].astype(str).str.strip().str.upper()
        ).map(_CASE_CLASSIFICATION).fillna("Confirmed")
        df["outcome"] = df["Outcome"].astype(str).str.upper().map(
            {"A": "Alive", "D": "Died"}
        ).fillna("Alive")
        df["admitted"] = df["Admitted"].astype(str).str.upper().map(
            {"Y": True, "N": False}
        ).fillna(False)
        df["sex"] = df["Sex"].fillna("").astype(str).str.upper()
        df["year"] = df["Year"].astype("int64")
        df["month"] = df[_MONTH_COL].astype("int64")
        if _CASE_COL in df.columns:
            df["cases"] = (
                pd.to_numeric(df[_CASE_COL], errors="coerce").clip(lower=0).fillna(0)
            ).astype(int)
        else:
            df["cases"] = 1
        df["deaths"] = (df["outcome"] == "Died") * df["cases"]
        df["laboratory_result"] = (
            df["Laboratory Result"].fillna("").astype(str).str.upper()
            if "Laboratory Result" in df.columns
            else ""
        )
        df["organism"] = (
            df["Organism"].fillna("").astype(str)
            if "Organism" in df.columns
            else ""
        )
        df["disease"] = disease
        records.append(df)

    out = pd.concat(records, ignore_index=True)
    return out[
        ["disease", "region", "province", "year", "month", "age_group", "sex",
         "case_classification", "admitted", "outcome", "laboratory_result",
         "organism", "cases", "deaths"]
    ][out["year"] >= config.DATA_START_YEAR].reset_index(drop=True)


def save_all():
    regional = build_regional()
    rpath = ingest.save_processed(regional, "regional_fwbd_monthly.csv")
    national = build_national(regional)
    npath = ingest.save_processed(national, "national_fwbd_monthly.csv")
    return regional, national, rpath, npath


if __name__ == "__main__":
    regional, national, rpath, npath = save_all()
    print(f"Saved {len(regional)} regional monthly rows -> {rpath}")
    print(f"Saved {len(national)} national monthly rows -> {npath}")

    span = regional.groupby(["disease", "region"]).agg(
        months=("cases", "size"),
        start=("date", "min"),
        end=("date", "max"),
        total_cases=("cases", "sum"),
        total_deaths=("deaths", "sum"),
    )
    print(span.to_string())

    print("\nNational annual totals (cases):")
    agg = (
        national.assign(y=national["date"].dt.year)
        .groupby(["disease", "y"])["cases"]
        .sum()
        .round(0)
    )
    print(agg.to_string())

    recs = load_fwbd_case_records()
    print(f"\nRecords available in raw line-lists: {len(recs)}")
    print(recs.groupby("disease").size().to_string())