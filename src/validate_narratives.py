"""Deterministic narrative-fidelity corpus (methodology 3.5.3).

Audits every narrative surface through the exact constrained path the API uses,
applies the weather-lexicon and numeric-fidelity guards, and records both the
pre-guard model output and the post-guard dispatched output.

Scenarios come from `narrative_surfaces` - the same registry
`generate_narratives.py` iterates to produce the shipped corpus - so what is
audited is by construction what is dispatched.

The claim verified here is structural, not sampled: production dispatch only
happens after the guards pass, or after a deterministic templated fallback
built from the same grounding payload, so no unverified figure is dispatched.
The report documents violations intercepted and fallbacks fired.

Run (live; needs GROQ_API_KEY set in the environment or .env):
    python -m src.validate_narratives                    # full corpus
    python -m src.validate_narratives --limit 8          # small slice
    python -m src.validate_narratives --disease Dengue    # one disease
    python -m src.validate_narratives --skip-live        # dry run, no API calls

Output:
    data/processed/narrative_fidelity_corpus.csv
"""

from __future__ import annotations

import argparse
import time

import pandas as pd

from . import api, db, ingest, narrative_surfaces

SEASONALITY_COMPONENTS = narrative_surfaces.SEASONALITY_COMPONENTS


def _explain_element_scenarios(diseases):
    """explain_element is on-demand and keyed off a client-supplied payload, so
    it has no registry entry. Audit it against a representative payload instead
    of skipping it - the guards are what make the endpoint safe at runtime."""
    for code in [m["code"] for m in db.REGION_META] + [db.NATIONAL_CODE]:
        label = api._label(code)
        db_region = api._resolve_region(label)
        if db_region is None:
            continue
        for disease in diseases:
            insight = api._ai_insight_grounding(db_region, disease)
            element = {
                "title": f"{label} forecast element",
                "description": (
                    f"Shows the predicted {disease} case count for this region "
                    "compared with its historical alert levels."
                ),
                "region": label,
                "month": None,
                "illness": disease,
                "metric_value": (
                    f"{int(round(float(insight['next_month_forecast']['yhat'])))} cases"
                ),
            }
            yield narrative_surfaces.Scenario(
                surface="explain_element",
                region=label,
                disease=disease,
                component="",
                system=api._EXPLAIN_ELEMENT_SYSTEM_PROMPT,
                user=(
                    f"Element Title: {element['title']}\n"
                    f"Static Description: {element['description']}\n"
                    f"Region: {element['region']}\n"
                    f"Current Metric/Value: {element['metric_value']}\n"
                ),
                grounding=element,
                safe_fn=api._safe_element_narrative,
            )


def _scenarios(diseases=(api.DISEASE_DEFAULT,), surfaces=None):
    """Every audited scenario: the registry's pre-generated surfaces plus the
    on-demand explain-element endpoint."""
    yield from narrative_surfaces.all_scenarios(diseases, surfaces)
    yield from _explain_element_scenarios(diseases)


def run(limit=None, sleep_s=0.2, skip_live=False, diseases=None, surfaces=None):
    """Generate the corpus, apply both guards, and audit the dispatched text."""
    rows = []
    weather_hits = 0
    numeric_hits = 0
    speculative_hits = 0
    unanchored_hits = 0
    fallbacks = 0
    generated = 0
    errors = 0
    dispatched_unverified = 0

    wanted = tuple(diseases) if diseases else (api.DISEASE_DEFAULT,)

    # Materialise the scenario list up front. A grounding builder that raises
    # (a region with no forecast rows, say) must be reported as one error row,
    # not escape `run()` and kill the whole corpus: previously the generator
    # was advanced by the `for` below, outside the `try`, so a single TypeError
    # aborted the run before the CSV was ever written.
    planned = []
    iterator = enumerate(_scenarios(wanted, surfaces))
    while True:
        if limit is not None and len(planned) >= limit:
            break
        try:
            i, s = next(iterator)
        except StopIteration:
            break
        except Exception as exc:  # noqa: PERF203 - scenario builder failure
            planned.append((len(planned), None, f"{type(exc).__name__}: {exc}"))
            break
        planned.append((i, s, ""))

    for i, s, build_error in planned:
        if build_error:
            errors += 1
            rows.append(
                {
                    "scenario": i,
                    "endpoint": "scenario_build",
                    "region": "",
                    "disease": "",
                    "component": "",
                    "model": "error",
                    "error": build_error,
                    "weather_violations": "",
                    "numeric_violations": "",
                    "speculative_violations": "",
                    "unanchored_violations": "",
                    "fallback_fired": "",
                    "dispatched_unverified": "",
                }
            )
            continue
        try:
            if skip_live:
                narrative = s.safe_fn(s.grounding)
                model = "skip-live"
                weather = api._weather_violation(narrative)
                numbers = api._numeric_violation(narrative, s.grounding)
                speculative = api._speculative_violation(
                    narrative, forecast_bearing=s.forecast_bearing
                )
                unanchored = (
                    api._unanchored_now_violation(narrative)
                    if s.grounding.get("as_of")
                    else ()
                )
                fallback = False
            else:
                (
                    narrative,
                    model,
                    fallback,
                    weather,
                    numbers,
                    speculative,
                    unanchored,
                ) = api._guarded_narrative(
                    s.system, s.user, s.grounding, s.safe_fn,
                    forecast_bearing=s.forecast_bearing,
                )
            generated += 0 if skip_live else 1
        except Exception as exc:
            errors += 1
            rows.append(
                {
                    "scenario": i,
                    "endpoint": s.surface,
                    "region": s.region,
                    "disease": s.disease,
                    "component": s.component,
                    "model": "error",
                    "error": f"{type(exc).__name__}: {exc}",
                    "weather_violations": "",
                    "numeric_violations": "",
                    "speculative_violations": "",
                    "unanchored_violations": "",
                    "fallback_fired": "",
                    "dispatched_unverified": "",
                }
            )
            continue

        if weather or numbers or speculative or unanchored:
            fallbacks += 1
        weather_hits += len(weather)
        numeric_hits += len(numbers)
        speculative_hits += len(speculative)
        unanchored_hits += len(unanchored)

        # Structural guarantee audit: re-check the DISPATCHED text independently.
        post_weather = api._weather_violation(narrative)
        post_numbers = api._numeric_violation(narrative, s.grounding)
        post_speculative = api._speculative_violation(
            narrative, forecast_bearing=s.forecast_bearing
        )
        post_unanchored = (
            api._unanchored_now_violation(narrative)
            if s.grounding.get("as_of")
            else ()
        )
        unverified = (
            len(post_weather) + len(post_numbers)
            + len(post_speculative) + len(post_unanchored)
        )
        dispatched_unverified += unverified

        rows.append(
            {
                "scenario": i,
                "endpoint": s.surface,
                "region": s.region,
                "disease": s.disease,
                "component": s.component,
                "model": model,
                "error": "",
                "weather_violations": ",".join(map(str, weather)),
                "numeric_violations": ",".join(f"{n:g}" for n in numbers),
                "speculative_violations": ",".join(map(str, post_speculative)),
                "unanchored_violations": ",".join(map(str, post_unanchored)),
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
        f"\nspeculative phrases  : {speculative_hits}"
        f"\nunanchored phrases  : {unanchored_hits}"
        f"\nfallbacks fired      : {fallbacks}"
        f"\nunverified numbers   : {dispatched_unverified}   (dispatched output, structural guarantee)"
    )
    for column, title in (
        ("numeric_violations", "Numeric violations by scenario"),
        ("speculative_violations", "Speculative phrases by scenario"),
        ("unanchored_violations", "Unanchored present-tense by scenario"),
    ):
        if df.empty or column not in df or not df[column].notna().any():
            continue
        flagged = df[df[column].astype(str) != ""]
        if not flagged.empty:
            print(f"\n{title}:")
            print(
                flagged[
                    ["endpoint", "region", "disease", "component", column]
                ].to_string(index=False)
            )
    return df


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--limit", type=int, default=None,
                        help="only the first N scenarios")
    parser.add_argument("--sleep", type=float, default=0.2,
                        help="seconds between LLM calls")
    parser.add_argument("--skip-live", action="store_true",
                        help="dry run, no API calls")
    parser.add_argument("--disease", action="append", default=None,
                        help="disease to audit (repeatable); defaults to Dengue only")
    parser.add_argument("--surface", default=None,
                        help="comma-separated surface subset")
    args = parser.parse_args()

    api._load_all_data()
    run(
        limit=args.limit,
        sleep_s=args.sleep,
        skip_live=args.skip_live,
        diseases=args.disease,
        surfaces=args.surface.split(",") if args.surface else None,
    )


if __name__ == "__main__":
    main()
