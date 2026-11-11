"""Single source of truth for computation bounds and disease registry across the pipeline.

All modelling is restricted to the 2019-2026 calendar. The FWD line-lists
open earlier (2018-01) while the dengue line-list opens 2019-01, so the
ingest filters pre-2019 rows once at the raw-file boundary (see
fwbd_ingest/doh_eb_ingest/ili_ingest) and every shared loader re-asserts the lower
boundary so no pre-2019 row can reach a computation. The reported window
is also capped at the last COMPLETE month (DATA_END): the four FWD
line-lists carry an in-progress snapshot of the current month (2026-09)
that must never be served as a full reported month, so the API hot-load
trims observations after DATA_END. This module is the only place that
defines these constants — modules import them, never hardcode years.
"""

import pandas as pd

DATA_START_YEAR = 2019
DATA_END_YEAR = 2026
DATA_END_MONTH = 8  # last complete reported month (2026-09 is in-progress)
DATA_START = pd.Timestamp(f"{DATA_START_YEAR}-01-01")

# Single source of truth for all diseases known to HealthWatch.
# Distinguishes forecast-ready production series from historical-only
# and reference-only datasets.
DISEASE_METADATA = {
    "Dengue": {
        "id": "Dengue",
        "name": "Dengue",
        "short_name": "Dengue",
        "group": "Dengue",
        "category": "Vector-Borne",
        "status": "forecast_ready",
        "forecast_available": True,
        "last_reported_month": "2026-08",
        "source": "DOH-EB Dengue Line List (2019-2026)",
        "driver": "Aedes vector density after sustained rainfall",
    },
    "Acute Bloody Diarrhea": {
        "id": "Acute Bloody Diarrhea",
        "name": "Acute Bloody Diarrhea",
        "short_name": "ABD",
        "group": "Food and Waterborne Diseases",
        "category": "Food-Borne",
        "status": "forecast_ready",
        "forecast_available": True,
        "last_reported_month": "2026-08",
        "source": "DOH-EB FWBD Line List (2018-2026)",
        "driver": "Bacterial/amoebic food and water contamination",
    },
    "Cholera": {
        "id": "Cholera",
        "name": "Cholera",
        "short_name": "Cholera",
        "group": "Food and Waterborne Diseases",
        "category": "Water-Borne",
        "status": "forecast_ready",
        "forecast_available": True,
        "last_reported_month": "2026-08",
        "source": "DOH-EB FWBD Line List (2018-2026)",
        "driver": "Vibrio cholerae water contamination and flooding",
    },
    "Typhoid Fever": {
        "id": "Typhoid Fever",
        "name": "Typhoid Fever",
        "short_name": "Typhoid",
        "group": "Food and Waterborne Diseases",
        "category": "Food-Borne",
        "status": "forecast_ready",
        "forecast_available": True,
        "last_reported_month": "2026-08",
        "source": "DOH-EB FWBD Line List (2018-2026)",
        "driver": "Salmonella typhi food/water transmission",
    },
    "Acute Viral Hepatitis": {
        "id": "Acute Viral Hepatitis",
        "name": "Acute Viral Hepatitis",
        "short_name": "Hep A",
        "group": "Food and Waterborne Diseases",
        "category": "Food-Borne",
        "status": "forecast_ready",
        "forecast_available": True,
        "last_reported_month": "2025-09",
        "source": "DOH-EB FWBD Line List (2018-2026)",
        "driver": "Hepatitis A/E ingestion via contaminated food/water",
    },
    "Leptospirosis": {
        "id": "Leptospirosis",
        "name": "Leptospirosis",
        "short_name": "Lepto",
        "group": "Zoonotic Diseases",
        "category": "Water-Contaminated / Zoonotic",
        "status": "historical_only",
        "forecast_available": False,
        "unavailable_reason": "Forecast unavailable — pending comparative model evaluation and schema confirmation.",
        "last_reported_month": "2026-08",
        "source": "DOH PIDSR Leptospirosis Surveillance (2019-2026)",
        "driver": "Leptospira exposure in floodwater and rodent vectors",
    },
    "Influenza-like Illness": {
        "id": "Influenza-like Illness",
        "name": "Influenza-like Illness",
        "short_name": "ILI",
        "group": "Respiratory Diseases",
        "category": "Airborne / Droplet",
        "status": "historical_only",
        "forecast_available": False,
        "unavailable_reason": "Forecast unavailable — pending comparative model evaluation.",
        "last_reported_month": "2026-08",
        "source": "DOH PIDSR ILI Surveillance (2018-2026)",
        "driver": "Seasonal respiratory virus circulation and monsoon cooling",
    },
    "Heat-Related Illness": {
        "id": "Heat-Related Illness",
        "name": "Heat-Related Illness",
        "short_name": "Heat Illness",
        "group": "Environmental and Climate Hazards",
        "category": "Thermal / Extreme Weather",
        "status": "reference_only",
        "forecast_available": False,
        "unavailable_reason": "Forecast unavailable — heat-related illness data is limited to annual event aggregates and lacks continuous monthly surveillance time series.",
        "last_reported_month": "2026",
        "source": "DOH Heat-Related Events Report (2019, 2023-2026)",
        "driver": "Extreme ambient temperatures and dangerous heat index levels",
    },
}

SUPPORTED_DISEASES = list(DISEASE_METADATA.keys())
FORECAST_READY_DISEASES = [d for d, m in DISEASE_METADATA.items() if m["forecast_available"]]
DISEASE_GROUPS = {d: m["group"] for d, m in DISEASE_METADATA.items()}


def at_or_after_data_start(df, date_col="date"):
    """Drop rows before DATA_START (applied once, at ingest)."""
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    return out[out[date_col] >= DATA_START].reset_index(drop=True)


def at_or_before_data_end(df, year_col="year", month_col="month"):
    """Drop rows after the last complete reported month.

    The FWD line-lists include a partial, in-progress snapshot of the
    current month (2026-09); treating it as a full reported month would
    leak an incomplete count onto the slider/snapshot. Applied at the API
    hot-load only (the pipeline still fits on its full window).
    """
    out = df.copy()
    end_ym = DATA_END_YEAR * 100 + DATA_END_MONTH
    out["_ym"] = out[year_col] * 100 + out[month_col]
    out = out[out["_ym"] <= end_ym].drop(columns="_ym").reset_index(drop=True)
    return out


def assert_data_window(df, date_col="date", context=""):
    """Fail loudly if any row predates DATA_START.

    Defensive chokepoint: computes must never silently shrink to a partial
    calendar, so a pre-2019 row reaching a shared loader is an error, not a
    trimmed series.
    """
    out = df.copy()
    out[date_col] = pd.to_datetime(out[date_col])
    pre = (out[date_col] < DATA_START).sum()
    if pre:
        raise ValueError(
            f"{context}{pre} row(s) before DATA_START_YEAR={DATA_START_YEAR} "
            f"reached computation (min {out.loc[out[date_col] < DATA_START, date_col].min().date()})"
        )
    return out
