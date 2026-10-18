"""Deterministic narrative-fidelity corpus (methodology 3.5.3).

Generates one narrative per (endpoint, region[, seasonality component])
through the exact constrained path the API uses, then applies the weather-
lexicon and numeric-fidelity guards and records both the pre-guard model
output and the post-guard dispatched output.

The claim verified here is structural, not sampled: production dispatch only
happens after the guards pass, or after a deterministic templated fallback
built from the same grounding payload, so no unverified figure is dispatched.
The report documents violations intercepted and fallbacks fired.

Run (live; needs GROQ_API_KEY set in the environment or .env):
    python -m src.validate_narratives            # full corpus: 19 x (1+1+5+1) = 152 narratives
    python -m src.validate_narratives --limit 8  # small slice (first N scenarios)
    python -m src.validate_narratives --skip-live  # dry run: no API calls, reports plan only

Output:
    data/processed/narrative_fidelity_corpus.csv
"""

import argparse
import json
import math
import time

import pandas as pd

from . import db, ingest
from . import api

SEASONALITY_COMPONENTS = ("observed", "trend", "seasonal", "residual", "acf")


def _scenarios():
    codes = [m["code"] for m in db.REGION_META] + [db.NATIONAL_CODE]
    disease = api.DISEASE_DEFAULT
    for code in codes:
        label = api._label(code)
        db_region = api._resolve_region(label)  # National resolves by name, not code

        # 1. ai-insight (one-line map panel)
        grounding = api._ai_insight_grounding(db_region, disease)
        yield {
            "endpoint": "ai_insight",
            "region": label,
            "component": "",
            "system": api._AI_INSIGHT_SYSTEM_PROMPT,
            "user": "Give the one-line insight for this region's next month. "
            "Figures you may use:\n" + json.dumps(grounding),
            "grounding": grounding,
            "safe_fn": api._safe_season_narrative,
        }

        # 2. full analysis narrative
        grounding = api._build_grounding(db_region, disease, api.PRIMARY_WINDOW)
        yield {
            "endpoint": "analysis",
            "region": label,
            "component": "",
            "system": api._ANALYSIS_SYSTEM_PROMPT,
            "user": "Explain the current dengue situation for this region. "
            "Figures you may use:\n" + json.dumps(grounding),
            "grounding": grounding,
            "safe_fn": api._safe_season_narrative,
        }

        # 3. seasonality, one scenario per component
        grounding = api._seasonality_grounding(db_region)
        grounding["disease"] = disease
        for component in SEASONALITY_COMPONENTS:
            yield {
                "endpoint": "seasonality",
                "region": label,
                "component": component,
                "system": api._SEASONALITY_SYSTEM_PROMPT,
                "user": (
                    f"The user is looking at the '{component}' chart for this region. "
                    f"{api._SEASONALITY_FOCUS[component]} Figures you may use:\n"
                    + json.dumps(grounding)
                ),
                "grounding": grounding,
                "safe_fn": api._safe_season_narrative,
            }

        # 4. click-to-explain element (on the same forecast the insight used)
        insight = api._ai_insight_grounding(db_region, disease)
        element = {
            "title": f"{label} forecast element",
            "description": "Shows the predicted dengue case count for this region "
            "compared with its historical alert levels.",
            "region": label,
            "month": None,
            "illness": "Dengue",
            "metric_value": f"{int(round(float(insight['forecast']['yhat'])))} cases",
        }
        yield {
            "endpoint": "explain_element",
            "region": label,
            "component": "",
            "system": api._EXPLAIN_ELEMENT_SYSTEM_PROMPT,
            "user": (
                f"Element Title: {element['title']}\n"
                f"Static Description: {element['description']}\n"
                f"Region: {element['region']}\n"
                f"Current Metric/Value: {element['metric_value']}\n"
            ),
            "grounding": element,
            "safe_fn": api._safe_element_narrative,
        }


def run(limit=None, sleep_s=0.2, skip_live=False):
    """Generate the corpus, apply both guards, and audit the dispatched text."""
    rows = []
    weather_hits = 0
    numeric_hits = 0
    fallbacks = 0
    generated = 0
    errors = 0
    dispatched_unverified = 0

    for i, s in enumerate(_scenarios()):
        if limit is not None and i >= limit:
            break
        try:
            if skip_live:
                narrative = api._safe_season_narrative(s["grounding"])
                model = "skip-live"
                weather = api._weather_violation(narrative)
                numbers = api._numeric_violation(narrative, s["grounding"])
                fallback = False
            else:
                narrative, model, fallback, weather, numbers = api._guarded_narrative(
                    s["system"], s["user"], s["grounding"], s["safe_fn"]
                )
            generated += 0 if skip_live else 1
        except Exception as exc:
            errors += 1
            rows.append(
                {
                    "scenario": i,
                    "endpoint": s["endpoint"],
                    "region": s["region"],
                    "component": s["component"],
                    "model": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                    "weather_violations": "",
                    "numeric_violations": "",
                    "fallback_fired": "",
                    "dispatched_unverified": "",
                }
            )
            continue

        if weather or numbers:
            fallbacks += 1
        weather_hits += len(weather)
        numeric_hits += len(numbers)

        # Structural guarantee audit: re-check the DISPATCHED text independently.
        post_weather = api._weather_violation(narrative)
        post_numbers = api._numeric_violation(narrative, s["grounding"])
        unverified = len(post_weather) + len(post_numbers)
        dispatched_unverified += unverified

        rows.append(
            {
                "scenario": i,
                "endpoint": s["endpoint"],
                "region": s["region"],
                "component": s["component"],
                "model": model,
                "error": "",
                "weather_violations": ",".join(map(str, weather)),
                "numeric_violations": ",".join(f"{n:g}" for n in numbers),
                "fallback_fired": bool(fallback),
                "dispatched_unverified": int(unverified),
            }
        )
        time.sleep(sleep_s)

    df = pd.DataFrame(rows)
    path = ingest.save_processed(df, "narrative_fidelity_corpus.csv")
    print(f"Saved {len(df)} corpus rows -> {path}")

    if skip_live:
        print("\nDRY RUN (--skip-live): no LLM calls were made.")
    print(
        f"scenarios           : {len(df)}"
        f"\nmodel narratives     : {generated}"
        f"\nrun errors           : {errors}"
        f"\nweather violations   : {weather_hits}"
        f"\nnumeric violations   : {numeric_hits}"
        f"\nfallbacks fired      : {fallbacks}"
        f"\nunverified numbers   : {dispatched_unverified}   (dispatched output, structural guarantee)"
    )
    if df["numeric_violations"].notna().any():
        flagged = df[df["numeric_violations"].astype(str) != ""]
        if not flagged.empty:
            print("\nNumeric violations by scenario:")
            print(flagged[["endpoint", "region", "component", "numeric_violations"]].to_string(index=False))
    return df


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="only the first N scenarios")
    parser.add_argument("--sleep", type=float, default=0.2, help="seconds between LLM calls")
    parser.add_argument("--skip-live", action="store_true", help="dry run, no API calls")
    args = parser.parse_args()

    api._load_all_data()
    run(limit=args.limit, sleep_s=args.sleep, skip_live=args.skip_live)


if __name__ == "__main__":
    main()