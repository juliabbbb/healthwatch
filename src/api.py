import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import db, email_report, ingest, subscription_store

SUPPORTED_DISEASES = ["Dengue"]
DISEASE_DEFAULT = "Dengue"
PRIMARY_WINDOW = "last_12m"

WET_MONTHS = (6, 7, 8, 9, 10, 11)

REGION_META = db.REGION_META
NAME_BY_CODE = {
    r["code"]: r["name"]
    for r in REGION_META
} | {db.NATIONAL_CODE: db.NATIONAL_NAME}
SHORT_BY_CODE = {r["code"]: r["short"] for r in REGION_META}

_NATIONAL: pd.DataFrame = pd.DataFrame()
_REGIONAL: pd.DataFrame = pd.DataFrame()
_FORECASTS: pd.DataFrame = pd.DataFrame()
_CLASSIFICATION: pd.DataFrame = pd.DataFrame()
_THRESHOLDS: pd.DataFrame = pd.DataFrame()
_METRICS: pd.DataFrame = pd.DataFrame()
_OUTBREAKS: pd.DataFrame = pd.DataFrame()
_OUTBREAK_VALIDATION: pd.DataFrame = pd.DataFrame()
_data_ready = False


def _load_all_data() -> None:
    global _NATIONAL, _REGIONAL, _FORECASTS, _CLASSIFICATION  # noqa: PLW0603
    global _THRESHOLDS, _METRICS, _OUTBREAKS, _OUTBREAK_VALIDATION  # noqa: PLW0603
    global _data_ready  # noqa: PLW0603

    t0 = time.monotonic()
    obs = db.read_table("monthly_observations")
    _NATIONAL = obs[obs["region_code"] == db.NATIONAL_CODE]
    _REGIONAL = obs[obs["region_code"] != db.NATIONAL_CODE]
    _FORECASTS = db.read_table("forecasts")
    _CLASSIFICATION = db.read_table("risk_classifications")
    _THRESHOLDS = db.read_table("risk_thresholds")
    _METRICS = db.read_table("validation_metrics")
    _OUTBREAKS = db.read_table("outbreak_signals")
    csv_path = ingest.PROCESSED_DIR / "outbreak_validation_2025.csv"
    _OUTBREAK_VALIDATION = pd.read_csv(csv_path) if csv_path.exists() else pd.DataFrame()

    for _df in (_NATIONAL, _REGIONAL):
        _df["date"] = pd.to_datetime(
            _df["year"].astype(str) + "-" + _df["month"].astype(str).str.zfill(2) + "-01"
        )
    for _df, _col in (
        (_FORECASTS, "target_date"),
        (_CLASSIFICATION, "date"),
    ):
        _df[_col] = pd.to_datetime(_df[_col])

    _data_ready = True
    print(f"Backend data loaded in {time.monotonic() - t0:.1f}s")


def _region_code_or_none(label):
    if label.strip().lower() == db.NATIONAL_NAME.lower():
        return db.NATIONAL_CODE
    for meta in REGION_META:
        for cand in (meta["name"], meta["short"], meta["geoName"]):
            if cand.strip().lower() == label.strip().lower():
                return meta["code"]
    return None


def _resolve_region(region):
    return _region_code_or_none(region)


def _label(code):
    return NAME_BY_CODE.get(code, code)


def _season(dt):
    return "wet" if dt.month in WET_MONTHS else "dry"


def _month_point(i, dt, cases, forecast, lower=None, upper=None):
    c = int(round(float(cases)))
    return {
        "index": i,
        "year": int(dt.year),
        "month": int(dt.month),
        "label": f"{dt.year}-{int(dt.month):02d}",
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


def _history(region_code):
    source = _NATIONAL if region_code == db.NATIONAL_CODE else _REGIONAL
    out = source[source["region_code"] == region_code].sort_values("date")
    if out.empty:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region_code}'")
    return out


def _confidence(mape, skill_vs_naive, months):
    """Calibrated on data/processed/validation_metrics.csv.

    Raw MAPE alone is misleading for low-incidence counts: a forecast of 4
    against an actual of 1 reads as 300% error, so near-zero months push
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
            "note": f"Beats the seasonal-naive baseline by {skill_vs_naive:.0f}% across {months} walk-forward months - the seasonal signal is stable enough to plan against.",
        }
    if skill_vs_naive <= 0:
        return {
            "label": "Low confidence - volatile series",
            "tone": "high",
            "note": f"Does not beat the seasonal-naive baseline ({skill_vs_naive:+.0f}% skill) over {months} walk-forward months: month-to-month case counts swing more than the seasonal signal explains. Treat the point forecast as a range, not a target.",
        }
    return {
        "label": "Moderate confidence",
        "tone": "moderate",
        "note": f"Beats the naive baseline by {skill_vs_naive:+.0f}% (MAPE {mape:.0f}%, inflated by near-zero months) over {months} walk-forward months. Direction of change is reliable; exact case volume is not.",
    }


# Objective 5 interpretability: the LLM is strictly a narration layer over
# already-computed pipeline outputs (_FORECASTS/_CLASSIFICATION/_THRESHOLDS/
# _METRICS). It never generates forecasts, tiers, or numbers of its own.
_PLAIN_LANGUAGE_RULES = (
    "AUDIENCE: anyone — a barangay health worker, a town official, or a "
    "resident with NO statistics training. Explain like you are talking to "
    "a neighbour.\n"
    "STRICT VOCABULARY RULES — never print any of these words or anything "
    "similar: pipeline, series, index, payload, JSON, ACF, autocorrelation, "
    "lag, decomposition, residual, variance, percentile, threshold, MAPE, "
    "RMSE, confidence interval, statistical, model, data point. Also never "
    "print raw field names such as change_pct_2y, latest_index, peak_month, "
    "strength_pct.\n"
    "SAY IT IN EVERYDAY WORDS instead:\n"
    "- trend change -> 'compared with two years ago, cases have fallen "
    "sharply'\n"
    "- seasonal strength -> 'cases rise and fall in a steady yearly "
    "rhythm'\n"
    "- wet vs dry season -> 'the rainy months (June to November)' vs 'the "
    "drier months'\n"
    "- forecast accuracy/confidence -> 'this outlook is usually close to "
    "what really happens' or 'this outlook is less certain than usual'\n"
    "- risk tier -> 'the alert level for dengue is high/low'\n"
    "NUMBER RULES: round naturally ('about 90% lower', 'around 600 cases a "
    "month'). Always attach meaning ('roughly a tenth of what it was'). Name "
    "MONTHS, never month numbers ('around September', never 'month 9').\n"
    "SHAPE RULES: open with the single most important message in the first "
    "sentence. End with one short practical takeaway for the community when "
    "it fits. Keep every sentence under about 18 words.\n"
    "FORMAT RULES: plain sentences only. No markdown, no bullet points, no "
    "headings, no asterisks, no quotes around terms, no parenthesised field "
    "names. Do not mention HEALTHWATCH systems, pipelines, models, or where "
    "the numbers came from — just talk about dengue in the region.\n"
    "TRUTH RULES: use ONLY the numbers provided below. Never invent, round-"
    "up, or recompute any figure. If something is missing, simply do not "
    "mention it."
)

_ANALYSIS_SYSTEM_PROMPT = (
    "You write short plain-language explanations of dengue numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + _PLAIN_LANGUAGE_RULES
    + "\nTASK: using the JSON figures, write 3-4 sentences covering: (1) how "
    "many dengue cases are happening now, in everyday terms; (2) what is "
    "expected in the coming months, including the honest range if given; (3) "
    "the current alert level in plain words, with a caution note only if the "
    "outlook is flagged as uncertain; (4) one practical thing the community "
    "can focus on now."
)


def _build_grounding(db_region, disease, window):
    """Assembles the structured payload the LLM narrates, from the same
    DataFrames /series, /risk-classification, /thresholds and /metrics read.
    Raises 404 when any required pipeline output is missing."""
    hist = _history(db_region)
    last_obs = hist.iloc[-1]

    fcst = _FORECASTS[
        (_FORECASTS["region_code"] == db_region) & (_FORECASTS["disease"] == disease)
    ].sort_values("target_date")
    if fcst.empty:
        raise HTTPException(status_code=404, detail=f"No forecast available for '{db_region}'")
    frow = fcst.iloc[0]

    cls = _CLASSIFICATION[
        (_CLASSIFICATION["region_code"] == db_region)
        & (_CLASSIFICATION["disease"] == disease)
    ].sort_values("date")
    crow = cls[cls["date"] == frow["target_date"]]
    if crow.empty:
        crow = cls.tail(1)
    if crow.empty:
        raise HTTPException(status_code=404, detail=f"No risk classification for '{db_region}'")
    crow = crow.iloc[0]

    trow = _THRESHOLDS[
        (_THRESHOLDS["region_code"] == db_region)
        & (_THRESHOLDS["disease"] == disease)
        & (_THRESHOLDS["month"] == int(frow["target_date"].month))
    ]
    thresh = trow.iloc[0] if not trow.empty else None

    mrows = _METRICS[
        (_METRICS["region_code"] == db_region) & (_METRICS["disease"] == disease)
    ]
    primary = mrows[mrows["window"] == window]
    if primary.empty:
        raise HTTPException(status_code=404, detail=f"Window '{window}' not found")
    mrow = primary.iloc[0]

    return {
        "region": _label(db_region),
        "disease": disease,
        "observed_through": {
            "month_label": _month_point(0, last_obs["date"], last_obs["cases"], False)["label"],
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
        "thresholds_for_month": (
            {
                "month": int(thresh["month"]),
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
            "months": int(mrow["months"]),
            "skill_vs_naive_pct": (
                None if pd.isna(mrow["skill_vs_naive_pct"]) else float(mrow["skill_vs_naive_pct"])
            ),
        },
        "confidence": _confidence(
            float(mrow["MAPE"]), float(mrow["skill_vs_naive_pct"]), int(mrow["months"])
        ),
    }


_MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _month_label(m):
    return _MONTH_LABELS[min(11, max(0, int(m) - 1))]


def _variance(values):
    mean = sum(values) / len(values)
    return sum((v - mean) ** 2 for v in values) / len(values)


def _seasonality_grounding(db_region):
    """Deterministic server-side port of the Seasonality page's decomposition
    (frontend data.ts `decompose()`/`acf()`): centred ±6-month moving-average
    trend, month-of-year seasonal index, residual noise and autocorrelation.
    Computed from the already-loaded history tables only — the LLM narrates
    these numbers, it never derives its own."""

    hist = _history(db_region)
    dates = list(hist["date"])
    values = [float(c) for c in hist["cases"]]
    n = len(values)

    half = 6
    trend_pts = []
    for i in range(n):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        window = values[lo:hi]
        trend_pts.append(sum(window) / len(window))

    months = [d.month for d in dates]
    detrended = [v - t for v, t in zip(values, trend_pts)]
    buckets = [[] for _ in range(12)]
    for dval, m in zip(detrended, months):
        buckets[m - 1].append(dval)
    seasonal_idx = [(sum(b) / len(b)) if b else 0.0 for b in buckets]
    seas_pts = [seasonal_idx[m - 1] for m in months]
    resid_pts = [v - t - s for v, t, s in zip(values, trend_pts, seas_pts)]

    seas_var = _variance(seas_pts)
    resid_var = _variance(resid_pts)
    strength_pct = round(100 * seas_var / ((seas_var + resid_var) or 1))

    mean = sum(values) / n
    denom = sum((v - mean) ** 2 for v in values) or 1
    acfs = {}
    for lag in range(1, 25):
        num = sum((values[i] - mean) * (values[i - lag] - mean) for i in range(lag, n))
        acfs[lag] = round(num / denom, 3)
    dominant_lag = max(acfs, key=lambda k: acfs[k])

    peak_month = max(range(12), key=lambda m: seasonal_idx[m]) + 1
    trough_month = min(range(12), key=lambda m: seasonal_idx[m]) + 1

    wet = [v for d, v in zip(dates, values) if d.month in WET_MONTHS]
    dry = [v for d, v in zip(dates, values) if d.month not in WET_MONTHS]

    trend_change = (
        round((trend_pts[-1] - trend_pts[n - 25]) / (trend_pts[n - 25] or 1) * 100)
        if n > 24
        else 0
    )

    return {
        "region": _label(db_region),
        "observed_months": n,
        "series_start": dates[0].date().isoformat(),
        "series_end": dates[-1].date().isoformat(),
        "trend": {"latest_index": round(trend_pts[-1]), "change_pct_2y": trend_change},
        "seasonal": {
            "peak_month": peak_month,
            "peak_label": _month_label(peak_month),
            "trough_month": trough_month,
            "trough_label": _month_label(trough_month),
            "strength_pct": strength_pct,
        },
        "cycle": {
            "acf_lag12": acfs.get(12, 0.0),
            "acf_lag6": acfs.get(6, 0.0),
            "dominant_lag_months": dominant_lag,
            "dominant_lag_acf": acfs[dominant_lag],
        },
        "wet_dry": {
            "wet_season_mean_cases": round(sum(wet) / len(wet), 1) if wet else None,
            "dry_season_mean_cases": round(sum(dry) / len(dry), 1) if dry else None,
        },
    }


# Objective 1/5 interpretability for the Seasonality page: same rules as the
# region forecast narration — pipeline numbers in, prose out, nothing invented.
_SEASONALITY_SYSTEM_PROMPT = (
    "You write short plain-language explanations of dengue numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + _PLAIN_LANGUAGE_RULES
    + "\nTASK: using the JSON figures, write 2-3 sentences about the yearly "
    "dengue pattern the user is looking at. Name months instead of month "
    "numbers whenever a number appears in the figures."
)

_SEASONALITY_FOCUS = {
    "observed": (
        "Focus on how many cases are happening now compared with two years "
        "ago and with what is usual for this region."
    ),
    "trend": (
        "Focus on the long-term direction across the years shown — whether "
        "dengue is rising, falling, or steady — and how big that change is."
    ),
    "seasonal": (
        "Focus on the yearly rhythm: which months cases usually rise to a "
        "peak and fall to a low, and how rainy months differ from dry ones."
    ),
    "residual": (
        "Focus on unusual months that jumped above or dropped below the normal "
        "pattern, and note that some up-and-down from month to month is normal."
    ),
    "acf": (
        "Focus on how reliably this pattern repeats every year — whether one "
        "year looks much like the last."
    ),
}


def _load_dotenv() -> None:
    """Populate os.environ from a repo-root .env file (KEY=VALUE lines).

    Existing environment variables always win, so a real shell/export still
    takes precedence. Keeps secrets out of the codebase (.env is
    git-ignored) and makes the backend independent of how it was launched."""
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip().lstrip("\ufeff")
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()


def _llm_narrate(system_prompt, user_prompt):
    """Shared constrained LLM call for interpretability endpoints.

    Uses Groq's Llama 3 70B (llama3-70b-8192 by default). Model is
    configurable via GROQ_MODEL env var. Requires GROQ_API_KEY (free at
    console.groq.com). Fails soft (503) on missing key or API errors so no
    dashboard view ever breaks because of the AI layer."""
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: set GROQ_API_KEY (free at "
            "console.groq.com) on the server.",
        )

    try:
        from groq import Groq
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: groq package not installed.",
        )

    GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama3-70b-8192")
    try:
        client = Groq(api_key=groq_key, timeout=30.0, max_retries=0)
        narrative = ""
        used_model = None
        for model in [GROQ_MODEL]:
            try:
                message = client.chat.completions.create(
                    model=model,
                    max_tokens=1024,
                    temperature=0.3,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                )
                narrative = (message.choices[0].message.content or "").strip()
                used_model = model
                break
            except Exception:  # timeout, rate limit, auth, bad model id…
                continue
    except Exception as exc:  # client construction or network errors
        raise HTTPException(
            status_code=503,
            detail=f"AI-assisted analysis failed: {type(exc).__name__}",
        )
    if not narrative:
        # Never let LLM failure crash the API response.
        raise HTTPException(
            status_code=503,
            detail="AI summary unavailable. Please refer to the forecast data directly.",
        )
    return narrative, used_model


@asynccontextmanager
async def lifespan(_app):
    _load_all_data()

    loop = asyncio.get_running_loop()
    scheduler_task = loop.create_task(_subscription_loop())
    try:
        yield
    finally:
        scheduler_task.cancel()


async def _subscription_loop() -> None:
    """Best-effort in-process scheduler for the monthly forecast emails.

    Runs a delivery pass every SUBSCRIPTION_SCHEDULER_INTERVAL_H hours (default
    6). On Render free tier the web process is the only always-on surface, so
    this doubles as the cron — uploads fine; for production-grade monthly
    timing, point an external job at POST /subscriptions/send-due instead.
    """
    if os.environ.get("DISABLE_SUBSCRIPTION_SCHEDULER", "").strip() == "1":
        return
    interval_h = float(os.environ.get("SUBSCRIPTION_SCHEDULER_INTERVAL_H", "6"))
    while True:
        try:
            if _data_ready:
                _send_due_subscriptions()
        except Exception as exc:  # noqa: BLE001
            print(f"[subscriptions] scheduler pass failed: {exc}", flush=True)
        await asyncio.sleep(interval_h * 3600)


class SubscribeRequest(BaseModel):
    email: str
    regions: list[str] = []
    illness: str = "all"


class PrefsRequest(BaseModel):
    regions: list[str] | None = None
    illness: str | None = None


_VALID_REGION_CODES = {r["code"] for r in db.REGION_META}


def _normalize_illness(value: str | None) -> str:
    illness = (value or "all").strip().lower()
    if illness not in ("all", "dengue"):
        raise HTTPException(status_code=422, detail="illness must be 'all' or 'dengue'")
    return illness


def _normalize_regions(codes: list[str]) -> list[str]:
    out: list[str] = []
    for code in codes or []:
        if code in _VALID_REGION_CODES and code not in out:
            out.append(code)
    return out


def _send_due_subscriptions() -> list[dict]:
    """Send the current month's report to every due subscription (idempotent
    per month). Returns one delivery record per recipient."""
    results: list[dict] = []
    for sub in subscription_store.list_active_due(email_report.month_key()):
        try:
            report = email_report.build_report(sub["regions"], sub["illness"])
            delivery = email_report.send_report(sub["email"], report, sub["token"])
            subscription_store.mark_sent(sub["token"], report["month_key"])
            print(
                f"[subscriptions] {report['month']} report (provider={delivery['provider']}) "
                f"→ {sub['email']}",
                flush=True,
            )
            results.append(delivery)
        except Exception as exc:  # noqa: BLE001
            print(f"[subscriptions] delivery failed for {sub['email']}: {exc}", flush=True)
    return results


app = FastAPI(
    title="HEALTHWATCH API",
    description=(
        "Regional time-series analysis system for seasonal illness outbreak "
        "prediction and hotspot classification. Endpoints are tagged by which "
        "study objective they serve."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^(http://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-z0-9-]+\.onrender\.com)$",
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
            "objective_5_interpretability": "/analysis/{region} and /analysis/seasonality (opt-in LLM narratives over pipeline outputs)",
        },
        "seasonal_outbreak_indicators": {
            "overview": "/outbreak",
            "region_detail": "/outbreak/{region}",
            "seasonal_thresholds": "/thresholds/seasonal",
            "prospective_validation_2025": "/validation/outbreak",
        },
        "supported_diseases": SUPPORTED_DISEASES,
    }


@app.get("/health", tags=["info"])
def health():
    """Lightweight health check — always 200 once the process is up, even
    while data is still loading. Render uses this to confirm the instance
    is alive during cold start."""
    return {"status": "ok", "data_ready": _data_ready}


@app.get("/dashboard", tags=["objective_4_dashboard"])
def dashboard(disease: str = Query(default=DISEASE_DEFAULT)):
    """Single batched endpoint returning all regions' series + metrics +
    outbreak data in one response. Replaces the 37 individual calls the
    frontend previously made on every page load."""
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Data still loading, retry shortly")
    _check_disease(disease)

    series_out = {}
    metrics_out = {}
    for region in REGION_META:
        code = region["code"]
        label = region["short"]
        # --- series ---
        hist = _REGIONAL[_REGIONAL["region_code"] == code].sort_values("date")
        points = [
            _month_point(i, dt, cases, False)
            for i, (dt, cases) in enumerate(zip(hist["date"], hist["cases"]))
        ]
        fcst = _FORECASTS[
            (_FORECASTS["region_code"] == code) & (_FORECASTS["disease"] == disease)
        ].sort_values("target_date")
        for k, row in enumerate(fcst.itertuples(index=False)):
            points.append(
                _month_point(
                    len(points),
                    row.target_date,
                    row.yhat,
                    True,
                    lower=row.yhat_lower,
                    upper=row.yhat_upper,
                )
            )
        series_out[label] = points
        # --- metrics ---
        rows = _METRICS[
            (_METRICS["region_code"] == code) & (_METRICS["disease"] == disease)
        ]
        primary = rows[rows["window"] == PRIMARY_WINDOW]
        if not primary.empty:
            row = primary.iloc[0]
            metrics_out[label] = {
                "region": region["name"],
                "mae": float(row["MAE"]),
                "rmse": float(row["RMSE"]),
                "mape": float(row["MAPE"]),
                "months": int(row["months"]),
                "skill_vs_naive_pct": (
                    None if pd.isna(row["skill_vs_naive_pct"]) else float(row["skill_vs_naive_pct"])
                ),
                "confidence": _confidence(
                    float(row["MAPE"]), float(row["skill_vs_naive_pct"]), int(row["months"])
                ),
                "windows": rows.assign(
                    region=rows["region_code"].map(lambda c: NAME_BY_CODE.get(c, c))
                ).drop(columns=["region_code"]).to_dict(orient="records"),
            }

    # --- outbreak ---
    outbreak_df = _OUTBREAKS.copy()
    outbreak_df = outbreak_df.assign(
        region=outbreak_df["region_code"].map(lambda c: NAME_BY_CODE.get(c, c))
    ).drop(columns=["region_code"])
    outbreak_items = outbreak_df.sort_values(["region", "season"]).to_dict(orient="records")

    return {
        "disease": disease,
        "series": series_out,
        "metrics": metrics_out,
        "outbreak": outbreak_items,
    }


@app.get("/regions", tags=["objective_4_dashboard"])
def regions():
    return REGION_META


@app.get("/status", tags=["objective_4_dashboard"])
def status():
    """Pipeline freshness: when outputs were generated and how far data reaches."""
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Data still loading, retry shortly")
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
    return {
        "generated_at": generated.isoformat(),
        "data_through": {
            "date": last_date.date().isoformat(),
            "month": f"{int(last_date.year)}-{int(last_date.month):02d}",
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
        _month_point(i, dt, cases, False)
        for i, (dt, cases) in enumerate(zip(hist["date"], hist["cases"]))
    ]
    if include_forecast:
        fcst = _FORECASTS[
            (_FORECASTS["region_code"] == db_region) & (_FORECASTS["disease"] == disease)
        ].sort_values("target_date")
        for k, row in enumerate(fcst.itertuples(index=False)):
            points.append(
                _month_point(
                    len(points),
                    row.target_date,
                    row.yhat,
                    True,
                    lower=row.yhat_lower,
                    upper=row.yhat_upper,
                )
            )
    return {"region": _label(db_region), "disease": disease, "points": points}


@app.get("/forecast/{disease}", tags=["objective_2_forecast"])
def forecast(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _FORECASTS[_FORECASTS["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region_code"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    df = df.sort_values(["region_code", "target_date"])
    df = df.assign(
        region=df["region_code"].map(_label),
        target_date=df["target_date"].dt.date.astype(str),
    ).drop(columns=["region_code"])
    return {"disease": disease, "region": region, "count": len(df), "items": df.to_dict(orient="records")}


@app.get("/risk-classification/{disease}", tags=["objective_3_classification"])
def risk_classification(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _CLASSIFICATION[_CLASSIFICATION["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region_code"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    df = df.sort_values(["region_code", "date"])
    df = df.assign(
        region=df["region_code"].map(_label),
        date=df["date"].dt.date.astype(str),
    ).drop(columns=["region_code"])
    return {"disease": disease, "region": region, "count": len(df), "items": df.to_dict(orient="records")}


@app.get("/thresholds/seasonal", tags=["objective_3_classification"])
def seasonal_thresholds(region: str | None = Query(default=None)):
    """Season-probe alert thresholds: long-run P75 of monthly case load within
    each season (dry/wet), per region, exactly as used by the outbreak flags."""
    df = _OUTBREAKS[["region_code", "disease", "season", "season_avg", "season_p75"]].copy()
    df = df.assign(region=df["region_code"].map(_label)).drop(columns=["region_code"])
    df = df.rename(columns={"season_avg": "forecast_avg"})
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == _label(db_region)]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    return {"items": df.to_dict(orient="records")}


@app.get("/thresholds/{disease}", tags=["objective_3_classification"])
def thresholds(disease: str, region: str | None = Query(default=None)):
    _check_disease(disease)
    df = _THRESHOLDS[_THRESHOLDS["disease"] == disease]
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region_code"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    df = df.assign(region=df["region_code"].map(_label)).drop(columns=["region_code"])
    return {"disease": disease, "region": region, "items": df.to_dict(orient="records")}


@app.get("/outbreak", tags=["objective_2_forecast"])
def outbreak_overview(
    region: str | None = Query(default=None),
    season: str | None = Query(default=None),
):
    """Region-season outbreak flags for the map/dashboard.

    Rule A: >=3 consecutive probe months forecast at High (above the month's
    P75). Rule B: the season's forecast average exceeds the season's long-run
    P75. Trigger reports which rule(s) fired."""
    df = _OUTBREAKS.copy()
    df = df.assign(region=df["region_code"].map(_label)).drop(columns=["region_code"])
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == _label(db_region)]
    if season:
        if season not in ("dry", "wet"):
            raise HTTPException(status_code=404, detail="season must be 'dry' or 'wet'")
        df = df[df["season"] == season]
    df = df.sort_values(["region", "season"])
    return {"season": season, "count": len(df), "items": df.to_dict(orient="records")}


@app.get("/outbreak/{region}", tags=["objective_2_forecast"])
def outbreak(region: str, disease: str = Query(default=DISEASE_DEFAULT)):
    """Per-region outbreak status for the current dry + wet season probes."""
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    rows = _OUTBREAKS[
        (_OUTBREAKS["region_code"] == db_region) & (_OUTBREAKS["disease"] == disease)
    ].sort_values("season")
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No outbreak indicators for '{region}'")
    rows = rows.assign(region=rows["region_code"].map(_label)).drop(columns=["region_code"])
    return {
        "region": _label(db_region),
        "disease": disease,
        "seasons": rows.to_dict(orient="records"),
    }


@app.get("/validation/outbreak", tags=["objective_3_classification"])
def outbreak_validation():
    """Prospective 2025 validation of the outbreak indicator.

    Compares the dry (Jan-Mar) and wet (Jul-Sep) 2025 season flags — forecasts
    fit with data through 2024-12-31 — against observed DOH-EB monthly data."""
    v = _OUTBREAK_VALIDATION
    if v.empty:
        raise HTTPException(status_code=404, detail="2025 outbreak validation not generated yet")
    overall = {
        "tp": int(v["tp"].sum()),
        "fp": int(v["fp"].sum()),
        "fn": int(v["fn"].sum()),
        "tn": int(v["tn"].sum()),
    }
    tp, fp, fn = overall["tp"], overall["fp"], overall["fn"]
    overall["precision"] = round(tp / (tp + fp), 3) if tp + fp else None
    overall["recall"] = round(tp / (tp + fn), 3) if tp + fn else None
    f1 = (
        2 * overall["precision"] * overall["recall"]
        / (overall["precision"] + overall["recall"])
        if overall["precision"] and overall["recall"]
        else None
    )
    overall["f1"] = round(f1, 3) if f1 else None

    by_season = {}
    for s in ("dry", "wet"):
        sub = v[v["season"] == s]
        stp, sfp, sfn = int(sub["tp"].sum()), int(sub["fp"].sum()), int(sub["fn"].sum())
        precision = stp / (stp + sfp) if stp + sfp else None
        recall = stp / (stp + sfn) if stp + sfn else None
        s_f1 = (
            2 * precision * recall / (precision + recall) if precision and recall else None
        )
        by_season[s] = {
            "tp": stp,
            "fp": sfp,
            "fn": sfn,
            "tn": int(sub["tn"].sum()),
            "precision": round(precision, 3) if precision else None,
            "recall": round(recall, 3) if recall else None,
            "f1": round(s_f1, 3) if s_f1 else None,
        }
    return {
        "scope": "2025 dry (Jan-Mar) + wet (Jul-Sep) season probes, forecast "
        "with data through 2024-12-31 and compared against observed DOH-EB 2025",
        "overall": overall,
        "by_season": by_season,
    }


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
    rows = _METRICS[(_METRICS["region_code"] == db_region) & (_METRICS["disease"] == disease)]
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No validation metrics for '{region}'")
    items = rows.assign(region=rows["region_code"].map(_label)).drop(columns=["region_code"]).to_dict(orient="records")
    primary = rows[rows["window"] == window]
    if primary.empty:
        raise HTTPException(status_code=404, detail=f"Window '{window}' not found")
    row = primary.iloc[0]
    confidence = _confidence(row["MAPE"], float(row["skill_vs_naive_pct"]), int(row["months"]))
    return {
        "region": _label(db_region),
        "disease": disease,
        "windows": items,
        "primary_window": window,
        "mae": float(row["MAE"]),
        "rmse": float(row["RMSE"]),
        "mape": float(row["MAPE"]),
        "skill_vs_naive_pct": None if pd.isna(row["skill_vs_naive_pct"]) else float(row["skill_vs_naive_pct"]),
        "confidence": confidence,
    }


@app.get("/analysis/seasonality", tags=["objective_1_patterns", "objective_5_interpretability"])
def analysis_seasonality(
    region: str = Query(...),
    disease: str = Query(default=DISEASE_DEFAULT),
    component: str = Query(default="seasonal"),
):
    """Opt-in AI narrative for Seasonality-page charts (right-click → explain).

    `component` selects which chart was clicked (observed/trend/seasonal/
    residual/acf); the payload always carries the full deterministic
    decomposition so the narrative stays grounded and auditable."""
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    allowed_components = ("observed", "trend", "seasonal", "residual", "acf")
    if component not in allowed_components:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown component '{component}'. Allowed: {list(allowed_components)}",
        )
    grounding = _seasonality_grounding(db_region)
    grounding["disease"] = disease

    user_prompt = (
        f"The user is looking at the '{component}' chart for this region. "
        f"{_SEASONALITY_FOCUS[component]} Figures you may use:\n"
        + json.dumps(grounding)
    )
    narrative, model = _llm_narrate(_SEASONALITY_SYSTEM_PROMPT, user_prompt)

    return {
        "region": _label(db_region),
        "disease": disease,
        "component": component,
        "narrative": narrative,
        "grounding_data": grounding,
        "model": model,
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
    API key is missing or the API errors so region pages stay usable."""
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    grounding = _build_grounding(db_region, disease, window)

    user_prompt = (
        "Explain the current dengue situation for this region. Figures you "
        "may use:\n" + json.dumps(grounding)
    )
    narrative, model = _llm_narrate(_ANALYSIS_SYSTEM_PROMPT, user_prompt)

    return {
        "region": _label(db_region),
        "disease": disease,
        "narrative": narrative,
        "grounding_data": grounding,
        "model": model,
    }


# ---------------------------------------------------------------------------
# Email subscription endpoints (anonymous, email-only, no login required)
# ---------------------------------------------------------------------------


@app.post("/subscriptions", tags=["subscriptions"])
def subscribe(payload: SubscribeRequest):
    """Subscribe an email to recurring monthly forecast reports.

    Existing matching by email: creates a new subscription on first use,
    reactivates + refreshes filters if previously unsubscribed, and refreshes
    filters for an active subscription (idempotent re-subscribe).

    The current month's report is rendered and delivered immediately, and the
    compiled report is returned for the in-app confirmation preview.
    """
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Data still loading, retry shortly")
    email = (payload.email or "").strip().lower()
    if not email_report.is_valid_email(email):
        raise HTTPException(status_code=422, detail="A valid email address is required")
    regions = _normalize_regions(payload.regions)
    illness = _normalize_illness(payload.illness)

    token = subscription_store.create_or_reactivate(email, regions, illness)
    report = email_report.build_report(regions, illness)
    delivery = email_report.send_report(email, report, token)
    # The immediate first report covers this month; the monthly job resumes
    # with the next month so subscribers don't receive the same report twice.
    subscription_store.mark_sent(token, report["month_key"])

    return {
        "status": "subscribed",
        "token": token,
        "email": email,
        "provider": delivery["provider"],
        "report": report,
    }


@app.get("/subscriptions/manage/{token}", tags=["subscriptions"])
def subscription_preferences(token: str):
    """Fetch the preferences behind a manage link (regions + illness + status)."""
    sub = subscription_store.get_by_token(token)
    if sub is None:
        raise HTTPException(status_code=404, detail="Unknown subscription token")
    return sub


@app.patch("/subscriptions/manage/{token}", tags=["subscriptions"])
def update_subscription_preferences(token: str, payload: PrefsRequest):
    """Update filters (regions / illness) and re-activate via a manage link."""
    if payload.regions is None and payload.illness is None:
        raise HTTPException(status_code=422, detail="Provide regions, illness, or both")
    existing = subscription_store.get_by_token(token)
    if existing is None:
        raise HTTPException(status_code=404, detail="Unknown subscription token")
    regions = (
        _normalize_regions(payload.regions)
        if payload.regions is not None
        else existing["regions"]
    )
    illness = (
        _normalize_illness(payload.illness)
        if payload.illness is not None
        else existing["illness"]
    )
    subscription_store.update_preferences(token, regions, illness)
    return subscription_store.get_by_token(token)


@app.delete("/subscriptions/manage/{token}", tags=["subscriptions"])
def unsubscribe(token: str):
    """One-click unsubscribe (deactivates the subscription permanently)."""
    if not subscription_store.deactivate(token):
        raise HTTPException(status_code=404, detail="Unknown subscription token")
    return {"status": "unsubscribed"}


@app.post("/subscriptions/send-due", tags=["subscriptions"])
def send_due_subscriptions(
    x_job_token: str | None = Header(default=None, alias="X-Job-Token"),
):
    """Send this month's report to every due subscription. Idempotent per month.

    Guarded by JOB_TOKEN when configured. On Render free tier there is no cron,
    so this endpoint is the external hook (e.g. cron-job.org hitting it once a
    month); the in-process scheduler calls the same delivery path internally.
    """
    expected = os.environ.get("JOB_TOKEN", "").strip()
    if expected and x_job_token != expected:
        raise HTTPException(status_code=403, detail="Bad or missing job token")
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Data still loading, retry shortly")
    results = _send_due_subscriptions()
    return {
        "sent": len(results),
        "due_remaining": len(subscription_store.list_active_due(email_report.month_key())),
        "records": [{"to": r.get("to"), "provider": r.get("provider")} for r in results],
    }