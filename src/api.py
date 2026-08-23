import os
from datetime import datetime, timezone

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import db, ingest

SUPPORTED_DISEASES = ["Dengue"]
DISEASE_DEFAULT = "Dengue"
PRIMARY_WINDOW = "pre_covid_52w"

WET_MONTHS = (6, 7, 8, 9, 10, 11)

REGION_META = [
    {"code": "130000000", "name": "National Capital Region", "short": "NCR", "island": "Luzon", "geoName": "Metropolitan Manila", "lat": 14.5995, "lng": 120.9842},
    {"code": "140000000", "name": "Cordillera Administrative Region", "short": "CAR", "island": "Luzon", "geoName": "Cordillera Administrative Region (CAR)", "lat": 17.35, "lng": 121.1},
    {"code": "010000000", "name": "Ilocos Region", "short": "Region I", "island": "Luzon", "geoName": "Ilocos Region (Region I)", "lat": 16.6, "lng": 120.45},
    {"code": "020000000", "name": "Cagayan Valley", "short": "Region II", "island": "Luzon", "geoName": "Cagayan Valley (Region II)", "lat": 17.0, "lng": 121.8},
    {"code": "030000000", "name": "Central Luzon", "short": "Region III", "island": "Luzon", "geoName": "Central Luzon (Region III)", "lat": 15.4, "lng": 120.7},
    {"code": "040000000", "name": "CALABARZON", "short": "Region IV-A", "island": "Luzon", "geoName": "CALABARZON (Region IV-A)", "lat": 14.1, "lng": 121.3},
    {"code": "170000000", "name": "MIMAROPA", "short": "Region IV-B", "island": "Luzon", "geoName": "MIMAROPA (Region IV-B)", "lat": 12.3, "lng": 120.9},
    {"code": "050000000", "name": "Bicol Region", "short": "Region V", "island": "Luzon", "geoName": "Bicol Region (Region V)", "lat": 13.4, "lng": 123.4},
    {"code": "060000000", "name": "Western Visayas", "short": "Region VI", "island": "Visayas", "geoName": "Western Visayas (Region VI)", "lat": 11.0, "lng": 122.6},
    {"code": "070000000", "name": "Central Visayas", "short": "Region VII", "island": "Visayas", "geoName": "Central Visayas (Region VII)", "lat": 10.0, "lng": 123.7},
    {"code": "080000000", "name": "Eastern Visayas", "short": "Region VIII", "island": "Visayas", "geoName": "Eastern Visayas (Region VIII)", "lat": 11.4, "lng": 125.0},
    {"code": "090000000", "name": "Zamboanga Peninsula", "short": "Region IX", "island": "Mindanao", "geoName": "Zamboanga Peninsula (Region IX)", "lat": 8.0, "lng": 122.9},
    {"code": "100000000", "name": "Northern Mindanao", "short": "Region X", "island": "Mindanao", "geoName": "Northern Mindanao (Region X)", "lat": 8.3, "lng": 124.7},
    {"code": "110000000", "name": "Davao Region", "short": "Region XI", "island": "Mindanao", "geoName": "Davao Region (Region XI)", "lat": 7.1, "lng": 125.6},
    {"code": "120000000", "name": "SOCCSKSARGEN", "short": "Region XII", "island": "Mindanao", "geoName": "SOCCSKSARGEN (Region XII)", "lat": 6.5, "lng": 124.9},
    {"code": "160000000", "name": "Caraga", "short": "Region XIII", "island": "Mindanao", "geoName": "Caraga (Region XIII)", "lat": 8.9, "lng": 125.7},
    {"code": "150000000", "name": "Bangsamoro (BARMM)", "short": "BARMM", "island": "Mindanao", "geoName": "Autonomous Region of Muslim Mindanao (ARMM)", "lat": 7.2, "lng": 124.2},
]

_NATIONAL = db.read_table("weekly_cases_national")
_REGIONAL = db.read_table("weekly_cases_regional")
_FORECASTS = db.read_table("forecasts")
_CLASSIFICATION = db.read_table("risk_classification")
_THRESHOLDS = db.read_table("risk_thresholds")
_METRICS = db.read_table("validation_metrics")

for _df, _col in (
    (_NATIONAL, "date"),
    (_REGIONAL, "date"),
    (_FORECASTS, "target_date"),
    (_CLASSIFICATION, "date"),
):
    _df[_col] = pd.to_datetime(_df[_col])


def _build_region_aliases():
    """Maps case-insensitive identifiers (API short names and raw pipeline
    labels like 'Region IV-A (CALABARZON)') onto the labels stored in the DB."""
    aliases = {"national": "National"}
    labels = (
        set(_REGIONAL["region"].unique())
        | set(_NATIONAL["region"].unique())
        | set(_FORECASTS["region"].unique())
        | set(_METRICS["region"].unique())
    )
    for label in labels:
        aliases[label.strip().lower()] = label
        aliases[label.split(" (")[0].strip().lower()] = label
    # Fallback for shorts whose DB label shares no prefix (e.g. 'Region XIII' -> 'Caraga').
    for meta in REGION_META:
        short_key = meta["short"].strip().lower()
        if short_key in aliases:
            continue
        for candidate in (meta["name"], meta["geoName"], meta["name"].replace(" (BARMM)", "")):
            hit = aliases.get(candidate.strip().lower())
            if hit is not None and hit != "National":
                aliases[short_key] = hit
                break
    return aliases


_DB_REGION_ALIASES = _build_region_aliases()


def _resolve_region(region):
    """Returns the DB-stored label for a region identifier, or None."""
    return _DB_REGION_ALIASES.get(region.strip().lower())


def _season(dt):
    return "wet" if dt.month in WET_MONTHS else "dry"


def _week_point(i, dt, cases, forecast, lower=None, upper=None):
    iso = dt.isocalendar()
    c = int(round(float(cases)))
    return {
        "index": i,
        "year": int(dt.year),
        "week": int(iso.week),
        "label": f"{dt.year}-W{int(iso.week):02d}",
        "date": dt.date().isoformat(),
        "season": _season(dt),
        "forecast": forecast,
        "cases": c,
        "lower": int(round(float(lower))) if lower is not None else c,
        "upper": int(round(float(upper))) if upper is not None else c,
        "raw": c,
        "adjusted": False,
    }


def _check_disease(disease):
    if disease not in SUPPORTED_DISEASES:
        raise HTTPException(
            status_code=404,
            detail=f"Disease '{disease}' not available yet. Supported: {SUPPORTED_DISEASES}",
        )


def _history(region):
    source = _NATIONAL if region == "National" else _REGIONAL
    out = source[source["region"] == region].sort_values("date")
    if out.empty:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    return out


def _confidence(mape, folds):
    if mape < 15:
        return {
            "label": "High confidence",
            "tone": "low",
            "note": f"MAPE under 15% across {folds} walk-forward weeks - the seasonal signal is stable enough to plan against.",
        }
    if mape < 30:
        return {
            "label": "Moderate confidence - limited historical data",
            "tone": "moderate",
            "note": f"MAPE between 15% and 30% across {folds} walk-forward weeks. Direction of change is reliable; exact case volume is not.",
        }
    return {
        "label": "Low confidence - volatile series",
        "tone": "high",
        "note": f"MAPE above 30% across {folds} walk-forward weeks: week-to-week case counts swing more than the seasonal signal explains. Treat the point forecast as a range, not a target.",
    }


app = FastAPI(
    title="HEALTHWATCH API",
    description=(
        "Regional time-series analysis system for seasonal illness outbreak "
        "prediction and hotspot classification. Endpoints are tagged by which "
        "study objective they serve."
    ),
    version="0.1.0",
)

_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", tags=["info"])
def root():
    return {
        "system": "HEALTHWATCH",
        "description": "Seasonal illness outbreak forecasting and hotspot classification (Dengue pilot)",
        "objectives_endpoints": {
            "objective_1_seasonal_patterns": "/series/{region}",
            "objective_2_forecast": "/series/{region} (forecast points) and /forecast/{disease}",
            "objective_3_hotspot_classification": "/risk-classification/{disease} and /thresholds/{disease}",
            "objective_4_dashboard_comparison": "/regions and /metrics/{region}",
            "objective_5_domain_rules": "non-negativity clipping and wet/dry season regressor applied in pipeline; see /metrics for validation",
        },
        "supported_diseases": SUPPORTED_DISEASES,
    }


@app.get("/regions", tags=["objective_4_dashboard"])
def regions():
    return REGION_META


@app.get("/status", tags=["objective_4_dashboard"])
def status():
    """Pipeline freshness: when outputs were generated and how far data reaches."""
    output_csvs = (
        ingest.PROCESSED_DIR / "forecasts.csv",
        ingest.PROCESSED_DIR / "risk_classification.csv",
        ingest.PROCESSED_DIR / "risk_thresholds.csv",
    )
    stamps = [p.stat().st_mtime for p in output_csvs if p.exists()]
    if not stamps:
        raise HTTPException(status_code=404, detail="No pipeline outputs found")
    generated = datetime.fromtimestamp(max(stamps), tz=timezone.utc)

    # The regional table defines what the dashboard plots (national runs later).
    last_date = _REGIONAL["date"].max()
    iso = last_date.isocalendar()
    return {
        "generated_at": generated.isoformat(),
        "data_through": {
            "date": last_date.date().isoformat(),
            "epi_week": f"{iso.year}-W{iso.week:02d}",
        },
        "supported_diseases": SUPPORTED_DISEASES,
    }


@app.get("/series/{region}", tags=["objective_1_patterns", "objective_2_forecast"])
def series(
    region: str,
    disease: str = Query(default=DISEASE_DEFAULT),
    include_forecast: bool = Query(default=True),
):
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    hist = _history(db_region)
    points = [
        _week_point(i, dt, cases, False)
        for i, (dt, cases) in enumerate(zip(hist["date"], hist["cases"]))
    ]
    if include_forecast:
        fcst = _FORECASTS[
            (_FORECASTS["region"] == db_region) & (_FORECASTS["disease"] == disease)
        ].sort_values("target_date")
        for k, row in enumerate(fcst.itertuples(index=False)):
            points.append(
                _week_point(
                    len(points),
                    row.target_date,
                    row.yhat,
                    True,
                    lower=row.yhat_lower,
                    upper=row.yhat_upper,
                )
            )
    return {"region": region, "disease": disease, "points": points}


@app.get("/forecast/{disease}", tags=["objective_2_forecast"])
def forecast(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _FORECASTS[_FORECASTS["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    df = df.sort_values(["region", "target_date"])
    df = df.assign(target_date=df["target_date"].dt.date.astype(str))
    return {"disease": disease, "region": region, "count": len(df), "items": df.to_dict(orient="records")}


@app.get("/risk-classification/{disease}", tags=["objective_3_classification"])
def risk_classification(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _CLASSIFICATION[_CLASSIFICATION["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    df = df.sort_values(["region", "date"])
    df = df.assign(date=df["date"].dt.date.astype(str))
    return {"disease": disease, "region": region, "count": len(df), "items": df.to_dict(orient="records")}


@app.get("/thresholds/{disease}", tags=["objective_3_classification"])
def thresholds(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _THRESHOLDS[_THRESHOLDS["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    return {"disease": disease, "region": region, "items": df.to_dict(orient="records")}


@app.get("/metrics/{region}", tags=["objective_4_dashboard"])
def metrics(
    region: str,
    disease: str = Query(default=DISEASE_DEFAULT),
    window: str = Query(default=PRIMARY_WINDOW),
):
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    rows = _METRICS[(_METRICS["region"] == db_region) & (_METRICS["disease"] == disease)]
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No validation metrics for '{region}'")
    items = rows.to_dict(orient="records")
    primary = rows[rows["window"] == window]
    if primary.empty:
        raise HTTPException(status_code=404, detail=f"Window '{window}' not found")
    row = primary.iloc[0]
    confidence = _confidence(row["MAPE"], int(row["weeks"]))
    return {
        "region": region,
        "disease": disease,
        "windows": items,
        "primary_window": window,
        "mae": float(row["MAE"]),
        "rmse": float(row["RMSE"]),
        "mape": float(row["MAPE"]),
        "skill_vs_naive_pct": None if pd.isna(row["skill_vs_naive_pct"]) else float(row["skill_vs_naive_pct"]),
        "confidence": confidence,
    }
