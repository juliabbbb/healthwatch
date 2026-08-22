import sqlite3

import pandas as pd

from . import ingest

DB_NAME = "healthwatch.db"

TABLES = {
    "weekly_cases_national": "national_weekly.csv",
    "weekly_cases_regional": "regional_dengue_weekly.csv",
    "forecasts": "forecasts.csv",
    "risk_thresholds": "risk_thresholds.csv",
    "risk_classification": "risk_classification.csv",
    "validation_metrics": "validation_metrics.csv",
    "tier_accuracy": "tier_accuracy.csv",
}


def build_db(db_path=None):
    if db_path is None:
        db_path = ingest.PROCESSED_DIR / DB_NAME
    ingest.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    try:
        for table, csv_name in TABLES.items():
            path = ingest.PROCESSED_DIR / csv_name
            if not path.exists():
                print(f"SKIP {table}: {csv_name} not found")
                continue
            df = pd.read_csv(path)
            df.to_sql(table, conn, index=False, if_exists="replace")
            print(f"{table:<24} <- {csv_name} ({len(df)} rows)")
        conn.commit()
    finally:
        conn.close()
    return db_path


def read_table(table, db_path=None):
    if db_path is None:
        db_path = ingest.PROCESSED_DIR / DB_NAME
    if not db_path.exists():
        raise FileNotFoundError(
            f"{db_path} missing; run: .venv\\Scripts\\python -m src.db"
        )
    with sqlite3.connect(db_path) as conn:
        return pd.read_sql_query(f"SELECT * FROM {table}", conn)


if __name__ == "__main__":
    path = build_db()
    print(f"\nDatabase ready -> {path}")
