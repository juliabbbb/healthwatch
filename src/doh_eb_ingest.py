"""Canonical regional dengue ingestion from the DOH dengue case line-list
(2019-01 .. 2026-08).

Source: DOH "Dengue Final Data" line-list export (2019-2026), 749,683 rows.
Every row is a pre-aggregated case record carrying (Year, Morbidity Week,
Region, Province, Age Group, Sex, Clinical Classification, Final Case
Classification, Admitted, No. of Cases, No. of Deaths). There is no explicit
month column, so the weekly totals are bucketed to calendar months with the DOH
epi-week convention:

  month(Y, W) = calendar month of the Thursday of morbidity week W in year Y
                (weeks 53 are clipped into week 52, i.e. reallocated to
                December — mirroring the DOH weekly export's own December
                tagging; empirically this reproduces the old 2022-2026 monthly
                series to within a 0.0% net difference for every complete
                year).

"Reported cases" = the sum of ALL final classifications (Suspect + Probable +
Confirmed); this is exactly what the retired monthly export summed, so the
annual totals are bit-for-bit identical to the previous pipeline for
2022-2025 (and 2019 totals match DOH's ~437k epidemic-year headline). One row
per month per region, no classification/age/sex dimensions in the monthly
series — the dashboard forecast shape is unchanged. The modelling grid is
2019-01..2026-08 (92 months); later line-list rows (Sep-Dec 2026) are
excluded from the forecast series but retained in `dengue_case_records` for
the deferred severity/demographic analyses.

National is derived, never raw: the sum of the 18 regions per month, which
keeps regional counts and the national total consistent.

This module is the input node of the pipeline's DFD and feeds the relational
database (ERD): raw CSV -> monthly aggregations -> SQLAlchemy tables -> API.
"""

import pandas as pd

from . import config, ingest

DOH_FILE = "DOH-Epi-Dengue-2019-2026-line-list.csv"
DISEASE = "Dengue"

# Epi-week month cut: months strictly after this are excluded from the monthly
# modelling grid (foreign months that the previous export did not cover).
DATA_END = pd.Timestamp("2026-08-31")

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

# Line-list column names (before/after whitespace stripping).
_CASE_COL = "No. of Cases"
_DEATH_COL = "No. of Deaths"
_WEEK_COL = "Morbidity Week"


def _epi_week_month(year, week):
    """Calendar month that contains the Thursday of a DOH morbidity week.

    Morbidity weeks number the ISO/Sunday-start weeks of a year (1-53). Week 53
    is clipped into week 52 so its (typically late-December) days stay in the
    reporting year — matching the retired monthly export's December tagging.
    """
    weeks = pd.Series(week, dtype="int64").clip(upper=52)
    thu = pd.Series(
        [
            pd.Timestamp.fromisocalendar(int(y), int(w), 4)
            for y, w in zip(pd.Series(year).astype("int64"), weeks)
        ]
    )
    return thu.dt.to_period("M").dt.to_timestamp()


def load_regional_raw(data_dir=None):
    """Read the raw line-list CSV and collapse to (date, region, cases, deaths).

    One row per (month, region) of TOTAL reported cases (sum across province/
    age group/sex/clinical/final classification). Rows after DATA_END are
    dropped — the modelling grid ends at the last month the old series covered.
    """
    data_dir = data_dir if data_dir is not None else ingest.RAW_DIR
    path = data_dir / DOH_FILE
    if not path.exists():
        raise FileNotFoundError(
            f"{path} missing; place the DOH case line-list in data/raw/ "
            f"({DOH_FILE})."
        )
    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]
    required = ["Year", "Region", _WEEK_COL, _CASE_COL, _DEATH_COL]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}; found {list(df.columns)}")

    df["region"] = df["Region"].map(REGION_LABELS)
    unmapped = sorted(df.loc[df["region"].isna(), "Region"].unique())
    if unmapped:
        raise ValueError(f"Unmapped DOH region labels: {unmapped}; extend REGION_LABELS.")

    df["date"] = _epi_week_month(df["Year"], df[_WEEK_COL])
    df = df[df["date"] <= DATA_END].copy()
    # Lower bound from src/config.py: computation is restricted to 2019-2026;
    # the dengue file itself starts in 2019, so this is a defensive no-op.
    df = config.at_or_after_data_start(df)

    df["cases"] = pd.to_numeric(df[_CASE_COL], errors="coerce").clip(lower=0)
    df["deaths"] = pd.to_numeric(df[_DEATH_COL], errors="coerce").clip(lower=0)
    out = (
        df.groupby(["date", "region"], as_index=False)[["cases", "deaths"]]
        .sum()
        .assign(disease=DISEASE)
    )
    return out[["date", "region", "disease", "cases", "deaths"]].sort_values(
        ["region", "date"], ignore_index=True
    )


def load_case_records(data_dir=None):
    """Return the FULL line-list as case records (region-mapped, raw dims).

    No monthly aggregation and no DATA_END cut — every 2019-2026 record, for
    the relational `dengue_case_records` table backing the reported-data
    breakdown endpoint (`/reported/{region}`) and severity/demographic
    analyses. Each record also carries the `month` bucket (same Thursday
    epi-week rule as the modelling grid) so breakdowns align with the monthly
    reported series. Cases/deaths clipped at zero.
    """
    data_dir = data_dir if data_dir is not None else ingest.RAW_DIR
    path = data_dir / DOH_FILE
    if not path.exists():
        raise FileNotFoundError(f"{path} missing; place the DOH line-list in data/raw/.")
    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]
    col_map = {
        "Year": "year",
        _WEEK_COL: "morbidity_week",
        "Province": "province",
        "Age Group": "age_group",
        "Sex": "sex",
        "Clinical Classification": "clinical_classification",
        "Final Case Classification": "final_case_classification",
        "Admitted": "admitted",
        _CASE_COL: "cases",
        _DEATH_COL: "deaths",
    }
    df = df.rename(columns=col_map)
    df = df[list(col_map.values()) + ["Region"]].rename(columns={"Region": "region_label"})
    df["region"] = df["region_label"].map(REGION_LABELS)
    unmapped = sorted(df.loc[df["region"].isna(), "region_label"].unique())
    if unmapped:
        raise ValueError(f"Unmapped DOH region labels: {unmapped}; extend REGION_LABELS.")
    df["admitted"] = df["admitted"].map({"Y": True, "N": False}).fillna(False)
    df["cases"] = pd.to_numeric(df["cases"], errors="coerce").clip(lower=0).fillna(0).astype(int)
    df["deaths"] = pd.to_numeric(df["deaths"], errors="coerce").clip(lower=0).fillna(0).astype(int)
    df["year"] = pd.to_numeric(df["year"], errors="coerce").astype("Int64")
    df["morbidity_week"] = pd.to_numeric(df["morbidity_week"], errors="coerce").astype("Int64")
    df["month"] = _epi_week_month(df["year"], df["morbidity_week"]).dt.month.astype(int)
    df = df.drop(columns=["region_label"])
    return df[["year", "morbidity_week", "month", "region", "province", "age_group", "sex",
               "clinical_classification", "final_case_classification", "admitted",
               "cases", "deaths"]]


def build_regional():
    """Monthly per-region case/death totals over the 2019-01..2026-08 grid."""
    regional = load_regional_raw()
    return ingest.to_monthly(regional, fill_missing="zero")


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
    print(f"\nRecords available in raw line-list: {len(load_case_records())}")