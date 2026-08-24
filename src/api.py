import json
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


def _confidence(mape, skill_vs_naive, folds):
    """Calibrated on data/processed/validation_metrics.csv.

    Raw MAPE alone is misleading for low-incidence weekly counts: a forecast
    of 4 against an actual of 1 reads as 300% error, so near-zero weeks push
    regional MAPE into triple digits even when the model beats its baseline.
    Skill vs the seasonal-naive baseline is a ratio of two errors and stays
    meaningful, so it drives the tiers:
      High     - clearly beats the naive baseline (skill >= 15%) with MAPE <= 100%
      Low      - fails to beat the naive baseline (skill <= 0%)
      Moderate - everything in between
    """
    if skill_vs_naive >= 15 and mape <= 100:
        return {
            "label": "High confidence",
            "tone": "low",
            "note": f"Beats the seasonal-naive baseline by {skill_vs_naive:.0f}% across {folds} walk-forward weeks - the seasonal signal is stable enough to plan against.",
        }
    if skill_vs_naive <= 0:
        return {
            "label": "Low confidence - volatile series",
            "tone": "high",
            "note": f"Does not beat the seasonal-naive baseline ({skill_vs_naive:+.0f}% skill) over {folds} walk-forward weeks: week-to-week case counts swing more than the seasonal signal explains. Treat the point forecast as a range, not a target.",
        }
    return {
        "label": "Moderate confidence",
        "tone": "moderate",
        "note": f"Beats the naive baseline by {skill_vs_naive:+.0f}% (MAPE {mape:.0f}%, inflated by near-zero weeks) over {folds} walk-forward weeks. Direction of change is reliable; exact case volume is not.",
    }


# Objective 5 interpretability: the LLM is strictly a narration layer over
# already-computed pipeline outputs (_FORECASTS/_CLASSIFICATION/_THRESHOLDS/
# _METRICS). It never generates forecasts, tiers, or numbers of its own.
_ANALYSIS_SYSTEM_PROMPT = (
    "You are the narrative layer for HEALTHWATCH, a dengue outbreak "
    "decision-support dashboard used by Philippine local government and "
    "health officers. You receive one JSON object of pipeline-computed "
    "numbers for one region: latest observed weekly cases, the model's "
    "point forecast with its interval, the percentile-based hotspot "
    "classification (p50/p75 thresholds and risk tier), walk-forward "
    "validation accuracy, and a calibrated confidence label.\n"
    "Write 2-4 sentences of plain-language prose for a non-technical "
    "municipal/city health officer. Strict rules:\n"
    "- Use ONLY the numbers in the payload. Never invent or recompute a "
    "case count, percentage, threshold, or risk tier. If a number you would "
    "need is not in the payload, do not state it.\n"
    "- The forecast and risk tier were produced by HEALTHWATCH's statistical "
    "pipeline; you only explain them. Never imply you generated them.\n"
    "- Prefer plain phrasing ('forecast accuracy', 'expected range') over "
    "jargon (MAPE, RMSE, p50/p75).\n"
    "- When the confidence label is not High, surface that caveat rather "
    "than leading only with the headline number.\n"
    "- Output prose only: no markdown, headings, or bullet lists."
)


def _build_grounding(db_region, disease, window):
    """Assembles the structured payload the LLM narrates, from the same
    DataFrames /series, /risk-classification, /thresholds and /metrics read.
    Raises 404 when any required pipeline output is missing."""
    hist = _history(db_region)
    last_obs = hist.iloc[-1]

    fcst = _FORECASTS[
        (_FORECASTS["region"] == db_region) & (_FORECASTS["disease"] == disease)
    ].sort_values("target_date")
    if fcst.empty:
        raise HTTPException(status_code=404, detail=f"No forecast available for '{db_region}'")
    frow = fcst.iloc[0]

    cls = _CLASSIFICATION[
        (_CLASSIFICATION["region"] == db_region)
        & (_CLASSIFICATION["disease"] == disease)
    ].sort_values("date")
    crow = cls[cls["date"] == frow["target_date"]]
    if crow.empty:
        crow = cls.tail(1)
    if crow.empty:
        raise HTTPException(status_code=404, detail=f"No risk classification for '{db_region}'")
    crow = crow.iloc[0]

    trow = _THRESHOLDS[
        (_THRESHOLDS["region"] == db_region)
        & (_THRESHOLDS["disease"] == disease)
        & (_THRESHOLDS["iso_week"] == frow["target_date"].isocalendar().week)
    ]
    thresh = trow.iloc[0] if not trow.empty else None

    mrows = _METRICS[
        (_METRICS["region"] == db_region) & (_METRICS["disease"] == disease)
    ]
    primary = mrows[mrows["window"] == window]
    if primary.empty:
        raise HTTPException(status_code=404, detail=f"Window '{window}' not found")
    mrow = primary.iloc[0]

    return {
        "region": db_region,
        "disease": disease,
        "observed_through": {
            "week_label": _week_point(0, last_obs["date"], last_obs["cases"], False)["label"],
            "cases": int(last_obs["cases"]),
        },
        "forecast": {
            "target_date": frow["target_date"].date().isoformat(),
            "yhat": float(frow["yhat"]),
            "yhat_lower": float(frow["yhat_lower"]),
            "yhat_upper": float(frow["yhat_upper"]),
        },
        "classification": {
            "date": crow["date"].date().isoformat(),
            "yhat": float(crow["yhat"]),
            "p50": float(crow["p50"]),
            "p75": float(crow["p75"]),
            "risk_level": str(crow["risk_level"]),
        },
        "thresholds_for_iso_week": (
            {
                "iso_week": int(thresh["iso_week"]),
                "p50": float(thresh["p50"]),
                "p75": float(thresh["p75"]),
            }
            if thresh is not None
            else None
        ),
        "validation": {
            "window": window,
            "MAE": float(mrow["MAE"]),
            "RMSE": float(mrow["RMSE"]),
            "MAPE": float(mrow["MAPE"]),
            "weeks": int(mrow["weeks"]),
            "skill_vs_naive_pct": (
                None if pd.isna(mrow["skill_vs_naive_pct"]) else float(mrow["skill_vs_naive_pct"])
            ),
        },
        "confidence": _confidence(
            float(mrow["MAPE"]), float(mrow["skill_vs_naive_pct"]), int(mrow["weeks"])
        ),
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
            "objective_5_interpretability": "/analysis/{region} (opt-in LLM narrative over pipeline outputs)",
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
    confidence = _confidence(row["MAPE"], float(row["skill_vs_naive_pct"]), int(row["weeks"]))
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


@app.get("/analysis/{region}", tags=["objective_5_interpretability"])
def analysis(
    region: str,
    disease: str = Query(default=DISEASE_DEFAULT),
    window: str = Query(default=PRIMARY_WINDOW),
):
    """Opt-in AI-assisted narrative over already-computed pipeline outputs.

    The LLM only restates/explains the structured grounding payload; it never
    produces forecasts or risk tiers itself. Fails soft (503) when the
    Anthropic key is missing or the API errors so region pages stay usable.
    """
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    grounding = _build_grounding(db_region, disease, window)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: ANTHROPIC_API_KEY is not configured on the server.",
        )
    try:
        import anthropic
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: anthropic package not installed.",
        )

    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    user_prompt = (
        "Explain this HEALTHWATCH region assessment in 2-4 plain-language "
        "sentences for a local health officer. Ground every number in this "
        "JSON:\n" + json.dumps(grounding)
    )
    try:
        client = anthropic.Anthropic(api_key=api_key, timeout=30.0, max_retries=0)
        message = client.messages.create(
            model=model,
            max_tokens=400,
            system=_ANALYSIS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        narrative = "".join(
            block.text for block in message.content if getattr(block, "type", "") == "text"
        ).strip()
    except Exception as exc:  # timeout, rate limit, auth, bad model id…
        raise HTTPException(
            status_code=503,
            detail=f"AI-assisted analysis failed: {type(exc).__name__}",
        )
    if not narrative:
        raise HTTPException(status_code=503, detail="AI-assisted analysis returned no text.")

    return {
        "region": region,
        "disease": disease,
        "narrative": narrative,
        "grounding_data": grounding,
        "model": model,
    }
