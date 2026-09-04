import json
import os
import time
from pathlib import Path
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
_SEASONAL_THRESHOLDS = db.read_table("seasonal_thresholds")
_OUTBREAKS = db.read_table("outbreak_indicators")
_OUTBREAK_VALIDATION = db.read_table("outbreak_validation_2025")

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
_PLAIN_LANGUAGE_RULES = (
    "AUDIENCE: anyone — a barangay health worker, a town official, or a "
    "resident with NO statistics training. Explain like you are talking to "
    "a neighbour.\n"
    "STRICT VOCABULARY RULES — never print any of these words or anything "
    "similar: pipeline, series, index, payload, JSON, ACF, autocorrelation, "
    "lag, decomposition, residual, variance, percentile, threshold, MAPE, "
    "RMSE, confidence interval, statistical, model, data point. Also never "
    "print raw field names such as change_pct_2y, latest_index, peak_week, "
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
    "week'). Always attach meaning ('roughly a tenth of what it was'). Name "
    "MONTHS, never week numbers ('around September', never 'week 36').\n"
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
    "expected in the coming weeks, including the honest range if given; (3) "
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


_MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


def _month_label(iso_week):
    # Same week→month approximation as the Seasonality page (data.ts MONTHS).
    return _MONTH_LABELS[min(11, int(((iso_week - 1) / 52) * 12))]


def _variance(values):
    mean = sum(values) / len(values)
    return sum((v - mean) ** 2 for v in values) / len(values)


def _seasonality_grounding(db_region):
    """Deterministic server-side port of the Seasonality page's decomposition
    (frontend data.ts `decompose()`/`acf()`): centred ±26-week moving-average
    trend, week-of-year seasonal index, residual noise and autocorrelation.
    Computed from the already-loaded history tables only — the LLM narrates
    these numbers, it never derives its own."""

    hist = _history(db_region)
    dates = list(hist["date"])
    values = [float(c) for c in hist["cases"]]
    n = len(values)

    half = 26
    trend_pts = []
    for i in range(n):
        lo, hi = max(0, i - half), min(n, i + half + 1)
        window = values[lo:hi]
        trend_pts.append(sum(window) / len(window))

    weeks = [int(d.isocalendar().week) for d in dates]
    detrended = [v - t for v, t in zip(values, trend_pts)]
    buckets = [[] for _ in range(52)]
    for dval, wk in zip(detrended, weeks):
        buckets[(wk - 1) % 52].append(dval)
    seasonal_idx = [(sum(b) / len(b)) if b else 0.0 for b in buckets]
    seas_pts = [seasonal_idx[(wk - 1) % 52] for wk in weeks]
    resid_pts = [v - t - s for v, t, s in zip(values, trend_pts, seas_pts)]

    seas_var = _variance(seas_pts)
    resid_var = _variance(resid_pts)
    strength_pct = round(100 * seas_var / ((seas_var + resid_var) or 1))

    mean = sum(values) / n
    denom = sum((v - mean) ** 2 for v in values) or 1
    acfs = {}
    for lag in range(1, 61):
        num = sum((values[i] - mean) * (values[i - lag] - mean) for i in range(lag, n))
        acfs[lag] = round(num / denom, 3)
    dominant_lag = max(acfs, key=lambda k: acfs[k])

    peak_week = max(range(52), key=lambda w: seasonal_idx[w]) + 1
    trough_week = min(range(52), key=lambda w: seasonal_idx[w]) + 1

    wet = [v for d, v in zip(dates, values) if d.month in WET_MONTHS]
    dry = [v for d, v in zip(dates, values) if d.month not in WET_MONTHS]

    trend_change = (
        round((trend_pts[-1] - trend_pts[n - 105]) / (trend_pts[n - 105] or 1) * 100)
        if n > 104
        else 0
    )

    return {
        "region": db_region,
        "observed_weeks": n,
        "series_start": dates[0].date().isoformat(),
        "series_end": dates[-1].date().isoformat(),
        "trend": {"latest_index": round(trend_pts[-1]), "change_pct_2y": trend_change},
        "seasonal": {
            "peak_week": peak_week,
            "peak_month": _month_label(peak_week),
            "trough_week": trough_week,
            "trough_month": _month_label(trough_week),
            "strength_pct": strength_pct,
        },
        "cycle": {
            "acf_lag52": acfs.get(52, 0.0),
            "acf_lag26": acfs.get(26, 0.0),
            "dominant_lag_weeks": dominant_lag,
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
    "dengue pattern the user is looking at. Name months instead of week "
    "numbers whenever a week number appears in the figures."
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
        "Focus on unusual weeks that jumped above or dropped below the normal "
        "pattern, and note that some up-and-down week to week is normal."
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


def _narrate_with_gemini(api_key, system_prompt, user_prompt):
    """Google AI Studio (Gemini) via plain stdlib HTTP — no extra dependency.

    Tries the primary model, then GEMINI_FALLBACK_MODELS in order. Free-tier
    quotas are per model, so when the primary is rate-limited (429) a lighter
    fallback usually still has headroom."""
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    primary = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    models = [primary]
    for candidate in os.environ.get(
        "GEMINI_FALLBACK_MODELS", "gemini-3.5-flash-lite,gemini-3.1-flash-lite"
    ).split(","):
        candidate = candidate.strip()
        if candidate and candidate != primary and candidate not in models:
            models.append(candidate)

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        # thinkingBudget 0 is rejected by gemini-3.x; -1 lets the model use
        # as much hidden reasoning as it needs, so maxOutputTokens must be
        # generous enough that prose never gets starved (finish=MAX_TOKENS).
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 4096,
            "thinkingConfig": {"thinkingBudget": -1},
        },
    }

    narrative = ""
    used_model = None
    last_code = None
    try:
        # Free tier occasionally returns transient 429/503 bursts; one quiet
        # retry after a short pause keeps single clicks from failing before
        # we move on to the next model in the chain.
        for candidate in models:
            request = Request(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{candidate}:generateContent",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
                method="POST",
            )
            for attempt in range(2):
                try:
                    with urlopen(request, timeout=60) as response:
                        body = json.loads(response.read().decode("utf-8"))
                    parts = body["candidates"][0]["content"]["parts"]
                    narrative = "".join(part.get("text", "") for part in parts).strip()
                    used_model = candidate
                    break
                except HTTPError as exc:
                    last_code = exc.code
                    if exc.code in (429, 500, 503) and attempt == 0:
                        time.sleep(6)
                        continue
                    break
            if used_model:
                break
        if not used_model:
            if last_code == 429:
                detail = (
                    "AI-assisted analysis failed: free-tier quota reached on "
                    "all configured Gemini models — try again later"
                )
            else:
                detail = f"AI-assisted analysis failed: HTTPError {last_code}"
            raise HTTPException(status_code=503, detail=detail)
        narrative = (
            narrative.replace("**", "")
            .replace("`", "")
            .lstrip("-• ")
            .strip()
        )
    except (HTTPError, URLError, TimeoutError, KeyError, IndexError, ValueError) as exc:
        suffix = f" {exc.code}" if isinstance(exc, HTTPError) else ""
        raise HTTPException(
            status_code=503,
            detail=f"AI-assisted analysis failed: {type(exc).__name__}{suffix} — "
            "try again in a moment",
        )
    if not narrative:
        raise HTTPException(status_code=503, detail="AI-assisted analysis returned no text.")
    return narrative, used_model


def _narrate_with_anthropic(api_key, system_prompt, user_prompt):
    try:
        import anthropic
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: anthropic package not installed.",
        )

    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    try:
        client = anthropic.Anthropic(api_key=api_key, timeout=30.0, max_retries=0)
        message = client.messages.create(
            model=model,
            max_tokens=400,
            system=system_prompt,
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
    return narrative, model


def _llm_narrate(system_prompt, user_prompt):
    """Shared constrained LLM call for interpretability endpoints.

    Provider is picked by which key the server has: GEMINI_API_KEY (free tier
    at aistudio.google.com) wins over ANTHROPIC_API_KEY. Fails soft (503) on
    missing key or API errors so no dashboard view ever breaks because of the
    AI layer."""
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        return _narrate_with_gemini(gemini_key, system_prompt, user_prompt)

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        return _narrate_with_anthropic(anthropic_key, system_prompt, user_prompt)

    raise HTTPException(
        status_code=503,
        detail="AI-assisted analysis unavailable: set GEMINI_API_KEY (free tier) "
        "or ANTHROPIC_API_KEY on the server.",
    )


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
    allow_origin_regex=r"^(http://(localhost|127\.0\.0\.1)(:\d+)?|https://[a-z0-9-]+\.onrender\.com)$",
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


@app.get("/thresholds/seasonal", tags=["objective_3_classification"])
def seasonal_thresholds(region: str | None = Query(default=None)):
    """Season-probe alert thresholds: long-run P75 of weekly case load for the
    dry (Jan-Mar) and wet (Jul-Sep) forecast windows, per region."""
    df = _SEASONAL_THRESHOLDS.copy()
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == db_region]
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
        df = df[df["region"] == db_region]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    return {"disease": disease, "region": region, "items": df.to_dict(orient="records")}


@app.get("/outbreak", tags=["objective_2_forecast"])
def outbreak_overview(
    region: str | None = Query(default=None),
    season: str | None = Query(default=None),
):
    """Region-season outbreak flags for the map/dashboard.

    Rule A: >=3 consecutive probe weeks forecast at High (above the weekly
    P75). Rule B: the season's forecast average exceeds the season's long-run
    P75. Trigger reports which rule(s) fired."""
    df = _OUTBREAKS.copy()
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == db_region]
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
        (_OUTBREAKS["region"] == db_region) & (_OUTBREAKS["disease"] == disease)
    ].sort_values("season")
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No outbreak indicators for '{region}'")
    return {
        "region": db_region,
        "disease": disease,
        "seasons": rows.to_dict(orient="records"),
    }


@app.get("/validation/outbreak", tags=["objective_3_classification"])
def outbreak_validation():
    """Prospective 2025 validation of the outbreak indicator.

    Headline: dry-season detection is strong (F1 0.90); the wet season
    favours recall over precision and over-warns, by design."""
    v = _OUTBREAK_VALIDATION
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
        "region": region,
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
    Anthropic key is missing or the API errors so region pages stay usable.
    """
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
        "region": region,
        "disease": disease,
        "narrative": narrative,
        "grounding_data": grounding,
        "model": model,
    }
