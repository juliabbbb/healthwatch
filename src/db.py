"""Relational database layer for the monthly pipeline.

Builds and reads the HEALTHWATCH schema (the ERD source of truth — 12 tables)
through SQLAlchemy against a Supabase PostgreSQL server. Requires DATABASE_URL
to be set in the environment. This is the only relational store: the SQLite
fallback was removed, so every component reads from this PostgreSQL database.

The pipeline never hand-writes tables: `build_db()` drops and recreates rows
from the processed CSVs, so a rebuild is fully idempotent. Because this module
parses the repo .env itself, both the API and the CLI rebuild pick up
DATABASE_URL regardless of launch context.
"""

import csv
import io
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import pandas as pd
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Float,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    text,
)

from . import ingest
from .doh_eb_ingest import REGION_LABELS, load_case_records
from .fwbd_ingest import load_fwbd_case_records


def _load_env():
    """Populate os.environ from a repo-root .env file (KEY=VALUE lines).

    Existing environment variables always win, so a real shell/export still
    takes precedence. Keeps secrets (DATABASE_URL, API keys) out of the
    codebase (.env is git-ignored)."""
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


_load_env()

# Canonical region metadata (18 regions incl. NIR) — shared by the DB seed and
# the API. geoName matches the GeoJSON feature label used for map fills.
REGION_META = [
    {"code": "130000000", "name": "National Capital Region", "short": "NCR", "island": "Luzon", "geoName": "Metropolitan Manila", "lat": 14.5995, "lng": 120.9842, "classification": "Urban", "density": 16133, "population": 13948428},
    {"code": "140000000", "name": "Cordillera Administrative Region", "short": "CAR", "island": "Luzon", "geoName": "Cordillera Administrative Region (CAR)", "lat": 17.35, "lng": 121.1, "classification": "Predominantly rural", "density": 88, "population": 1797660},
    {"code": "010000000", "name": "Ilocos Region", "short": "Region I", "island": "Luzon", "geoName": "Ilocos Region (Region I)", "lat": 16.6, "lng": 120.45, "classification": "Rural-urban mix", "density": 330, "population": 5095638},
    {"code": "020000000", "name": "Cagayan Valley", "short": "Region II", "island": "Luzon", "geoName": "Cagayan Valley (Region II)", "lat": 17.0, "lng": 121.8, "classification": "Rural-urban mix", "density": 116, "population": 3596371},
    {"code": "030000000", "name": "Central Luzon", "short": "Region III", "island": "Luzon", "geoName": "Central Luzon (Region III)", "lat": 15.4, "lng": 120.7, "classification": "Rural-urban mix", "density": 331, "population": 12542300},
    {"code": "040000000", "name": "CALABARZON", "short": "Region IV-A", "island": "Luzon", "geoName": "CALABARZON (Region IV-A)", "lat": 14.1, "lng": 121.3, "classification": "Rural-urban mix", "density": 844, "population": 16839300},
    {"code": "170000000", "name": "MIMAROPA", "short": "Region IV-B", "island": "Luzon", "geoName": "MIMAROPA (Region IV-B)", "lat": 12.3, "lng": 120.9, "classification": "Predominantly rural", "density": 113, "population": 3308513},
    {"code": "050000000", "name": "Bicol Region", "short": "Region V", "island": "Luzon", "geoName": "Bicol Region (Region V)", "lat": 13.4, "lng": 123.4, "classification": "Predominantly rural", "density": 362, "population": 6368117},
    {"code": "450000000", "name": "Negros Island Region", "short": "NIR", "island": "Visayas", "geoName": "Negros Island Region (NIR)", "lat": 10.1, "lng": 122.9, "classification": "Rural-urban mix", "density": 295, "population": 4560784},
    {"code": "060000000", "name": "Western Visayas", "short": "Region VI", "island": "Visayas", "geoName": "Western Visayas (Region VI)", "lat": 11.0, "lng": 122.6, "classification": "Rural-urban mix", "density": 315, "population": 7899799},
    {"code": "070000000", "name": "Central Visayas", "short": "Region VII", "island": "Visayas", "geoName": "Central Visayas (Region VII)", "lat": 10.0, "lng": 123.7, "classification": "Rural-urban mix", "density": 488, "population": 8228200},
    {"code": "080000000", "name": "Eastern Visayas", "short": "Region VIII", "island": "Visayas", "geoName": "Eastern Visayas (Region VIII)", "lat": 11.4, "lng": 125.0, "classification": "Predominantly rural", "density": 124, "population": 5049079},
    {"code": "090000000", "name": "Zamboanga Peninsula", "short": "Region IX", "island": "Mindanao", "geoName": "Zamboanga Peninsula (Region IX)", "lat": 8.0, "lng": 122.9, "classification": "Predominantly rural", "density": 146, "population": 3905345},
    {"code": "100000000", "name": "Northern Mindanao", "short": "Region X", "island": "Mindanao", "geoName": "Northern Mindanao (Region X)", "lat": 8.3, "lng": 124.7, "classification": "Rural-urban mix", "density": 244, "population": 5313423},
    {"code": "110000000", "name": "Davao Region", "short": "Region XI", "island": "Mindanao", "geoName": "Davao Region (Region XI)", "lat": 7.1, "lng": 125.6, "classification": "Urban", "density": 264, "population": 5243536},
    {"code": "120000000", "name": "SOCCSKSARGEN", "short": "Region XII", "island": "Mindanao", "geoName": "SOCCSKSARGEN (Region XII)", "lat": 6.5, "lng": 124.9, "classification": "Rural-urban mix", "density": 231, "population": 4901486},
    {"code": "160000000", "name": "Caraga", "short": "Region XIII", "island": "Mindanao", "geoName": "Caraga (Region XIII)", "lat": 8.9, "lng": 125.7, "classification": "Predominantly rural", "density": 145, "population": 2804788},
    {"code": "150000000", "name": "Bangsamoro (BARMM)", "short": "BARMM", "island": "Mindanao", "geoName": "Autonomous Region of Muslim Mindanao (ARMM)", "lat": 7.2, "lng": 124.2, "classification": "Predominantly rural", "density": 208, "population": 4404288},
]

REGION_CODE_BY_NAME = {r["name"]: r["code"] for r in REGION_META}
NATIONAL_CODE = "000000000"
NATIONAL_NAME = "National"

# Population data is sourced from the PSA census export in data/raw/
# (region_population.csv) instead of being hardcoded. The loader locates each
# region's total row inside the raw multi-block layout and reads the population
# for the selected census year; REGION_META["population"] is then overridden so
# every consumer (API, DB seed) picks up the latest figures.
POPULATION_CSV = Path(__file__).resolve().parent.parent / "data" / "raw" / "region_population.csv"
POPULATION_CENSUS_YEAR = 2024
_POPULATION_COL_BY_YEAR = {2010: 2, 2015: 3, 2020: 4, 2024: 5}
_CENSUS_TITLE_SUFFIX = ": 2010, 2015, 2020, AND 2024 POPULATION CENSUSES"


def _load_population_by_code():
    """Parse the raw PSA census CSV into {region_code: population}.

    Layout: 18 region blocks introduced by a census title row, followed by two
    header rows and the region-total row (columns: name, blank, 2010, 2015,
    2020, 2024, ...). Resolution reuses REGION_LABELS (DOH -> canonical)."""
    if not POPULATION_CSV.exists():
        print(f"[population] {POPULATION_CSV.name} not found; keeping REGION_META populations.", file=sys.stderr)
        return {}
    rows = []
    with open(POPULATION_CSV, newline="", encoding="utf-8-sig") as fh:
        for row in csv.reader(fh):
            if row and row[0].strip().startswith("#"):
                continue
            rows.append(row)
    col = _POPULATION_COL_BY_YEAR[POPULATION_CENSUS_YEAR]
    population = {}
    for i, row in enumerate(rows):
        if not row or not row[0].strip():
            continue
        if not row[0].strip().endswith(_CENSUS_TITLE_SUFFIX):
            continue
        data_row = rows[i + 5] if i + 5 < len(rows) else []
        if len(data_row) < 6 or not data_row[0].strip() or data_row[col].strip() == "":
            print(f"[population] cannot read region total row after {row[0].strip()!r}", file=sys.stderr)
            continue
        raw_name = re.sub(r"\s+\d+$", "", data_row[0].strip())
        canonical = REGION_LABELS.get(raw_name.upper())
        if canonical is None:
            print(f"[population] unmapped region label: {raw_name!r}", file=sys.stderr)
            continue
        code = REGION_CODE_BY_NAME.get(canonical)
        if code is None:
            print(f"[population] no REGION_META entry for {canonical!r}", file=sys.stderr)
            continue
        population[code] = int(data_row[col].replace(",", ""))
    return population


_CSV_POPULATION = _load_population_by_code()
if _CSV_POPULATION:
    _missing = [r["code"] for r in REGION_META if r["code"] not in _CSV_POPULATION]
    for _meta in REGION_META:
        if _meta["code"] in _CSV_POPULATION:
            _meta["population"] = _CSV_POPULATION[_meta["code"]]
    if _missing:
        print(f"[population] regions missing from {POPULATION_CSV.name}: {_missing}", file=sys.stderr)
    print(f"[population] applied {len(_CSV_POPULATION)} region populations ({POPULATION_CENSUS_YEAR} census).")
del _CSV_POPULATION

metadata = MetaData()

regions = Table(
    "regions",
    metadata,
    Column("code", String(9), primary_key=True),
    Column("name", String(80), nullable=False, unique=True),
    Column("short", String(24), nullable=False),
    Column("island", String(16), nullable=False),
    Column("classification", String(32), nullable=False),
    Column("density", Integer, nullable=False),
    Column("population", Integer, nullable=False),
    Column("centroid_lat", Float, nullable=False),
    Column("centroid_lng", Float, nullable=False),
)

monthly_observations = Table(
    "monthly_observations",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("year", Integer, primary_key=True),
    Column("month", Integer, primary_key=True),
    Column("cases", Integer, nullable=False),
    Column("deaths", Integer, nullable=False),
)

forecasts = Table(
    "forecasts",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("target_date", Date, primary_key=True),
    Column("yhat", Float, nullable=False),
    Column("yhat_lower", Float, nullable=False),
    Column("yhat_upper", Float, nullable=False),
)

risk_thresholds = Table(
    "risk_thresholds",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("month", Integer, primary_key=True),
    Column("p50", Float, nullable=False),
    Column("p75", Float, nullable=False),
)

risk_classifications = Table(
    "risk_classifications",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("date", Date, primary_key=True),
    Column("yhat", Float, nullable=False),
    Column("p50", Float, nullable=False),
    Column("p75", Float, nullable=False),
    Column("risk_level", String(12), nullable=False),
)

outbreak_signals = Table(
    "outbreak_signals",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("season", String(6), primary_key=True),
    Column("outbreak", Boolean, nullable=False),
    Column("trigger", String(24), nullable=False),
    Column("consecutive_high_n", Integer, nullable=False),
    Column("season_avg", Float, nullable=False),
    Column("season_p75", Float, nullable=False),
    Column("n_forecast_months", Integer, nullable=False),
)

validation_metrics = Table(
    "validation_metrics",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("window", String(32), primary_key=True),
    Column("MAE", Float, nullable=False),
    Column("RMSE", Float, nullable=False),
    Column("MAPE", Float, nullable=False),
    Column("months", Integer, nullable=False),
    Column("excluded_zero_actual", Integer, nullable=False, default=0),
    Column("naive_MAE", Float),
    Column("skill_vs_naive_pct", Float),
)

walk_forward_folds = Table(
    "walk_forward_folds",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("window", String(32), primary_key=True),
    Column("month", Date, primary_key=True),
    Column("actual", Integer, nullable=False),
    Column("predicted", Float, nullable=False),
)

risk_escalation = Table(
    "risk_escalation",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("rank", Integer, nullable=False),
    Column("tier_climbs", Integer, nullable=False),
    Column("net_climb", Integer, nullable=False),
    Column("n_high_months", Integer, nullable=False),
    Column("first_high_month", String(7), nullable=False),
    Column("final_tier", String(12), nullable=False),
)

outbreak_validation = Table(
    "outbreak_validation",
    metadata,
    Column("region_code", String(9), primary_key=True),
    Column("disease", String(32), primary_key=True),
    Column("season", String(6), primary_key=True),
    Column("forecast_avg", Float, nullable=False),
    Column("actual_avg", Float, nullable=False),
    Column("actual_max", Float, nullable=False),
    Column("season_p75", Float, nullable=False),
    Column("actual_high_run", Integer, nullable=False),
    Column("predicted", Boolean, nullable=False),
    Column("actual_outbreak", Boolean, nullable=False),
    Column("rule_a_actual", Boolean, nullable=False),
    Column("rule_b_actual", Boolean, nullable=False),
    Column("tp", Boolean, nullable=False),
    Column("fp", Boolean, nullable=False),
    Column("fn", Boolean, nullable=False),
    Column("tn", Boolean, nullable=False),
)

pipeline_runs = Table(
    "pipeline_runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("generated_at", String(32), nullable=False),
    Column("data_through", Date, nullable=False),
    Column("version", String(32), nullable=False),
    Column("model", String(64), nullable=False),
    Column("notes", Text),
)

dengue_case_records = Table(
    "dengue_case_records",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("region_code", String(9), nullable=False),
    Column("province", String(120), nullable=False),
    Column("year", Integer, nullable=False),
    Column("morbidity_week", Integer, nullable=False),
    Column("month", Integer, nullable=False),
    Column("age_group", String(24), nullable=False),
    Column("sex", String(8), nullable=False),
    Column("clinical_classification", String(28), nullable=False),
    Column("final_case_classification", String(28), nullable=False),
    Column("admitted", Boolean, nullable=False),
    Column("cases", Integer, nullable=False),
    Column("deaths", Integer, nullable=False),
    Index("ix_dengue_case_records_region_year_month", "region_code", "year", "month"),
)

fwbd_case_records = Table(
    "fwbd_case_records",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("region_code", String(9), nullable=False),
    Column("disease", String(48), nullable=False),
    Column("province", String(160), nullable=False),
    Column("year", Integer, nullable=False),
    Column("month", Integer, nullable=False),
    Column("age_group", String(16), nullable=False),
    Column("sex", String(8), nullable=False),
    Column("case_classification", String(16), nullable=False),
    Column("admitted", Boolean, nullable=False),
    Column("outcome", String(8), nullable=False),
    Column("laboratory_result", String(24), nullable=False),
    Column("organism", String(160), nullable=False),
    Column("cases", Integer, nullable=False),
    Column("deaths", Integer, nullable=False),
    Index("ix_fwbd_case_records_region_year_month", "region_code", "year", "month"),
)


def _require_ssl(url):
    """Ensure the Postgres URL carries sslmode=require (Supabase requires SSL).

    Adds sslmode=require when the URL has no sslmode parameter, keeping any
    existing query params (e.g. ?pgbouncer=true) intact. An existing
    sslmode value always wins."""
    parts = urlsplit(url)
    params = parse_qsl(parts.query)
    if not any(key.lower() == "sslmode" for key, _ in params):
        params.append(("sslmode", "require"))
    return urlunsplit(parts._replace(query=urlencode(params)))


def _engine():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Supabase PostgreSQL connection string is required."
        )
    # Supabase connection-pooler guidance: for Render (persistent, short-lived
    # web workers) use the session pooler on port 5432, or the transaction
    # pooler on port 6543 with ?pgbouncer=true for serverless workloads.
    # sslmode=require is added automatically if the URL omits it.
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    db_url = _require_ssl(db_url)
    eng = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_recycle=300,
        echo=False,
    )
    return eng


def engine():
    """Accessor for the shared PostgreSQL engine. Requires DATABASE_URL to be
    set in the environment — see module docstring."""
    if not hasattr(_engine, "_cached"):
        _engine._cached = _engine()
        with _engine._cached.connect() as conn:
            conn.execute(text("SELECT 1"))
            print("Connected to Supabase PostgreSQL")
            print("Database connection verified.")
    return _engine._cached


def ensure_tables():
    """Idempotent schema bootstrap (create-if-absent, never drops).

    Safe to call on every API startup: keeps tables from drifting on deploy
    hosts where `python -m src.db` was never run directly."""
    eng = engine()
    metadata.create_all(eng)
    return eng


def _region_code(label):
    if label == NATIONAL_NAME:
        return NATIONAL_CODE
    code = REGION_CODE_BY_NAME.get(label)
    if code is None:
        raise ValueError(f"Region '{label}' is not in REGION_META; extend it.")
    return code


def _to_mid(dates, col="target_date"):
    return pd.to_datetime(dates).dt.to_period("M").dt.to_timestamp().dt.date


def _load_csv(name):
    path = ingest.PROCESSED_DIR / name
    if not path.exists():
        return None
    return pd.read_csv(path)


def build_db():
    """(Re)build every table from the processed CSVs. Idempotent: each build
    replaces the previous contents, so a full pipeline rerun fully resyncs it.
    Only the HEALTHWATCH metadata tables are dropped/recreated."""
    eng = engine()
    metadata.drop_all(eng)
    metadata.create_all(eng)

    with eng.begin() as conn:
        conn.execute(
            regions.insert(),
            [
                {
                    "code": r["code"],
                    "name": r["name"],
                    "short": r["short"],
                    "island": r["island"],
                    "classification": r["classification"],
                    "density": r["density"],
                    "population": r["population"],
                    "centroid_lat": r["lat"],
                    "centroid_lng": r["lng"],
                }
                for r in REGION_META
            ],
        )
        conn.execute(
            regions.insert(),
            {
                "code": NATIONAL_CODE,
                "name": NATIONAL_NAME,
                "short": "PH",
                "island": "Philippines",
                "classification": "National aggregate",
                "density": 0,
                "population": sum(r["population"] for r in REGION_META),
                "centroid_lat": 12.8797,
                "centroid_lng": 121.774,
            },
        )

        for name in ingest.MONTHLY_FILES:
            monthly = _load_csv(name)
            if monthly is None:
                continue
            rows = _monthly_observation_rows(monthly)
            if rows:
                conn.execute(monthly_observations.insert(), rows)

        def _remap(df, code_col, date_col=None, drop=None):
            if df is None or df.empty:
                return None
            out = df.copy()
            if code_col not in out.columns:
                out = out.rename(columns={"region": code_col})
            out[code_col] = out[code_col].map(_region_code)
            if date_col:
                out[date_col] = _to_mid(out[date_col])
            if drop:
                out = out.drop(columns=[c for c in drop if c in out.columns])
            return out

        fcst = _remap(_load_csv("forecasts.csv"), "region_code", date_col="target_date")
        if fcst is not None and not fcst.empty:
            conn.execute(forecasts.insert(), fcst.to_dict(orient="records"))

        thr = _remap(_load_csv("risk_thresholds.csv"), "region_code")
        if thr is not None and not thr.empty:
            conn.execute(risk_thresholds.insert(), thr.to_dict(orient="records"))

        cls = _remap(_load_csv("risk_classification.csv"), "region_code", date_col="date")
        if cls is not None and not cls.empty:
            conn.execute(risk_classifications.insert(), cls.to_dict(orient="records"))

        obk = _remap(_load_csv("outbreak_indicators.csv"), "region_code")
        if obk is not None and not obk.empty:
            conn.execute(outbreak_signals.insert(), obk.to_dict(orient="records"))

        vm = _remap(_load_csv("validation_metrics.csv"), "region_code")
        if vm is not None and not vm.empty:
            conn.execute(validation_metrics.insert(), vm.to_dict(orient="records"))

        folds = _load_csv("validation_predictions.csv")
        if folds is not None and not folds.empty:
            folds = folds.rename(columns={"ds": "month", "y": "actual", "yhat": "predicted"})
            folds = _remap(folds, "region_code", date_col="month")
            conn.execute(walk_forward_folds.insert(), folds.to_dict(orient="records"))

        esc = _load_csv("risk_escalation_ranking.csv")
        if esc is not None and not esc.empty:
            # Regions that never reach High store an empty first_high_month;
            # pandas reads the blank as NaN, which psycopg2 would bind as the
            # string 'NaN'. Normalize to "" so the NOT NULL varchar stays clean.
            esc["first_high_month"] = esc["first_high_month"].fillna("")
            esc = _remap(esc, "region_code")
            conn.execute(
                risk_escalation.insert(),
                esc[
                    [
                        "region_code",
                        "disease",
                        "rank",
                        "tier_climbs",
                        "net_climb",
                        "n_high_months",
                        "first_high_month",
                        "final_tier",
                    ]
                ].to_dict(orient="records"),
            )

        ov = _load_csv("outbreak_validation_2025.csv")
        if ov is not None and not ov.empty:
            ov = _remap(ov, "region_code")
            conn.execute(outbreak_validation.insert(), ov.to_dict(orient="records"))

        _seed_case_records(conn)
        _seed_fwbd_case_records(conn)

        # Read each monthly CSV exactly once: the previous comprehension called
        # _load_csv(name) three times per file, tripling disk reads, and
        # pd.concat([]) raised when no file loaded at all.
        frames = [
            df
            for df in (_load_csv(name) for name in ingest.MONTHLY_FILES)
            if df is not None and not df.empty
        ]
        all_dates = (
            pd.concat([df["date"] for df in frames], ignore_index=True)
            if frames
            else pd.Series(dtype="object")
        )
        latest_date = all_dates.max() if not all_dates.empty else None
        conn.execute(
            pipeline_runs.insert(),
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "data_through": (
                    pd.to_datetime(latest_date).date()
                    if latest_date is not None
                    else None
                ),
                "version": "monthly-2018-2026",
                "model": "prophet-monthly",
                "notes": PROVIDENCE_NOTES,
            },
        )

    return eng


def _seed_case_records(conn):
    """Load the raw dengue line-list (2019-2026) into dengue_case_records.

    Kept out of the API's startup hot-load (api.py reads the 8 modelling
    tables only and queries this table on demand through `case_breakdown` for
    the /reported/{region} endpoint). Region label -> PSGC region code via
    REGION_CODE_BY_NAME.

    Loaded with chunked PostgreSQL COPY (STDIN). The Supabase pooler imposes a
    2-minute statement timeout, so a single COPY of all 749k rows is cancelled
    mid-stream; a per-row executemany stays under the timeout but is crippled
    by round-trip latency. 50k-row COPY chunks land safely inside the budget.
    """
    recs = load_case_records()
    if recs is None or recs.empty:
        print("[db] no line-list rows to seed into dengue_case_records.", file=sys.stderr)
        return
    recs["region_code"] = recs["region"].map(REGION_CODE_BY_NAME)
    missing = recs["region_code"].isna().any()
    if missing:
        unknown = sorted(recs.loc[recs["region_code"].isna(), "region"].unique())
        raise ValueError(f"Unmapped case-record regions: {unknown}")
    cols = [
        "region_code", "province", "year", "morbidity_week", "month", "age_group", "sex",
        "clinical_classification", "final_case_classification", "admitted",
        "cases", "deaths",
    ]
    payload = recs[cols]
    stmt = (
        "COPY dengue_case_records (" + ", ".join(cols) + ") "
        "FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N', QUOTE E'\"')"
    )
    chunk = 50000
    done = 0
    for start in range(0, len(payload), chunk):
        sub = payload.iloc[start : start + chunk]
        buf = io.StringIO()
        sub.to_csv(buf, index=False, header=False, sep="\t", na_rep="\\N", lineterminator="\n")
        buf.seek(0)
        cur = conn.connection.cursor()
        try:
            cur.copy_expert(stmt, buf)
        finally:
            cur.close()
        done += len(sub)
        print(f"[db] COPY {done}/{len(payload)} case records -> dengue_case_records")
    print(f"[db] seeded {len(payload)} dengue case records -> dengue_case_records")


def _seed_fwbd_case_records(conn):
    """Load the four FWD line-lists (2018-2026) into fwbd_case_records.

    Same on-demand consumption pattern as dengue_case_records (queried by
    case_breakdown for /reported/{region}?disease=...), same chunked COPY so
    every Supabase statement stays under the pooler's 2-minute timeout."""
    recs = load_fwbd_case_records()
    if recs is None or recs.empty:
        print("[db] no FWD line-list rows to seed into fwbd_case_records.", file=sys.stderr)
        return
    recs["region_code"] = recs["region"].map(REGION_CODE_BY_NAME)
    missing = recs["region_code"].isna().any()
    if missing:
        unknown = sorted(recs.loc[recs["region_code"].isna(), "region"].unique())
        raise ValueError(f"Unmapped FWD case-record regions: {unknown}")
    cols = [
        "region_code", "disease", "province", "year", "month", "age_group", "sex",
        "case_classification", "admitted", "outcome", "laboratory_result",
        "organism", "cases", "deaths",
    ]
    payload = recs[cols]
    stmt = (
        "COPY fwbd_case_records (" + ", ".join(cols) + ") "
        "FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N', QUOTE E'\"')"
    )
    chunk = 50000
    done = 0
    for start in range(0, len(payload), chunk):
        sub = payload.iloc[start : start + chunk]
        buf = io.StringIO()
        sub.to_csv(buf, index=False, header=False, sep="\t", na_rep="\\N", lineterminator="\n")
        buf.seek(0)
        cur = conn.connection.cursor()
        try:
            cur.copy_expert(stmt, buf)
        finally:
            cur.close()
        done += len(sub)
        print(f"[db] COPY {done}/{len(payload)} case records -> fwbd_case_records")
    print(f"[db] seeded {len(payload)} FWD case records -> fwbd_case_records")


PROVIDENCE_NOTES = (
    "Monthly pipeline v3: real DOH case line-lists. Dengue: DOH-EB dengue "
    "line-list 2019-01..2026-08, 92 months, 18 regions incl. NIR, reported "
    "cases = sum of all final classifications. Food/waterborne: four separate "
    "DOH FWD line-lists (Acute Bloody Diarrhea, Cholera, Typhoid Fever, Acute "
    "Viral Hepatitis), 2018-01..2026-09 each on its own per-region grid "
    "(hepatitis through 2025-09), reported cases = Suspect+Probable+Confirmed, "
    "deaths from Outcome. Every disease runs its own production risk tiers on "
    "the full baseline, 2025 prospective validation on the pre-2025 pool, "
    "walk-forward validation refits every month, 2025 probes fit through "
    "2024-12-31 as true prospective holdouts. Reported-data demographics "
    "served on demand from dengue_case_records / fwbd_case_records via "
    "/reported/{region}."
)


def _monthly_observation_rows(regional):
    regional = regional.copy()
    regional["region_code"] = regional["region"].map(_region_code)
    regional["year"] = pd.to_datetime(regional["date"]).dt.year
    regional["month"] = pd.to_datetime(regional["date"]).dt.month
    return regional[["region_code", "disease", "year", "month", "cases", "deaths"]].to_dict(
        orient="records"
    )


def read_table(table):
    with engine().connect() as conn:
        return pd.read_sql_table(table, conn)


# Dimensions exposed by /reported/{region}. Values are the raw line-list
# levels; api.py re-orders them into canonical presentation orders.
_CASE_DIM_PICK = {
    "final_classification": "final_case_classification AS value",
    "age_group": "age_group AS value",
    "sex": "sex AS value",
    "clinical_classification": "clinical_classification AS value",
    "admitted": "CASE WHEN admitted THEN 'Admitted' ELSE 'Not admitted' END AS value",
}

# The FWD line-lists carry no clinical/final split — a single Suspect/Probable/
# Confirmed classification plus the admission outcome dimension.
_FWD_DIM_PICK = {
    "final_classification": "case_classification AS value",
    "age_group": "age_group AS value",
    "sex": "sex AS value",
    "admitted": "CASE WHEN admitted THEN 'Admitted' ELSE 'Not admitted' END AS value",
    "outcome": "outcome AS value",
}


def _breakdown_from(table, dim_pick, region_code, year, month, disease=None):
    region = " AND region_code = :rc" if region_code is not None else ""
    dis = " AND disease = :dis" if disease is not None else ""
    params = {"y": year, "m": month}
    if region_code is not None:
        params["rc"] = region_code
    if disease is not None:
        params["dis"] = disease

    with engine().connect() as conn:
        total = conn.execute(
            text(
                f"SELECT COALESCE(SUM(cases), 0) AS cases,"
                f" COALESCE(SUM(deaths), 0) AS deaths, COUNT(*) AS records"
                f" FROM {table} WHERE year = :y AND month = :m" + region + dis
            ),
            params,
        ).fetchone()
        dims = {}
        for name, pick in dim_pick.items():
            rows = conn.execute(
                text(
                    "SELECT " + pick + ", SUM(cases) AS cases, SUM(deaths) AS deaths"
                    " FROM " + table + " WHERE year = :y AND month = :m"
                    + region + dis
                    + " GROUP BY value ORDER BY value"
                ),
                params,
            ).mappings().all()
            dims[name] = [
                {"value": r["value"], "cases": int(r["cases"]), "deaths": int(r["deaths"])}
                for r in rows
            ]

    return {
        "total_cases": int(total.cases),
        "total_deaths": int(total.deaths),
        "records": int(total.records),
        "dims": dims,
    }


def case_breakdown(region_code, year, month, disease="Dengue"):
    """Per-dimension reported-case counts for one (region, disease, year, month).

    Aggregates the raw line-list matching `disease` (`dengue_case_records` or
    `fwbd_case_records`) by each demographic/clinical dimension, weighing every
    record by its `cases` and `deaths`. When `region_code` is None the query
    spans all regions (use for National, which is never a row in the line-list
    itself). The `month` bucket matches the monthly modelling grid, so the
    dimension totals exactly equal the reported monthly series.
    """
    if disease == "Dengue":
        return _breakdown_from(
            "dengue_case_records", _CASE_DIM_PICK, region_code, year, month
        )
    return _breakdown_from(
        "fwbd_case_records", _FWD_DIM_PICK, region_code, year, month, disease=disease
    )


def region_label_to_code(label):
    return _region_code(label)


if __name__ == "__main__":
    eng = build_db()
    with eng.connect() as conn:
        for t in metadata.sorted_tables:
            n = pd.read_sql_table(t.name, conn).shape[0]
            print(f"{t.name:<24} {n:>7} rows")
    print(f"\nDatabase ready (PostgreSQL via DATABASE_URL)")