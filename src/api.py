import hashlib
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path


import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import db

SUPPORTED_DISEASES = ["Dengue"]
DISEASE_DEFAULT = "Dengue"
PRIMARY_WINDOW = "last_12m"

WET_MONTHS = (6, 7, 8, 9, 10, 11)

# PAGASA Modified Corona Climate Classification. The production pipeline labels
# seasons with the national monsoon calendar (wet = Jun-Nov, dry = Dec-May), a
# Type I generalisation. Three eastern regions are Type II: their maximum
# rainfall falls Dec-Feb, so their local wet window is inverted relative to that
# labelling. The dashboard never reasons about weather, but when an AI narrative
# mentions "wet"/"dry season" the annotation below keeps the wording honest and
# forbids monsoon-based causal claims. Matches classify.SEASON_RULES.
CLIMATE_TYPES = {
    "Bicol Region": "Type II (local peak rainfall Dec-Feb; the Jan-Mar probe sits "
    "inside its observed high case months)",
    "Eastern Visayas": "Type II (local peak rainfall Dec-Feb; the Jan-Mar probe sits "
    "inside its observed high case months)",
    "Caraga": "Type II (local peak rainfall Dec-Feb; the Jan-Mar probe sits "
    "inside its observed high case months)",
}
_CLIMATE_TYPE_DEFAULT = "Type I (national wet season Jun-Nov)"

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
_ESCALATION: pd.DataFrame | None = None
_data_ready = False


def _normalize_dates(df, col):
    """Ensure df has a real datetime `col`: consume it when present (CSV
    source), else derive it from year/month (the relational-DB shape)."""
    if col in df.columns:
        df[col] = pd.to_datetime(df[col])
    else:
        df[col] = pd.to_datetime(
            df["year"].astype(str) + "-" + df["month"].astype(str).str.zfill(2) + "-01"
        )
    return df


def _dedupe_latest(df, subset, sort_col=None):
    """Keep only the newest row per `subset` key.

    Defensive: a deployed relational DB may hold rows accumulated across
    pipeline runs (duplicate (region, month) observations, repeated forecast
    snapshots, re-written outbreak flags). Sort by the newest time column when
    available so `keep="last"` always means "latest". No-op when a subset
    column is absent from the frame."""
    missing = [c for c in subset if c not in df.columns]
    if missing:
        return df
    if sort_col is not None and sort_col in df.columns:
        df = df.sort_values(subset + [sort_col], kind="mergesort")
    else:
        df = df.sort_values(subset, kind="mergesort")
    return df.drop_duplicates(subset=subset, keep="last").reset_index(drop=True)


def _load_repo_tables():
    """Read every pipeline table from the PostgreSQL database (Postgres-only).

    The repo's processed CSVs are pipeline checkpoints only; the API no longer
    reads them. All data below comes from `db.read_table`. Depends on a working
    DATABASE_URL and on the schema being built (auto-created via
    `db.ensure_tables()` at startup)."""
    obs = db.read_table("monthly_observations")
    obs = _dedupe_latest(obs, ["region_code", "year", "month"])
    _NATIONAL = obs[obs["region_code"] == db.NATIONAL_CODE]
    _REGIONAL = obs[obs["region_code"] != db.NATIONAL_CODE]
    _normalize_dates(_NATIONAL, "date")
    _normalize_dates(_REGIONAL, "date")

    _FORECASTS = db.read_table("forecasts")
    _normalize_dates(_FORECASTS, "target_date")
    _FORECASTS = _dedupe_latest(_FORECASTS, ["region_code", "target_date"])

    _CLASSIFICATION = db.read_table("risk_classifications")
    _normalize_dates(_CLASSIFICATION, "date")
    _CLASSIFICATION = _dedupe_latest(_CLASSIFICATION, ["region_code", "date"])

    _THRESHOLDS = db.read_table("risk_thresholds")
    _THRESHOLDS = _dedupe_latest(_THRESHOLDS, ["region_code", "month"])

    _METRICS = db.read_table("validation_metrics")
    _METRICS = _dedupe_latest(_METRICS, ["region_code"])

    _OUTBREAKS = db.read_table("outbreak_signals")
    _OUTBREAKS = _dedupe_latest(_OUTBREAKS, ["region_code", "season"])

    ov = db.read_table("outbreak_validation")
    ov = _dedupe_latest(ov, ["region_code", "season"])
    _OUTBREAK_VALIDATION = ov.assign(region=ov["region_code"].map(_label))

    esc = db.read_table("risk_escalation")
    _ESCALATION = (
        esc.assign(region=esc["region_code"].map(_label)) if not esc.empty else None
    )

    return (
        _NATIONAL,
        _REGIONAL,
        _FORECASTS,
        _CLASSIFICATION,
        _THRESHOLDS,
        _METRICS,
        _OUTBREAKS,
        _OUTBREAK_VALIDATION,
        _ESCALATION,
    )


def _load_all_data() -> None:
    global _NATIONAL, _REGIONAL, _FORECASTS, _CLASSIFICATION  # noqa: PLW0603
    global _THRESHOLDS, _METRICS, _OUTBREAKS, _OUTBREAK_VALIDATION  # noqa: PLW0603
    global _ESCALATION, _data_ready  # noqa: PLW0603

    db.ensure_tables()
    t0 = time.monotonic()
    (
        _NATIONAL,
        _REGIONAL,
        _FORECASTS,
        _CLASSIFICATION,
        _THRESHOLDS,
        _METRICS,
        _OUTBREAKS,
        _OUTBREAK_VALIDATION,
        _ESCALATION,
    ) = _load_repo_tables()

    _data_ready = True
    print(f"Backend data loaded in {time.monotonic() - t0:.1f}s")


def _region_code_or_none(label):
    if label.strip().lower() == db.NATIONAL_NAME.lower():
        return db.NATIONAL_CODE
    for meta in REGION_META:
        if label.strip() == meta["code"]:
            return meta["code"]
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
    "- forecast accuracy/confidence -> 'this outlook is usually close to "
    "what really happens' or 'this outlook is less certain than usual'\n"
    "- risk tier -> 'the alert level for dengue is high/low'\n"
    "SEASON WORDING RULE (hard constraint, applies to every response): never "
    "blame weather, rainfall, the monsoon, typhoons, storms, or 'the rainy "
    "season' for dengue levels. The figures are case counts compared with "
    "historical baselines; season labels in the figures are probe windows, "
    "not weather claims. Talk about which calendar months the numbers rise "
    "and fall in, and which season label applies, without ever saying weather "
    "drives the change.\n"
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
    + "\nTASK: using the JSON figures, write the whole explanation as EXACTLY "
    "three labelled paragraphs, in this order and with exactly these labels "
    "at the start of each paragraph (each followed by a colon, one paragraph "
    "on its own):\n"
    "Current Situation:\n"
    "Seasonal Outlook:\n"
    "Recommended Actions:\n"
    "Cover in Current Situation: how many dengue cases are happening now, in "
    "everyday terms, and the current alert level in plain words. In Seasonal "
    "Outlook: what is expected in the coming months, including the honest "
    "range if one is given, with a caution note only if the outlook is flagged "
    "as uncertain. In Recommended Actions: one practical thing the community "
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
        "climate": _climate_annotation(db_region),
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


def _climate_annotation(db_region):
    """Per-region climate-type annotation for LLM grounding payloads.

    Surfaces the PAGASA Modified Corona classification for the region so the
    narration layer never has to guess whether "dry season" means the same
    months for this region as for the national Type I calendar."""
    name = _label(db_region)
    typ = CLIMATE_TYPES.get(name)
    if typ is None:
        return {
            "climate_type": _CLIMATE_TYPE_DEFAULT,
            "effective_wet_months": "June to November",
            "effective_dry_months": "December to May, January to March probe is dry season",
        }
    return {
        "climate_type": typ,
        "effective_wet_months": "December to May (inverted from the national calendar)",
        "effective_dry_months": "June to November (inverted from the national calendar)",
    }


_SAFE_SEASON_CLAUSE = (
    "SEASON WORDING RULE (hard constraint): never attribute dengue levels to "
    "weather, rainfall, the monsoon, storms, or 'wet/dry season' as a cause. "
    "The pipeline compares case counts against historical percentiles; its "
    "'dry season'/'wet season' labels label the probe windows, they are not a "
    "claim about this region's rainfall pattern. Say what the numbers show "
    "('cases climb every year from about June to September' if the figures "
    "show that, and that the region has its own climate pattern when "
    "annotated) without ever saying rain causes dengue. If the payload "
    "carries a climate_type annotation, echo it verbatim only as a factual "
    "aside, never as the mechanism."
)

_WEATHER_LEXICON = (
    " rain", " rainy", " monsoon", "habagat", "amihan", " typhoon", "thunderstorm",
    " wet season", " dry season", " rainy season", " north-east monsoon",
    " south-west monsoon", " rains", " rainfall",
)


def _weather_violation(narrative):
    """Deterministic post-generation guard: report which weather/monsoon terms
    the narration used, so endpoints can swap in a safe templated fallback.
    Empty tuple means the prose is clean under the constraint."""
    low = narrative.lower()
    return tuple(w.strip() for w in _WEATHER_LEXICON if w in low)


def _safe_season_narrative(grounding):
    """Strictly-weather-free fallback narration built from the same grounding
    payload, used only when the model violates the SEASON WORDING RULE."""
    region = grounding.get("region", "this region")
    fore = grounding.get("forecast", grounding.get("next_month_forecast"))
    if fore and fore.get("yhat") is not None:
        v = int(round(float(fore["yhat"])))
        month = fore.get("month", fore.get("target_date", "")) or ""
        if isinstance(month, str) and len(month) == 10:
            month = _month_label(pd.Timestamp(month).month)
        lead = f"In {region}, around {v:,} dengue cases are expected"
        if month:
            lead += f" in {month}"
        lead += "."
    else:
        seas = grounding.get("seasonal")
        if seas:
            lead = f"Across {region}, case counts move in a steady yearly rhythm"
        else:
            lead = f"Dengue numbers in {region} are tracked against historical levels."
    climate = grounding.get("climate", {}).get("climate_type", "")
    if "Type II" in climate:
        climate_suffix = (
            " This region has a Type II climate, so its usual pattern can differ "
            "from the rest of the country."
        )
    else:
        climate_suffix = ""
    return lead + climate_suffix


# ---------------------------------------------------------------------------
# Numeric-fidelity guard (methodology 3.5.3). Deterministic post-generation
# check: every numeric token in the generated prose must trace back to a value
# in the grounding payload (or a known method/calendar constant). Any unknown
# figure swaps in a deterministic templated narration, so no unverified number
# is ever dispatched to a client.
# ---------------------------------------------------------------------------

# Calendar/method constants a narration may legitimately echo without the
# pipeline having computed them: surveillance years, percentile/CI/window
# labels, three-month probe length, 19 series, 18 regions, 36-month baseline.
_METHOD_CONSTANTS = {
    3.0, 6.0, 10.0, 12.0, 18.0, 24.0, 36.0, 48.0, 50.0, 75.0, 80.0, 95.0,
    100.0, 0.5, 2022.0, 2023.0, 2024.0, 2025.0, 2026.0,
}


def _extract_number_tokens(text):
    """All decimal tokens in a string, with comma grouping stripped."""
    out = []
    for m in re.finditer(r"-?\d[\d,]*(?:\.\d+)?", text):
        out.append(float(m.group().replace(",", "")))
    return out


def _numeric_allowed(grounding):
    """Set of numeric values a narration may use, collected recursively from
    the grounding payload (including digits inside date/label strings) plus the
    method constants above."""
    allowed = set(_METHOD_CONSTANTS)

    def walk(obj):
        if isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                walk(v)
        elif isinstance(obj, bool):
            return
        elif isinstance(obj, (int, float)):
            allowed.add(float(obj))
        elif isinstance(obj, str):
            allowed.update(_extract_number_tokens(obj))

    walk(grounding)
    return allowed


_NUMERIC_TOLERANCE = 1.0  # absolute slack; 1%-of-value slack applied per token


def _numeric_violation(narrative, grounding):
    """Report numeric tokens with no allowed counterpart in the grounding
    payload, within a 1%-or-1-unit rounding tolerance. Empty tuple means the
    prose cites only figures the pipeline computed."""
    allowed = _numeric_allowed(grounding)
    bad = []
    for token in _extract_number_tokens(narrative):
        if any(abs(token - a) <= max(_NUMERIC_TOLERANCE, 0.01 * abs(a)) for a in allowed):
            continue
        bad.append(token)
    return tuple(round(b, 3) for b in bad[:8])


def _safe_element_narrative(g):
    """Deterministic fallback for click-to-explain: restates only the payload
    fields the user clicked, no LLM, no derived figures."""
    parts = []
    desc = str(g.get("description") or g.get("title") or "").strip().rstrip(".")
    if desc:
        parts.append(desc + ".")
    if g.get("metric_value"):
        parts.append(f"The current reading is {g['metric_value']}.")
    if g.get("region"):
        parts.append(f"This applies to {g['region']}.")
    if g.get("month"):
        parts.append(f"For {g['month']}.")
    text = " ".join(parts).strip()
    return text or "This element explains a dengue surveillance dashboard reading."


def _guarded_narrative(system_prompt, user_prompt, grounding, safe_fn):
    """Generate, then deterministically guard: weather-lexicon check, then
    numeric-fidelity check against the grounding payload. On either violation
    the narration is replaced by a templated fallback built from the same
    grounding (no LLM). Returns narrative, model, flag, and both violation
    reports for auditability."""
    narrative, model = _llm_narrate(system_prompt, user_prompt)
    weather = _weather_violation(narrative)
    numbers = _numeric_violation(narrative, grounding)
    if weather or numbers:
        narrative = safe_fn(grounding)
        used_safe_fallback = True
    else:
        used_safe_fallback = False
    return narrative, model, used_safe_fallback, weather, numbers


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
        "climate": _climate_annotation(db_region),
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
        "peak and fall to a low, sticking to calendar months and never "
        "blaming rain or the seasons for the pattern."
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


_AI_RESPONSE_CACHE: dict[str, tuple[str, str, float]] = {}
_AI_CACHE_TTL_SECONDS = int(os.environ.get("AI_CACHE_TTL_SECONDS", "1800"))
_GROQ_COOLDOWN_UNTIL: float = 0.0
_GROQ_COOLDOWN_DURATION = int(os.environ.get("GROQ_COOLDOWN_SECONDS", "300"))


def _get_ai_cache_key(system_prompt: str, user_prompt: str) -> str:
    combined = f"{system_prompt}\n---\n{user_prompt}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def _llm_narrate(system_prompt: str, user_prompt: str) -> tuple[str, str]:
    """Shared constrained LLM call for interpretability endpoints.

    Uses Groq as primary provider and OpenAI as fallback when Groq limits/errors are reached.
    Includes in-memory TTL caching (30m) and a 5-minute Groq circuit breaker cooldown
    to protect against quota reach and spam. Fails soft (503) on missing keys or total API errors."""
    global _GROQ_COOLDOWN_UNTIL

    now = time.time()
    cache_key = _get_ai_cache_key(system_prompt, user_prompt)

    # 1. In-memory TTL Response Cache check (Anti-spam / Anti-quota)
    if cache_key in _AI_RESPONSE_CACHE:
        cached_narrative, cached_model, cached_time = _AI_RESPONSE_CACHE[cache_key]
        if now - cached_time < _AI_CACHE_TTL_SECONDS:
            return cached_narrative, f"{cached_model} (cached)"

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    narrative = ""
    used_model = None

    # 2. Primary Provider: Groq API
    if groq_key and now >= _GROQ_COOLDOWN_UNTIL:
        try:
            from groq import Groq

            GROQ_MODEL = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")
            fallback_groq_models = ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"]
            _gpt_oss = {"openai/gpt-oss-120b", "openai/gpt-oss-20b"}

            client = Groq(api_key=groq_key, timeout=25.0, max_retries=0)
            models_to_try = [GROQ_MODEL]
            for m in fallback_groq_models:
                if m not in models_to_try:
                    models_to_try.append(m)

            for model in models_to_try:
                try:
                    params: dict = {
                        "model": model,
                        "max_tokens": 1024,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    }
                    if model not in _gpt_oss:
                        params["temperature"] = 0.3
                    res = client.chat.completions.create(**params)
                    narrative = (res.choices[0].message.content or "").strip()
                    if narrative:
                        used_model = f"groq:{model}"
                        break
                except Exception as exc:
                    exc_str = str(exc).lower()
                    is_rate_limit = any(term in exc_str for term in ("429", "rate limit", "quota", "requests per minute", "tokens per minute", "rate_limit_exceeded"))
                    if is_rate_limit:
                        print(f"[llm] Groq rate limit/quota reached ({model}): {exc!r}. Activating {min(_GROQ_COOLDOWN_DURATION, 300)}s Groq cooldown.", flush=True)
                        _GROQ_COOLDOWN_UNTIL = now + _GROQ_COOLDOWN_DURATION
                        break
                    else:
                        print(f"[llm] Groq model '{model}' failed: {exc!r}", flush=True)
                        continue
        except Exception as exc:
            print(f"[llm] Groq primary provider error: {exc!r}", flush=True)

    # 3. Fallback Provider: OpenAI API
    if not narrative and openai_key:
        try:
            from openai import OpenAI

            OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
            client = OpenAI(api_key=openai_key, timeout=25.0, max_retries=1)
            res = client.chat.completions.create(
                model=OPENAI_MODEL,
                max_tokens=1024,
                temperature=0.3,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            narrative = (res.choices[0].message.content or "").strip()
            if narrative:
                used_model = f"openai:{OPENAI_MODEL} (fallback)"
        except Exception as exc:
            print(f"[llm] OpenAI fallback provider error: {exc!r}", flush=True)

    # 4. Success handling and Caching
    if narrative and used_model:
        clean_model_tag = used_model.replace(" (fallback)", "")
        _AI_RESPONSE_CACHE[cache_key] = (narrative, clean_model_tag, now)
        return narrative, used_model

    # 5. Soft Failure Responses
    if not groq_key and not openai_key:
        raise HTTPException(
            status_code=503,
            detail="AI-assisted analysis unavailable: set GROQ_API_KEY or OPENAI_API_KEY on the server.",
        )

    raise HTTPException(
        status_code=503,
        detail="AI summary unavailable due to provider quota/rate limits. Please refer to forecast data directly.",
    )


@asynccontextmanager
async def lifespan(_app):
    _load_all_data()
    yield


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

# Application-layer rate limiting. Keyed by client IP (in-memory, no Redis
# required). Tight limits on the surfaces that make external calls (LLM
# narration) so abuse can't run up cost; a generous cap on the
# batched read endpoint. Returns 429 in JSON so the frontend can handle it.
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    detail = getattr(exc, "detail", None)
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down and retry."},
        headers={"Retry-After": str(getattr(exc, "retry_after", 60))},
    )


@app.get("/", tags=["info"])
def root():
    return {
        "system": "HEALTHWATCH",
        "description": "Seasonal illness outbreak forecasting and hotspot classification (Dengue pilot)",
        "objectives_endpoints": {
            "objective_1_patterns": "/series/{region} and /analysis/seasonality",
            "objective_2_forecast": "/series/{region}, /forecast/{disease}, /outbreak and /outbreak/{region}",
            "objective_3_classification": "/risk-classification/{disease}, /thresholds/{disease}, /thresholds/seasonal, /escalation (risk-tier escalation ranking) and /validation/outbreak",
            "objective_4_dashboard": "/dashboard, /regions, /status and /metrics/{region} (validation metrics; non-negativity clipping and wet/dry season regressor are enforced in the pipeline, surfaced via /metrics)",
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
@limiter.limit("300/minute")
def dashboard(request: Request, disease: str = Query(default=DISEASE_DEFAULT)):
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
    """Pipeline freshness: the latest pipeline run recorded in the database."""
    if not _data_ready:
        raise HTTPException(status_code=503, detail="Data still loading, retry shortly")
    runs = db.read_table("pipeline_runs")
    if runs is None or runs.empty:
        raise HTTPException(status_code=404, detail="No pipeline runs recorded")
    row = runs.sort_values("id").iloc[-1]
    generated = row["generated_at"]
    if not isinstance(generated, str):
        generated = generated.isoformat()

    # The regional table defines what the dashboard plots (national runs later).
    last_date = _REGIONAL["date"].max()
    data_through = pd.to_datetime(row["data_through"])
    return {
        "generated_at": generated,
        "data_through": {
            "date": last_date.date().isoformat(),
            "month": f"{int(last_date.year)}-{int(last_date.month):02d}",
        },
        "pipeline_data_through": data_through.date().isoformat(),
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


@app.get("/forecast/{disease}", tags=["objective_2_forecast", "objective_3_api"])
@limiter.limit("300/minute")
def forecast(request: Request, disease: str, region: str | None = Query(default=None)):
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


@app.get("/risk-classification/{disease}", tags=["objective_3_classification", "objective_3_api"])
@limiter.limit("300/minute")
def risk_classification(request: Request, disease: str, region: str | None = Query(default=None)):
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


@app.get("/escalation", tags=["objective_3_classification", "objective_3_api"])
@limiter.limit("300/minute")
def escalation(
    request: Request,
    disease: str = Query(default=DISEASE_DEFAULT),
    region: str | None = Query(default=None),
    top: int = Query(default=0, ge=0, le=100),
):
    """Risk-tier escalation ranking (Objective 4 / hotspot prioritization).

    Ranks each region by how many upward risk-tier transitions its forecast
    makes across the prediction horizon (`tier_climbs`): steepest risers first,
    as the priority list for resource allocation. `top=N` returns only the top
    N regions.
    """
    _check_disease(disease)
    if _ESCALATION is None:
        raise HTTPException(status_code=404, detail="Escalation ranking not generated yet")
    df = _ESCALATION[_ESCALATION["disease"] == disease].sort_values("rank")
    if region:
        db_region = _resolve_region(region)
        if db_region is None:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
        df = df[df["region"] == _label(db_region)]
        if df.empty:
            raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    if top:
        df = df.head(top)
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


def _ai_insight_grounding(db_region, disease):
    """Compact ground-truth payload for the map-panel one-line AI insight.

    Only the handful of figures the small panel line can honestly use:
    the latest reported month, the next-month forecast (with range), the
    next-month risk tier, and the upcoming season's outbreak probe. The LLM
    narrates these — it never derives numbers of its own."""
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
    risk_row = cls[cls["date"] == frow["target_date"]]
    if risk_row.empty:
        risk_row = cls.tail(1)
    risk_level = "unknown"
    probe_month = int(frow["target_date"].month)
    probe_season = _season(frow["target_date"])
    if not risk_row.empty:
        risk_level = str(risk_row.iloc[0]["risk_level"])

    probe = _OUTBREAKS[
        (_OUTBREAKS["region_code"] == db_region)
        & (_OUTBREAKS["disease"] == disease)
        & (_OUTBREAKS["season"] == probe_season)
    ]
    outbreak_row = probe.iloc[0] if not probe.empty else None

    mrow = _METRICS[
        (_METRICS["region_code"] == db_region) & (_METRICS["disease"] == disease)
    ]
    primary = mrow[mrow["window"] == PRIMARY_WINDOW]
    mrow_primary = primary.iloc[0] if not primary.empty else None

    return {
        "region": _label(db_region),
        "disease": disease,
        "climate": _climate_annotation(db_region),
        "latest_month": {
            "month": _month_label(last_obs["date"].month),
            "cases": int(last_obs["cases"]),
        },
        "next_month_forecast": {
            "month": _month_label(probe_month),
            "yhat": float(frow["yhat"]),
            "yhat_lower": float(frow["yhat_lower"]),
            "yhat_upper": float(frow["yhat_upper"]),
        },
        "next_month_risk_level": risk_level,
        "upcoming_season_probe": {
            "season": probe_season,
            "outbreak_signal": bool(outbreak_row["outbreak"]) if outbreak_row is not None else False,
            "trigger": str(outbreak_row["trigger"]) if outbreak_row is not None else "none",
            "consecutive_high_months": (
                int(outbreak_row["consecutive_high_n"]) if outbreak_row is not None else 0
            ),
        },
        "validation": (
            {
                "MAPE_pct": float(mrow_primary["MAPE"]),
                "months": int(mrow_primary["months"]),
            }
            if mrow_primary is not None
            else None
        ),
    }


_AI_INSIGHT_SYSTEM_PROMPT = (
    "You write ONE short plain-language sentence for a Philippine regional "
    "dengue map panel. Base it strictly on the JSON figures.\n"
    + _PLAIN_LANGUAGE_RULES
    + "\nTASK: in ONE sentence of at most 20 words, say the single most "
    "actionable outlook for this region right now: roughly how cases are "
    "expected to move next month, and only if the season probe is flagged "
    "whether an outbreak is likely. No hedging list, no markdown, no numbers "
    "beyond a round case figure if it helps."
)


@app.get("/ai-insight", tags=["objective_5_interpretability"])
@limiter.limit("30/minute")
def ai_insight(
    request: Request,
    region: str = Query(...),
    disease: str = Query(default=DISEASE_DEFAULT),
):
    """Compact one-line AI insight for the map region panel. Same fail-soft
    (503) contract as the other interpretability endpoints and strictly a
    narration of pre-computed outputs ({region}, /outbreak, /metrics)."""
    _check_disease(disease)
    db_region = _resolve_region(region)
    if db_region is None:
        raise HTTPException(status_code=404, detail=f"Unknown region '{region}'")
    grounding = _ai_insight_grounding(db_region, disease)

    user_prompt = (
        "Give the one-line insight for this region's next month. Figures you "
        "may use:\n" + json.dumps(grounding)
    )
    narrative, model, used_safe_fallback, weather_violations, numeric_violations = (
        _guarded_narrative(_AI_INSIGHT_SYSTEM_PROMPT, user_prompt, grounding, _safe_season_narrative)
    )

    return {
        "region": _label(db_region),
        "disease": disease,
        "narrative": narrative,
        "safe_season_fallback": used_safe_fallback,
        "weather_violations": list(weather_violations),
        "numeric_violations": list(numeric_violations),
        "models": model,
        "grounding_data": grounding,
    }


@app.get("/analysis/seasonality", tags=["objective_1_patterns", "objective_5_interpretability"])
@limiter.limit("20/minute")
def analysis_seasonality(
    request: Request,
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
    narrative, model, used_safe_fallback, weather_violations, numeric_violations = (
        _guarded_narrative(_SEASONALITY_SYSTEM_PROMPT, user_prompt, grounding, _safe_season_narrative)
    )

    return {
        "region": _label(db_region),
        "disease": disease,
        "component": component,
        "narrative": narrative,
        "safe_season_fallback": used_safe_fallback,
        "weather_violations": list(weather_violations),
        "numeric_violations": list(numeric_violations),
        "grounding_data": grounding,
        "model": model,
    }


@app.get("/analysis/{region}", tags=["objective_5_interpretability"])
@limiter.limit("20/minute")
def analysis(
    request: Request,
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
    narrative, model, used_safe_fallback, weather_violations, numeric_violations = (
        _guarded_narrative(_ANALYSIS_SYSTEM_PROMPT, user_prompt, grounding, _safe_season_narrative)
    )

    return {
        "region": _label(db_region),
        "disease": disease,
        "narrative": narrative,
        "safe_season_fallback": used_safe_fallback,
        "weather_violations": list(weather_violations),
        "numeric_violations": list(numeric_violations),
        "grounding_data": grounding,
        "model": model,
    }


class ExplainElementPayload(BaseModel):
    title: str
    description: str
    region: str | None = None
    month: str | None = None
    illness: str | None = "Dengue"
    metric_value: str | None = None


_EXPLAIN_ELEMENT_SYSTEM_PROMPT = (
    "You are HealthWatch AI, a public health epidemiologist explaining dashboard elements. "
    "Given an interface element description and optional live surveillance metrics, write a concise "
    "2-sentence plain-language explanation of what this element represents and what the current "
    "data means for disease surveillance. Stay strictly grounded in the provided facts."
)


@app.post("/analysis/explain-element", tags=["objective_5_interpretability"])
@limiter.limit("15/minute")
def explain_element(request: Request, payload: ExplainElementPayload):
    """Generate an on-demand, data-aware AI explanation for a clicked UI element in Explain Mode."""
    user_prompt = (
        f"Element Title: {payload.title}\n"
        f"Static Description: {payload.description}\n"
    )
    if payload.region:
        user_prompt += f"Region: {payload.region}\n"
    if payload.month:
        user_prompt += f"Selected Month: {payload.month}\n"
    if payload.metric_value:
        user_prompt += f"Current Metric/Value: {payload.metric_value}\n"

    grounding = payload.model_dump()
    narrative, model, used_safe_fallback, weather_violations, numeric_violations = (
        _guarded_narrative(_EXPLAIN_ELEMENT_SYSTEM_PROMPT, user_prompt, grounding, _safe_element_narrative)
    )
    return {
        "title": payload.title,
        "narrative": narrative,
        "safe_season_fallback": used_safe_fallback,
        "weather_violations": list(weather_violations),
        "numeric_violations": list(numeric_violations),
        "model": model,
    }