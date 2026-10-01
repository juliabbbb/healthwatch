"""Generate the pre-generated AI narrative corpus (methodology 3.5.3).

Every narrative surface the dashboard renders is produced here, offline, through
the exact constrained path the API uses (`api._guarded_narrative`) so both
deterministic guards - the weather/monsoon lexicon and the numeric-fidelity
check - apply before anything is written. The API serves the shipped corpus
instead of calling the provider per request, which is why these pages no longer
depend on a live API key or a warm quota.

The run is resumable: every row is appended to
`data/processed/narratives.csv` as it completes, and a restart skips keys
already present. A free-tier rate limit pauses the run rather than aborting it.

Run (live; needs GROQ_API_KEY set in the environment or .env):
    python -m src.generate_narratives                # full matrix
    python -m src.generate_narratives --limit 20     # first N scenarios
    python -m src.generate_narratives --surface compare,reported
    python -m src.generate_narratives --force        # ignore existing rows
    python -m src.generate_narratives --dry-run      # plan only, no API calls

Only model-written text is persisted. When the output guard trips, the run
retries with the rule restated and, if it still fails, writes nothing for that
key rather than shipping the deterministic templated fallback - the dashboard
labels this corpus "AI-generated", so the client falls back to its static copy
instead.

Output:
    data/processed/narratives.csv
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone

import pandas as pd

from . import api, db, ingest, narrative_surfaces
from .narrative_surfaces import Scenario

CSV_NAME = "narratives.csv"

COLUMNS = [
    "region_code",
    "region",
    "disease",
    "surface",
    "component",
    "narrative",
    "model",
    "fallback_fired",
    "weather_violations",
    "numeric_violations",
    "generated_at",
]

# Rate-limit handling: the API trips a shared cooldown, so a 429 here is
# expected rather than exceptional. Back off, then keep going.
_MAX_RATE_LIMIT_RETRIES = 6
_RATE_LIMIT_BACKOFF_S = 90

# Guard-failure handling. `_guarded_narrative` swaps in a deterministic
# templated sentence when the model breaks the season-wording or numeric rules.
# That text is correct but is NOT model-written, and the dashboard labels this
# corpus "AI-generated" - so it must never be persisted. Retry with the rule
# restated, and if the model still breaks it, write nothing at all: the key stays
# absent, the client falls back to its static copy, and the next run retries it.
_MAX_GUARD_RETRIES = 3

_GUARD_NUDGE = (
    "\n\nIMPORTANT - your previous attempt was rejected by the output guard. "
    "Rewrite it from scratch. Do not use the words rain, rainy, rainfall, rains, "
    "monsoon, habagat, amihan, typhoon, thunderstorm, wet season or dry season, "
    "and do not state any number that is not present in the figures above."
)


def _path():
    return ingest.PROCESSED_DIR / CSV_NAME


def load_existing() -> pd.DataFrame:
    path = _path()
    if not path.exists():
        return pd.DataFrame(columns=COLUMNS)
    try:
        df = pd.read_csv(path, dtype=str).fillna("")
    except Exception:
        return pd.DataFrame(columns=COLUMNS)
    for col in COLUMNS:
        if col not in df.columns:
            df[col] = ""
    return df[COLUMNS]


def existing_keys(df: pd.DataFrame) -> set[tuple[str, str, str, str]]:
    if df.empty:
        return set()
    return set(
        zip(
            df["region_code"].astype(str),
            df["disease"].astype(str),
            df["surface"].astype(str),
            df["component"].astype(str),
        )
    )


def _row_for(scenario: Scenario, narrative: str, model: str, fallback: bool,
             weather, numbers) -> dict:
    return {
        "region_code": db.region_label_to_code(scenario.region) or scenario.region,
        "region": scenario.region,
        "disease": scenario.disease,
        "surface": scenario.surface,
        "component": scenario.component,
        "narrative": narrative,
        "model": model,
        "fallback_fired": bool(fallback),
        "weather_violations": ",".join(map(str, weather)),
        "numeric_violations": ",".join(f"{n:g}" for n in numbers),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def _append(row: dict) -> None:
    """Append one row immediately so an interrupted run keeps its work."""
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists()
    pd.DataFrame([row], columns=COLUMNS).to_csv(
        path, mode="a" if exists else "w",
        header=not exists, index=False, lineterminator="\n",
    )


def _plan(diseases, surfaces, regions):
    return list(
        narrative_surfaces.all_scenarios(
            diseases=diseases, surfaces=surfaces, regions=regions
        )
    )


def run(diseases=None, surfaces=None, regions=None, limit=None,
        sleep_s=1.5, force=False, dry_run=False):
    diseases = diseases or list(api.SUPPORTED_DISEASES)
    surface_filter = set(surfaces) if surfaces else None

    api._load_all_data()
    planned = _plan(diseases, surface_filter, regions)

    existing = load_existing()
    have = existing_keys(existing)
    if force:
        have = set()

    todo = []
    for scenario in planned:
        code = db.region_label_to_code(scenario.region) or scenario.region
        key = (code, scenario.disease, scenario.surface, scenario.component)
        if key in have:
            continue
        todo.append(scenario)
        if limit is not None and len(todo) >= limit:
            break

    print(f"Matrix      : {len(planned)} scenarios "
          f"({len(diseases)} diseases x {len(surface_filter or narrative_surfaces.ALL_SURFACES)} surfaces)")
    print(f"Already have: {len(planned) - len(todo)}")
    print(f"To generate : {len(todo)}")

    if dry_run:
        for scenario in todo[:20]:
            print(f"  - {scenario.surface:<16} {scenario.disease:<22} "
                  f"{scenario.region} {scenario.component}")
        if len(todo) > 20:
            print(f"  ... and {len(todo) - 20} more")
        print("\nDRY RUN: no API calls made.")
        return existing

    written = 0
    rejected = 0
    weather_hits = 0
    numeric_hits = 0
    errors = 0
    rate_limit_waits = 0

    for index, scenario in enumerate(todo, start=1):
        narrative = ""
        model = ""
        weather = ()
        numbers = ()
        user_prompt = scenario.user

        for attempt in range(_MAX_GUARD_RETRIES + 1):
            rate_limit_retries = 0
            while True:
                try:
                    (
                        narrative,
                        model,
                        used_fallback,
                        weather,
                        numbers,
                    ) = api._guarded_narrative(
                        scenario.system, user_prompt, scenario.grounding,
                        scenario.safe_fn,
                    )
                    break
                except Exception as exc:  # noqa: PERF203 - per-scenario resilience
                    message = str(exc).lower()
                    is_rate_limit = any(
                        term in message
                        for term in ("429", "rate limit", "quota", "tokens per minute")
                    )
                    if is_rate_limit and rate_limit_retries < _MAX_RATE_LIMIT_RETRIES:
                        rate_limit_retries += 1
                        rate_limit_waits += 1
                        print(f"[{index}/{len(todo)}] rate limited - "
                              f"sleeping {_RATE_LIMIT_BACKOFF_S}s (retry "
                              f"{rate_limit_retries}/{_MAX_RATE_LIMIT_RETRIES})",
                              flush=True)
                        time.sleep(_RATE_LIMIT_BACKOFF_S)
                        continue
                    errors += 1
                    print(f"[{index}/{len(todo)}] ERROR {scenario.surface}/"
                          f"{scenario.disease}/{scenario.region}: "
                          f"{type(exc).__name__}: {exc}", flush=True)
                    narrative = ""
                    used_fallback = False
                    weather = ()
                    numbers = ()
                    break

            if not narrative or not used_fallback:
                break

            # Guard tripped. Do not ship the templated fallback as an "AI"
            # narrative; restate the rule and let the model try again. Violations
            # are counted once per attempt, including the ones that later pass.
            weather_hits += len(weather)
            numeric_hits += len(numbers)
            if attempt < _MAX_GUARD_RETRIES:
                print(f"[{index}/{len(todo)}] guard violation "
                      f"(weather={list(weather)} numeric={list(numbers)}) - "
                      f"retrying {attempt + 1}/{_MAX_GUARD_RETRIES}", flush=True)
                user_prompt = scenario.user + _GUARD_NUDGE
                continue

            rejected += 1
            print(f"[{index}/{len(todo)}] REJECTED {scenario.surface}/"
                  f"{scenario.disease}/{scenario.region}: model failed the "
                  f"output guard {_MAX_GUARD_RETRIES + 1}x "
                  f"(weather={list(weather)} numeric={list(numbers)}). "
                  f"Nothing written; the client uses its static copy.", flush=True)
            narrative = ""
            break

        if narrative:
            _append(
                _row_for(scenario, narrative, model, False, (), ())
            )
            written += 1

        if index % 10 == 0 or index == len(todo):
            print(f"[{index}/{len(todo)}] written={written} "
                  f"rejected={rejected} errors={errors}", flush=True)

        if sleep_s > 0:
            time.sleep(sleep_s)

    final = load_existing()
    print(f"\nWrote {written} new rows -> {_path()}")
    print(f"corpus total : {len(final)}")
    print(f"rejected     : {rejected}")
    print(f"weather hits : {weather_hits}")
    print(f"numeric hits : {numeric_hits}")
    print(f"rate waits   : {rate_limit_waits}")
    print(f"errors       : {errors}")
    print("\nNext: python -m src.db   (mirrors the corpus into Postgres)")
    return final


def main():
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--disease", action="append", default=None,
                        help="disease to generate (repeatable); default all")
    parser.add_argument("--surface", default=None,
                        help="comma-separated surface subset")
    parser.add_argument("--region", action="append", default=None,
                        help="region code filter (repeatable); default all")
    parser.add_argument("--limit", type=int, default=None,
                        help="stop after N newly generated narratives")
    parser.add_argument("--sleep", type=float, default=1.5,
                        help="seconds between provider calls")
    parser.add_argument("--force", action="store_true",
                        help="regenerate even if a row already exists")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the plan without calling the provider")
    args = parser.parse_args()

    run(
        diseases=args.disease,
        surfaces=args.surface.split(",") if args.surface else None,
        regions=args.region,
        limit=args.limit,
        sleep_s=args.sleep,
        force=args.force,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
