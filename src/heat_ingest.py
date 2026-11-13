"""Reference ingestion for Heat-Related Illness events.

Source: DOH Heat-Related Events Report (data/raw/new_diseases/Heat-Related.pdf),
Table 1, pages 2-3 (43 rows, 113 events across 13 regions, 2019 and 2023-2026).

Notice:
  This dataset contains annual reference aggregates only (no monthly or weekly
  epidemiological time series). In compliance with the HealthWatch thesis scope
  and evaluation guidelines, this dataset is labeled reference-only, and
  forecasting / time-series risk tiers are marked explicitly UNAVAILABLE.
"""

from pathlib import Path
import pandas as pd

from . import ingest

HEAT_AUDIT_CSV = "data/audit/heat_events.csv"
DISEASE = "Heat-Related Illness"

REGION_NORMALIZATION = {
    "I": "Ilocos Region",
    "III": "Central Luzon",
    "IV-A": "CALABARZON",
    "IV-B": "MIMAROPA",
    "V": "Bicol Region",
    "VI": "Western Visayas",
    "VII": "Central Visayas",
    "VIII": "Eastern Visayas",
    "IX": "Zamboanga Peninsula",
    "XI": "Davao Region",
    "XII": "SOCCSKSARGEN",
    "NIR": "Negros Island Region",
    "BARMM": "Bangsamoro (BARMM)",
    "CAR": "Cordillera Administrative Region",
    "Caraga": "Caraga",
    "Central Luzon": "Central Luzon",
    "Central Visayas": "Central Visayas",
    "Davao Region": "Davao Region",
    "Eastern Visayas": "Eastern Visayas",
    "Ilocos Region": "Ilocos Region",
    "NCR": "National Capital Region",
    "Northern Mindanao": "Northern Mindanao",
    "SOCCSKSARGEN": "SOCCSKSARGEN",
    "Western Visayas": "Western Visayas",
    "Zamboanga Peninsula": "Zamboanga Peninsula",
}


def normalize_heat(df):
    df=df.copy()
    df['canonical_region']=df.region.map(REGION_NORMALIZATION)
    if df.canonical_region.isna().any():
        raise ValueError('Unmapped heat source region: '+str(df.loc[df.canonical_region.isna(),'region'].unique()))
    return df


def process_heat(audit_path=None):
    audit_path = Path(audit_path) if audit_path else ingest.ROOT / HEAT_AUDIT_CSV
    if not audit_path.exists():
        raise FileNotFoundError(f"Heat events audit file not found: {audit_path}")

    df = pd.read_csv(audit_path)

    df = normalize_heat(df)
    df["disease"] = DISEASE
    df["forecast_available"] = False
    df["unavailable_reason"] = (
        "Forecast unavailable — heat-related illness data is limited to annual "
        "event aggregates and lacks continuous monthly surveillance time series."
    )

    out_path = ingest.PROCESSED_DIR / "heat_reference_events.csv"
    df.to_csv(out_path, index=False)

    print(f"Heat-related reference events processed: {len(df)} rows.")
    print(f"Total cases: {df['cases'].sum()}, total deaths: {df['deaths'].sum()}, total events: {df['events'].sum()}")
    return df


if __name__ == "__main__":
    process_heat()

