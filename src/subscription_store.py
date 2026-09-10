"""Anonymous email-subscription store for recurring monthly forecast reports.

Subscriptions are email-only (no login). Preferences are stored as JSON rows in
a `subscriptions` table:

- Postgres (production/Render): when DATABASE_URL is set, the store reuses the
  app engine, so subscriptions survive redeploys. The table is auto-created on
  first use.
- SQLite (local/dev fallback): `data/subscriptions.sqlite3`, overridable with
  SUBSCRIPTIONS_DB.
"""

from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path

import sqlalchemy as sa

_PG_DDL = """
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    regions TEXT NOT NULL DEFAULT '[]',  -- JSON array of region codes; empty = all
    illness TEXT NOT NULL DEFAULT 'all',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TEXT NOT NULL,
    last_sent_at TEXT,
    sent_count INTEGER NOT NULL DEFAULT 0
)
"""

_SQLITE_DDL = """
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    regions TEXT NOT NULL DEFAULT '[]',  -- JSON array of region codes; empty = all
    illness TEXT NOT NULL DEFAULT 'all',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_sent_at TEXT,
    sent_count INTEGER NOT NULL DEFAULT 0
)
"""

_engine: sa.Engine | None = None


def _use_postgres() -> bool:
    return bool(os.environ.get("DATABASE_URL", "").strip())


def _engine_for() -> sa.Engine:
    """Lazily built (and schema-ensured) engine for the active backend."""
    global _engine
    if _engine is None:
        if _use_postgres():
            from . import db

            _engine = db.engine()
        else:
            raw = os.environ.get("SUBSCRIPTIONS_DB", "").strip()
            path = Path(raw) if raw else Path("data") / "subscriptions.sqlite3"
            path.parent.mkdir(parents=True, exist_ok=True)
            _engine = sa.create_engine(f"sqlite:///{path}")
    with _engine.begin() as conn:
        conn.execute(sa.text(_PG_DDL if _use_postgres() else _SQLITE_DDL))
    return _engine


def _rowdict(row: sa.Row | None) -> dict | None:
    if row is None:
        return None
    mapping = row._mapping
    out = {key: mapping[key] for key in mapping.keys()}
    out["regions"] = json.loads(out["regions"])
    out["active"] = bool(out["active"])
    out["sent_count"] = int(out["sent_count"])
    return out


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_or_reactivate(email: str, regions: list[str], illness: str) -> str:
    """Create a subscription or reactivate/refresh an existing one for `email`.

    Returns the existing token when a subscription for `email` is present
    (reactivating if it was previously unsubscribed), otherwise a new token.
    """
    engine = _engine_for()
    with engine.begin() as conn:
        row = conn.execute(
            sa.text("SELECT token FROM subscriptions WHERE email = :e"), {"e": email}
        ).fetchone()
        if row:
            token = row[0]
            conn.execute(
                sa.text(
                    """
                    UPDATE subscriptions
                    SET regions = :r, illness = :i, active = :a
                    WHERE token = :t
                    """
                ),
                {"r": json.dumps(regions), "i": illness, "a": True, "t": token},
            )
        else:
            token = secrets.token_urlsafe(24)
            conn.execute(
                sa.text(
                    """
                    INSERT INTO subscriptions
                        (token, email, regions, illness, active, created_at)
                    VALUES (:t, :e, :r, :i, :a, :c)
                    """
                ),
                {
                    "t": token,
                    "e": email,
                    "r": json.dumps(regions),
                    "i": illness,
                    "a": True,
                    "c": _utc_now_iso(),
                },
            )
    return token


def get_by_token(token: str) -> dict | None:
    engine = _engine_for()
    with engine.connect() as conn:
        row = conn.execute(
            sa.text("SELECT * FROM subscriptions WHERE token = :t"), {"t": token}
        ).fetchone()
    return _rowdict(row)


def get_by_email(email: str) -> dict | None:
    engine = _engine_for()
    with engine.connect() as conn:
        row = conn.execute(
            sa.text("SELECT * FROM subscriptions WHERE email = :e"), {"e": email}
        ).fetchone()
    return _rowdict(row)


def update_preferences(token: str, regions: list[str], illness: str) -> bool:
    """Update a subscription's filters and re-activate it. Returns False when
    the token is unknown."""
    engine = _engine_for()
    with engine.begin() as conn:
        result = conn.execute(
            sa.text(
                """
                UPDATE subscriptions
                SET regions = :r, illness = :i, active = :a
                WHERE token = :t
                """
            ),
            {"r": json.dumps(regions), "i": illness, "a": True, "t": token},
        )
    return result.rowcount > 0


def deactivate(token: str) -> bool:
    engine = _engine_for()
    with engine.begin() as conn:
        result = conn.execute(
            sa.text("UPDATE subscriptions SET active = :a WHERE token = :t"),
            {"a": False, "t": token},
        )
    return result.rowcount > 0


def list_active_due(month_key: str) -> list[dict]:
    """Active subscriptions that have not yet received the `month_key` report
    (e.g. '2026-09'). Keeps the monthly job idempotent."""
    engine = _engine_for()
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                """
                SELECT * FROM subscriptions
                WHERE active = :a AND (last_sent_at IS NULL OR last_sent_at <> :m)
                ORDER BY id
                """
            ),
            {"a": True, "m": month_key},
        ).fetchall()
    return [_rowdict(r) for r in rows]


def mark_sent(token: str, month_key: str) -> None:
    engine = _engine_for()
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                """
                UPDATE subscriptions
                SET last_sent_at = :m, sent_count = sent_count + 1
                WHERE token = :t
                """
            ),
            {"m": month_key, "t": token},
        )