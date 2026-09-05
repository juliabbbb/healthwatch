"""Relational database layer for the monthly pipeline.

Builds and reads the HEALTHWATCH schema (the ERD source of truth — 9 tables)
through SQLAlchemy so the SAME schema runs on:

  * a local SQLite file  (data/processed/healthwatch.db) when DATABASE_URL is
    not set — zero-setup local dev, and
  * a real PostgreSQL server (Render / Supabase) when DATABASE_URL is set.

The pipeline never hand-writes tables: `build_db()` drops and recreates rows
from the processed CSVs, so a rebuild is fully idempotent. Because this module
parses the repo .env itself, both the API and the CLI rebuild pick up
DATABASE_URL regardless of launch context.
"""

import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
)

from . import ingest

DB_NAME = "healthwatch.db"


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


def _engine():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        engine = create_engine(db_url, pool_pre_ping=True)
    else:
        ingest.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f"sqlite:///{ingest.PROCESSED_DIR / DB_NAME}")
    return engine


def engine():
    """Accessor for the shared engine. Reads DATABASE_URL (Postgres) or falls
    back to the local SQLite file — see module docstring."""
    if not hasattr(_engine, "_cached"):
        _engine._cached = _engine()
    return _engine._cached


def _region_code(label):
    if label == NATIONAL_NAME:
        return NATIONAL_CODE
    code = REGION_CODE_BY_NAME.get(label)
    if code is None:
        raise ValueError(f"Region '{label}' is not in REGION_META; extend it.")
    return code


def _to_mid(dates, col="target_date"):
    return pd.to_datetime(dates).dt.to_period("M").dt.to_timestamp()


def _load_csv(name):
    path = ingest.PROCESSED_DIR / name
    if not path.exists():
        return None
    return pd.read_csv(path)


def build_db():
    """(Re)build every table from the processed CSVs. Idempotent: each build
    replaces the previous contents, so a full pipeline rerun fully resyncs it."""
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

        regional = _load_csv("regional_dengue_monthly.csv")
        if regional is not None:
            rows = _monthly_observation_rows(regional)
            if rows:
                conn.execute(monthly_observations.insert(), rows)

        national = _load_csv("national_monthly.csv")
        if national is not None:
            rows = _monthly_observation_rows(national)
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

        fcst = _remap(_load_csv("forecasts.csv"), "region_code")
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

        regional_dates = (
            regional["date"].max() if regional is not None and not regional.empty else None
        )
        conn.execute(
            pipeline_runs.insert(),
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "data_through": (
                    pd.to_datetime(regional_dates).date()
                    if regional_dates is not None
                    else None
                ),
                "version": "monthly-2022-2026",
                "model": "prophet-monthly",
                "notes": PROVIDENCE_NOTES,
            },
        )

    return eng


PROVIDENCE_NOTES = (
    "Monthly pipeline v2: real DOH-EB monthly dengue counts (2022-01..2026-08), "
    "18 regions incl. NIR; production forecast fits all observed history; "
    "walk-forward validation refits every month; 2025 probes fit through "
    "2024-12-31 as true prospective holdouts."
)


def _monthly_observation_rows(regional):
    regional = regional.copy()
    regional["region_code"] = regional["region"].map(_region_code)
    regional["year"] = pd.to_datetime(regional["date"]).dt.year
    regional["month"] = pd.to_datetime(regional["date"]).dt.month
    return regional[["region_code", "disease", "year", "month", "cases", "deaths"]].to_dict(
        orient="records"
    )


def read_table(table, db_path=None):
    with engine().connect() as conn:
        return pd.read_sql_table(table, conn)


def region_label_to_code(label):
    return _region_code(label)


if __name__ == "__main__":
    eng = build_db()
    with eng.connect() as conn:
        for t in metadata.sorted_tables:
            n = pd.read_sql_table(t.name, conn).shape[0]
            print(f"{t.name:<24} {n:>7} rows")
    label = os.environ.get("DATABASE_URL")
    print(f"\nDatabase ready ({'postgres via DATABASE_URL' if label else 'sqlite: ' + DB_NAME})")