"""Shared narrative surface registry (single source of truth).

Both the corpus generator (`generate_narratives.py`) and the fidelity auditor
(`validate_narratives.py`) iterate this module, so the text that gets audited is
by construction the same text that gets dispatched. Adding a surface here makes
it available to both without touching either script.

Every surface declares:
  surface           - stable key stored in the corpus and requested by the frontend
  component         - sub-key (which decomposition chart), "" when not applicable
  system            - system prompt (must include api._PLAIN_LANGUAGE_RULES)
  grounding         - deterministic payload of pre-computed pipeline numbers
  user              - user prompt; `disease` is substituted at build time
  safe_fn           - deterministic fallback used when a guard rejects the prose
  forecast_bearing  - True when the grounding payload actually contains
                      forward-looking figures (yhat/CI). These surfaces may relay
                      the pipeline outlook; the rest are history-only and get
                      api._HISTORY_ONLY_RULES plus a stricter speculative guard.

The LLM narrates these payloads. It never produces a forecast, a tier, or a
number of its own - the numeric-fidelity guard in api.py enforces that on the
dispatched text, and the speculative-prose guard enforces that it does not
originate a prediction the pipeline did not make.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Callable, Iterable, Iterator

import pandas as pd
from fastapi import HTTPException

from . import api, db

# Decomposition components the Seasonality page can ask about.
SEASONALITY_COMPONENTS = ("observed", "trend", "seasonal", "residual", "acf")

# Surfaces that are per-series (region + disease) vs national-only.
PER_SERIES_SURFACES = (
    "ai_insight",
    "analysis",
    "chart_takeaway",
    "compare",
    "reported",
    "kpi_takeaway",
    "escalation",
    "report_summary",
)
NATIONAL_SURFACES = ("national",)

ALL_SURFACES = PER_SERIES_SURFACES + NATIONAL_SURFACES


# ---------------------------------------------------------------------------
# System prompts for the new surfaces. Each one reuses the shared
# plain-language rules so the vocabulary ban, season-wording rule and number
# rules apply exactly as they do on the existing endpoints.
# ---------------------------------------------------------------------------

_COMPARE_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._HISTORY_ONLY_RULES
    + "\nTASK: the user is comparing this region against the rest of the "
    "country. Write 2-3 sentences that place this region on that comparison: "
    "is it running higher or lower than the national picture, how does it rank, "
    "and is it moving up or down. Use only the figures provided."
)

_REPORTED_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._HISTORY_ONLY_RULES
    + "\nTASK: the user is looking at a breakdown of confirmed reported cases "
    "for this region. Write 2-3 sentences describing who is most affected and "
    "how the total has moved, using only the figures provided. Describe the "
    "groupings in plain words - say 'adults', 'children' or 'women' rather than "
    "repeating category codes."
)

_NATIONAL_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._FORECAST_RELAY_RULES
    + "\nTASK: the user is looking at the national picture for the whole "
    "country. Write 2-3 sentences covering where the country stands overall, "
    "which regions are carrying the highest burden, and how the totals are "
    "moving. Use only the figures provided."
)

_CHART_TAKEAWAY_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._HISTORY_ONLY_RULES
    + "\nFIXED-WINDOW RULE (hard constraint): these figures were computed from a "
    "fixed window of recorded months that ended in the past, at the date given "
    "in the `as_of` field. They are not live and they do not reflect the user's "
    "current slider position. Your sentence MUST contain the phrase 'up to "
    "December 2024' exactly once, quoting the month and year from `as_of`. "
    "This is required: text without it is discarded. Never write the words now, "
    "today, currently or this month, and never write 'up to now'.\n"
    + "\nTASK: the user has just looked at this chart for this region. Write "
    "ONE short sentence stating what this specific chart is showing for this "
    "region - the concrete reading, not a definition of the chart. "
    "A separate panel already explains what the chart means, so do not "
    "describe the chart itself, only what its numbers say here."
)

_KPI_TAKEAWAY_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._FORECAST_RELAY_RULES
    + "\nTASK: the user is looking at this region's headline number. Write ONE "
    "or two sentences stating where that number sits relative to its own "
    "history and thresholds, and whether it is rising or falling. Give the "
    "reading, not a lesson about percentiles or tiers. Do not recommend any "
    "action or response - a separate panel covers that."
)

_ESCALATION_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._FORECAST_RELAY_RULES
    + "\nTASK: the user is looking at the escalation priority list, which ranks "
    "regions by how many risk-tier steps their forecast moves upward over the "
    "next 12 months. Write 2-3 sentences explaining what this region's place in "
    "that ordering means for its trajectory. Describe the movement, do not "
    "recommend any response."
)

_REPORT_SUMMARY_SYSTEM_PROMPT = (
    "You write short plain-language explanations of {disease} numbers for "
    "Philippine communities, based only on the figures you are given.\n"
    + api._PLAIN_LANGUAGE_RULES
    + api._FORECAST_RELAY_RULES
    + "\nTASK: these figures are being exported into a surveillance report for "
    "this region. Write 2-3 sentences summarizing the region's current risk "
    "position, its forecast direction, and its data quality. The rest of the "
    "report already prints every figure in a table, so do not list numbers back "
    "at the reader; interpret them. Do not recommend any response."
)


@dataclass
class Scenario:
    """One narrative to generate (or audit) for a single (region, disease)."""

    surface: str
    region: str
    disease: str
    component: str
    system: str
    user: str
    grounding: dict
    safe_fn: Callable[[dict], str] = field(default=api._safe_season_narrative)
    # Whether this surface's grounding contains forward-looking pipeline figures.
    # Decides which prompt rules and which arm of the speculative guard apply.
    forecast_bearing: bool = False

    @property
    def key(self) -> tuple[str, str, str, str]:
        return (self.region, self.disease, self.surface, self.component)


# ---------------------------------------------------------------------------
# Grounding builders for the new surfaces. Each reads only the already-loaded
# pipeline tables, so every figure in the payload is one the pipeline computed.
# ---------------------------------------------------------------------------


def _compare_grounding(db_region: str, disease: str) -> dict:
    """Region-vs-national framing: where this region sits against the country."""
    insight = api._ai_insight_grounding(db_region, disease)
    national = api._ai_insight_grounding(db.NATIONAL_CODE, disease)

    national_cases = int(national["next_month_forecast"]["yhat"])
    regional_cases = int(insight["next_month_forecast"]["yhat"])
    ratio_pct = round(100.0 * regional_cases / national_cases, 1) if national_cases else None

    # Where this region ranks on escalation among all 18 regions.
    rank = None
    tier_climbs = None
    final_tier = None
    if api._ESCALATION is not None:
        rows = api._ESCALATION[api._ESCALATION["disease"] == disease].sort_values("rank")
        mine = rows[rows["region"] == api._label(db_region)]
        if not mine.empty:
            rank = int(mine.iloc[0]["rank"])
            tier_climbs = int(mine.iloc[0]["tier_climbs"])
            final_tier = str(mine.iloc[0]["final_tier"])

    # All regional next-month forecasts, to place this one in the spread.
    peers = api._FORECASTS[
        (api._FORECASTS["disease"] == disease)
        & (api._FORECASTS["region_code"] != db.NATIONAL_CODE)
    ]
    spread = sorted(float(y) for y in peers["yhat"].dropna())
    percentile = None
    if spread and regional_cases is not None:
        below = sum(1 for v in spread if v < regional_cases)
        percentile = round(100.0 * below / len(spread))

    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "regional_next_month": {
            "month": insight["next_month_forecast"]["month"],
            "cases": regional_cases,
            "range_low": int(insight["next_month_forecast"]["yhat_lower"]),
            "range_high": int(insight["next_month_forecast"]["yhat_upper"]),
            "risk_level": insight["next_month_risk_level"],
        },
        "national_next_month": {
            "month": national["next_month_forecast"]["month"],
            "cases": national_cases,
            "risk_level": national["next_month_risk_level"],
        },
        "share_of_national_pct": ratio_pct,
        "percentile_among_regions": percentile,
        "escalation": (
            {"rank": rank, "tier_climbs": tier_climbs, "final_tier": final_tier}
            if rank is not None
            else None
        ),
        "outbreak_signal": insight["upcoming_season_probe"]["outbreak_signal"],
    }


def _reported_grounding(db_region: str, disease: str) -> dict:
    """Who is affected: age/sex split of reported cases plus the recent trend."""
    hist = api._history(db_region, disease).sort_values("date")
    if hist.empty:
        raise api.HTTPException(status_code=404, detail=f"No history for '{db_region}'")

    last = hist.iloc[-1]
    recent = hist.tail(12)
    prior = hist.iloc[-24:-12] if len(hist) >= 24 else hist.iloc[:-12]

    def _mean(df, col="cases"):
        return round(float(df[col].mean()), 1) if not df.empty else None

    # Line-list demographic split for the latest month, when available.
    age_split = None
    sex_split = None
    total_cases = None
    try:
        breakdown = db.case_breakdown(
            region_code=None if db_region == db.NATIONAL_CODE else db_region,
            year=int(last["date"].year),
            month=int(last["date"].month),
            disease=disease,
        )
        dims = breakdown.get("dims") or {}
        # Rows arrive grouped by value; reorder by cases so the biggest groups
        # lead and the prompt carries the actual ranking, not alphabetical order.
        age_split = [
            {"group": r["value"], "cases": int(r["cases"])}
            for r in sorted(dims.get("age_group") or [], key=lambda r: -r["cases"])[:6]
        ]
        sex_split = [
            {"group": r["value"], "cases": int(r["cases"])}
            for r in sorted(dims.get("sex") or [], key=lambda r: -r["cases"])[:3]
        ]
        total_cases = int(breakdown.get("total_cases") or 0)
    except Exception:
        # The 960k-row line-lists are outside the startup snapshot; a missing
        # demographic split must not block the trend half of the narrative.
        age_split = None
        sex_split = None

    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "latest_month": {
            "month": api._month_label(int(last["date"].month)),
            "cases": int(last["cases"]),
        },
        "recent_12_month_mean": _mean(recent),
        "prior_12_month_mean": _mean(prior),
        "total_reported_months": int(len(hist)),
        "line_list_total_cases": total_cases,
        "by_age_group": age_split,
        "by_sex": sex_split,
    }


def _national_grounding(db_region: str, disease: str) -> dict:
    """Country-wide picture: overall load, the heaviest regions, direction."""
    insight = api._ai_insight_grounding(db_region, disease)

    peers = api._FORECASTS[
        (api._FORECASTS["disease"] == disease)
        & (api._FORECASTS["region_code"] != db.NATIONAL_CODE)
    ]

    # Rank regions on the SAME month the national headline figure refers to.
    # Taking each region's max across the whole 12-month horizon would describe
    # the peak of the year while the headline reads the next month, so the
    # sentence would mix two different windows.
    headline_month = insight["next_month_forecast"]["month"]
    if not peers.empty:
        same_month = peers[peers["target_date"].dt.strftime("%B") == headline_month]
        if same_month.empty:
            same_month = peers
        per_region = (
            same_month.groupby("region_code")["yhat"].max().sort_values(ascending=False).head(5)
        )
    else:
        per_region = pd.Series(dtype=float)

    top_regions = [
        {
            "region": api._label(code),
            "cases": round(float(value)),
            "month": headline_month,
        }
        for code, value in per_region.items()
    ]

    hist = api._history(db_region, disease).sort_values("date")
    recent = hist.tail(12)
    prior = hist.iloc[-24:-12] if len(hist) >= 24 else hist.iloc[:-12]

    def _mean(df):
        return round(float(df["cases"].mean()), 1) if not df.empty else None

    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "national_next_month": {
            "month": insight["next_month_forecast"]["month"],
            "cases": int(insight["next_month_forecast"]["yhat"]),
            "range_low": int(insight["next_month_forecast"]["yhat_lower"]),
            "range_high": int(insight["next_month_forecast"]["yhat_upper"]),
            "risk_level": insight["next_month_risk_level"],
        },
        "national_recent_12_month_mean": _mean(recent),
        "national_prior_12_month_mean": _mean(prior),
        "highest_burden_regions": top_regions,
        "outbreak_signal": insight["upcoming_season_probe"]["outbreak_signal"],
    }


def _chart_takeaway_grounding(db_region: str, disease: str) -> dict:
    """The deterministic decomposition the Seasonality page charts render.

    Pinned to `_CORPUS_AS_OF` because this surface is pre-generated and stored
    under a key with no month component, while the page's own decomposition
    recomputes as its horizon slider moves. The stored sentence therefore
    describes the fixed pre-2025 window and says so (`as_of`), rather than
    drifting with the slider.
    """
    grounding = api._seasonality_grounding(
        db_region, disease, as_of=api._CORPUS_AS_OF
    )
    grounding["disease"] = disease
    return grounding


def _escalation_row(db_region: str, disease: str) -> dict | None:
    """This region's escalation-ranking row, or None when it was not generated."""
    if api._ESCALATION is None or api._ESCALATION.empty:
        return None
    rows = api._ESCALATION[api._ESCALATION["disease"] == disease]
    mine = rows[rows["region"] == api._label(db_region)]
    if mine.empty:
        return None
    row = mine.iloc[0]
    peers = len(rows)
    return {
        "rank": int(row["rank"]),
        "regions_ranked": peers,
        "tier_climbs": int(row["tier_climbs"]),
        "net_climb": int(row["net_climb"]),
        "high_risk_months_forecast": int(row["n_high_months"]),
        "first_high_month": str(row["first_high_month"] or "") or None,
        "tier_after_12_months": str(row["final_tier"]),
    }


def _kpi_takeaway_grounding(db_region: str, disease: str) -> dict:
    """Headline number: where the latest reading sits against its own history.

    Mirrors the dashboard's KPI row (value, thresholds, percentile, direction)
    so the sentence describes exactly what the tile above it shows.
    """
    insight = api._ai_insight_grounding(db_region, disease)
    hist = api._history(db_region, disease).sort_values("date")
    if hist.empty:
        raise api.HTTPException(status_code=404, detail=f"No history for '{db_region}'")

    latest = hist.iloc[-1]
    cases = int(latest["cases"])
    prev = hist.iloc[-4] if len(hist) >= 4 else hist.iloc[0]
    prev_cases = int(prev["cases"])
    change_pct = round(100.0 * (cases - prev_cases) / prev_cases, 1) if prev_cases else None

    # Thresholds for the observed month drive the tier read; the client's
    # percentile is a pooled cross-region figure the backend does not hold, so
    # ground against the region's own seasonal thresholds instead.
    thresholds = None
    risk_level = insight["next_month_risk_level"]
    trows = api._THRESHOLDS[
        (api._THRESHOLDS["region_code"] == db_region)
        & (api._THRESHOLDS["disease"] == disease)
        & (api._THRESHOLDS["month"] == latest["date"].month)
    ]
    if not trows.empty:
        trow = trows.iloc[-1]
        thresholds = {
            "median_p50": round(float(trow["p50"]), 1),
            "high_p75": round(float(trow["p75"]), 1),
        }

    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "latest_month": {
            "month": insight["latest_month"]["month"],
            "cases": cases,
            "change_vs_3_months_earlier_pct": change_pct,
        },
        "month_of_year_thresholds": thresholds,
        "next_month_forecast": insight["next_month_forecast"],
        "next_month_risk_level": risk_level,
        "outbreak_signal": insight["upcoming_season_probe"]["outbreak_signal"],
        "forecast_error_MAPE_pct": (
            insight["validation"]["MAPE_pct"] if insight["validation"] else None
        ),
    }


def _escalation_grounding(db_region: str, disease: str) -> dict:
    """Trajectory framing for the escalation/hotspot priority surface."""
    insight = api._ai_insight_grounding(db_region, disease)
    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "escalation": _escalation_row(db_region, disease),
        "next_month_forecast": insight["next_month_forecast"],
        "next_month_risk_level": insight["next_month_risk_level"],
        "outbreak_signal": insight["upcoming_season_probe"]["outbreak_signal"],
        "forecast_error_MAPE_pct": (
            insight["validation"]["MAPE_pct"] if insight["validation"] else None
        ),
    }


def _report_summary_grounding(db_region: str, disease: str) -> dict:
    """Per-region block printed in the exported surveillance PDF report."""
    insight = api._ai_insight_grounding(db_region, disease)

    metrics = None
    mrow = api._METRICS[
        (api._METRICS["region_code"] == db_region) & (api._METRICS["disease"] == disease)
    ]
    primary = mrow[mrow["window"] == api.PRIMARY_WINDOW]
    if not primary.empty:
        mrow_primary = primary.iloc[0]
        metrics = {
            "MAPE_pct": round(float(mrow_primary["MAPE"]), 2),
            "MAE_cases": round(float(mrow_primary["MAE"]), 1),
            "RMSE_cases": round(float(mrow_primary["RMSE"]), 1),
            "months_validated": int(mrow_primary["months"]),
        }

    return {
        "region": api._label(db_region),
        "disease": disease,
        "climate": api._climate_annotation(db_region),
        "latest_month": insight["latest_month"],
        "next_month_forecast": insight["next_month_forecast"],
        "next_month_risk_level": insight["next_month_risk_level"],
        "escalation": _escalation_row(db_region, disease),
        "outbreak_signal": insight["upcoming_season_probe"]["outbreak_signal"],
        "forecast_validation": metrics,
    }


# ---------------------------------------------------------------------------
# Surface definitions. `user` is a template formatted with `disease`; grounding
# is a callable so it is only built for scenarios actually being generated.
# ---------------------------------------------------------------------------

_PER_SERIES_BUILDERS: dict[str, dict] = {
    "ai_insight": {
        "system": api._AI_INSIGHT_SYSTEM_PROMPT,
        "grounding": api._ai_insight_grounding,
        "user": "Give the one-line insight for this region's next month. "
        "Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
    "analysis": {
        "system": api._ANALYSIS_SYSTEM_PROMPT,
        "grounding": lambda r, d: api._build_grounding(r, d, api.PRIMARY_WINDOW),
        "user": "Explain the current {disease} situation for this region. "
        "Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
    "compare": {
        "system": _COMPARE_SYSTEM_PROMPT,
        "grounding": _compare_grounding,
        "user": "The user is comparing this region against the rest of the "
        "country on the Compare page. Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        # Grounding is recorded counts plus the peer ranking only.
        "forecast_bearing": False,
    },
    "reported": {
        "system": _REPORTED_SYSTEM_PROMPT,
        "grounding": _reported_grounding,
        "user": "The user is looking at the reported-case breakdown for this "
        "region. Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        # Purely descriptive: who was reported, by age and sex.
        "forecast_bearing": False,
    },
    "chart_takeaway": {
        "system": _CHART_TAKEAWAY_SYSTEM_PROMPT,
        "grounding": _chart_takeaway_grounding,
        "user": "The user is looking at the '{component}' chart for this "
        "region. {focus}Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        # Decomposition of recorded months only - no future figure anywhere.
        "forecast_bearing": False,
    },
    "kpi_takeaway": {
        "system": _KPI_TAKEAWAY_SYSTEM_PROMPT,
        "grounding": _kpi_takeaway_grounding,
        "user": "The user is looking at this region's headline {disease} "
        "figure and the trend around it. Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
    "escalation": {
        "system": _ESCALATION_SYSTEM_PROMPT,
        "grounding": _escalation_grounding,
        "user": "The user is looking at the escalation priority list for "
        "{disease}, which ranks regions by forecast upward movement. Figures "
        "you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
    "report_summary": {
        "system": _REPORT_SUMMARY_SYSTEM_PROMPT,
        "grounding": _report_summary_grounding,
        "user": "This region's {disease} figures are being exported into a "
        "surveillance report. Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
}

_NATIONAL_BUILDERS: dict[str, dict] = {
    "national": {
        "system": _NATIONAL_SYSTEM_PROMPT,
        "grounding": _national_grounding,
        "user": "The user is looking at the national surveillance picture. "
        "Figures you may use:\n{g}",
        "safe_fn": api._safe_season_narrative,
        "forecast_bearing": True,
    },
}


def _build_one(surface: str, spec: dict, db_region: str, label: str,
               disease: str, component: str) -> Scenario | None:
    """Build one scenario, or None when the series is too sparse to narrate.

    A handful of (region, disease) pairs - rare diseases in low-count regions,
    e.g. Cholera in BARMM - never reach MIN_TRAIN_MONTHS, so they have no
    validation metrics and the grounding builders raise 404. There is nothing
    to explain for such a series, and it must not abort the corpus run for
    every other series, so the pair is skipped here.
    """
    try:
        grounding = spec["grounding"](db_region, disease)
    except HTTPException:
        return None
    focus = ""
    if surface == "chart_takeaway":
        focus = api._SEASONALITY_FOCUS[component].format(disease=disease) + " "
    user = spec["user"].format(
        disease=disease,
        component=component,
        focus=focus,
        g=json.dumps(grounding, default=str),
    )
    return Scenario(
        surface=surface,
        region=label,
        disease=disease,
        component=component,
        system=spec["system"].format(disease=disease),
        user=user,
        grounding=grounding,
        safe_fn=spec["safe_fn"],
        forecast_bearing=spec.get("forecast_bearing", False),
    )


def per_series_scenarios(db_region: str, label: str, disease: str,
                         surfaces: Iterable[str] | None = None) -> Iterator[Scenario]:
    """Every per-series narrative surface for one (region, disease)."""
    wanted = set(surfaces) if surfaces else set(PER_SERIES_SURFACES)
    for surface in PER_SERIES_SURFACES:
        if surface not in wanted:
            continue
        spec = _PER_SERIES_BUILDERS[surface]
        components = SEASONALITY_COMPONENTS if surface == "chart_takeaway" else ("",)
        for component in components:
            scenario = _build_one(surface, spec, db_region, label, disease, component)
            if scenario is not None:
                yield scenario


def national_scenarios(db_region: str, label: str, disease: str,
                       surfaces: Iterable[str] | None = None) -> Iterator[Scenario]:
    """National-only narrative surfaces (one per disease, no per-region split)."""
    wanted = set(surfaces) if surfaces else set(NATIONAL_SURFACES)
    for surface in NATIONAL_SURFACES:
        if surface not in wanted:
            continue
        scenario = _build_one(surface, _NATIONAL_BUILDERS[surface], db_region, label,
                              disease, "")
        if scenario is not None:
            yield scenario


def all_scenarios(diseases: Iterable[str], surfaces: Iterable[str] | None = None,
                  regions: Iterable[str] | None = None) -> Iterator[Scenario]:
    """Walk the full matrix. `regions` filters by region code (None = all)."""
    wanted = set(surfaces) if surfaces else set(ALL_SURFACES)
    codes = [m["code"] for m in db.REGION_META]
    if regions is not None:
        keep = set(regions)
        codes = [c for c in codes if c in keep]

    for code in codes:
        label = api._label(code)
        db_region = api._resolve_region(label)
        if db_region is None:
            continue
        for disease in diseases:
            yield from per_series_scenarios(db_region, label, disease, wanted)

    # National surfaces run once per disease against the national series.
    if set(NATIONAL_SURFACES) & wanted:
        for disease in diseases:
            yield from national_scenarios(
                db.NATIONAL_CODE, db.NATIONAL_NAME, disease, wanted
            )
