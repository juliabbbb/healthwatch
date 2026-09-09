Standing Directive

You are executing a surgical, production-safe migration of the HEALTHWATCH system's database layer. HEALTHWATCH is a Philippine regional disease surveillance and forecasting platform. The backend uses FastAPI + SQLAlchemy. The database is PostgreSQL via Supabase in production, with a SQLite fallback in local/dev. Your job is to permanently remove the SQLite fallback, all dual-dialect branching code, and any dead weight slowing cold-start or request times — while keeping every feature, chart, computation, ML model, forecast, and design pixel-perfect intact. Do not touch any frontend components, Recharts graphs, Leaflet maps, Prophet forecasting logic, Pandas/NumPy pipelines, or any API route logic. Only the DB layer, engine setup, and dead code are in scope.

System Context
Backend: FastAPI + Uvicorn + SQLAlchemy ORM
DB: PostgreSQL (Supabase) in prod, SQLite as local fallback (TO BE REMOVED)
Deployment: Render (backend as a Web Service)
Env vars already exist: DATABASE_URL (Supabase PostgreSQL connection string)
ORM: SQLAlchemy (sync, using psycopg2-binary driver)
Migrations: likely using Alembic or raw SQLAlchemy create_all
The system has PH regional disease data: cases, forecasts, seasonality scores, hotspot classifications per region
Full Task List
1.1 — Audit All DB Engine / Session Code
Search the entire backend codebase for any of these patterns and list every file + line number:
sqlite
sqlite:///
check_same_thread
StaticPool
dialect switching or if "sqlite" in DATABASE_URL
connect_args={"check_same_thread": False}
Any try/except that falls back to a different DB URL
Any os.getenv("DATABASE_URL", "sqlite:///...") with a SQLite default
Document every single occurrence before touching anything
1.2 — Harden the Database Engine Configuration
Replace the current engine creation (whatever form it is in) with a single, production-grade PostgreSQL-only configuration:
python
  from sqlalchemy import create_engine
  from sqlalchemy.orm import sessionmaker
  import os

  DATABASE_URL = os.environ["DATABASE_URL"]
  # Supabase uses a connection pooler — ensure the URL uses the
  # transaction pooler (port 6543) or session pooler (port 5432)
  # Add ?sslmode=require if not already present in the URL

  engine = create_engine(
      DATABASE_URL,
      pool_pre_ping=True,         # Detect stale connections
      pool_size=5,                 # Conservative for Render free tier
      max_overflow=10,
      pool_recycle=300,            # Recycle connections every 5 min
      echo=False,                  # Never log SQL in production
  )

  SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Remove ALL SQLite-specific arguments (check_same_thread, StaticPool, connect_args)
If DATABASE_URL is missing from env, raise a clear RuntimeError at startup — do NOT silently fall back
The error message should read: "DATABASE_URL environment variable is not set. Supabase PostgreSQL connection string is required."
1.3 — Remove All SQLite Conditional Branches
Delete every if "sqlite" in DATABASE_URL block and its else/fallback
Delete any SQLite-specific model overrides (e.g., String columns replacing ARRAY types)
Delete any StaticPool imports and usage
Delete any SQLite test fixture setup in test files that create sqlite:///./test.db or similar
Confirm: after deletion, no reference to sqlite remains anywhere in the backend directory
1.4 — Validate Supabase Connection String Format
Supabase provides two connection string types:
Session pooler (port 5432): for persistent connections, Alembic migrations
Transaction pooler (port 6543, ?pgbouncer=true): for serverless/short-lived — use this for Render
Check the current DATABASE_URL in Render environment variables
If it uses port 5432 (direct), update the recommendation to use port 6543 with ?pgbouncer=true appended, OR use the session pooler at 5432 without pgbouncer flag
Add ?sslmode=require to the URL if it is not already present
Document this finding in a comment inside database.py or equivalent
1.5 — Clean Up Startup Lifespan / App Init
Locate the FastAPI lifespan context manager or @app.on_event("startup") handler
Remove any SQLite-specific create_all calls that were used only for local dev
If using Alembic: ensure alembic upgrade head is the single source of truth for schema
If NOT using Alembic (using Base.metadata.create_all(bind=engine)): keep this but ensure it uses the PostgreSQL engine only, and add a startup log: "Connected to Supabase PostgreSQL"
Remove any os.makedirs or file-based DB initialization code that was SQLite-related
1.6 — Remove Dead Imports and Unused Dependencies
Search for and remove these imports if they are only used by SQLite code:
from sqlalchemy.pool import StaticPool
Any SQLite dialect imports
Any aiosqlite imports (if present)
In requirements.txt (or pyproject.toml), remove aiosqlite if present
Do NOT remove psycopg2-binary — it is required for PostgreSQL
1.7 — Performance: Connection Warm-Up on Startup
Add a startup health check that runs a simple query to confirm DB is reachable:
python
  from sqlalchemy import text
  with engine.connect() as conn:
      conn.execute(text("SELECT 1"))
  print("Database connection verified.")
This prevents the first real user request from paying the cold-start DB connection cost
1.8 — Performance: Dependency Injection Cleanup
Review the get_db() FastAPI dependency function
Ensure it uses yield (not return) for proper session cleanup
Ensure session.close() is in a finally block
Standard correct pattern:
python
  def get_db():
      db = SessionLocal()
      try:
          yield db
      finally:
          db.close()
Remove any duplicate get_db definitions found in multiple files (consolidate to one location, e.g., database.py)
1.9 — Final Verification Checklist
Run a global search: grep -r "sqlite" backend/ (or equivalent) — result must be zero matches
Run a global search for StaticPool — result must be zero matches
Confirm DATABASE_URL is read from environment (not hardcoded)
Confirm pool_pre_ping=True is set (prevents errors after Supabase idle timeouts)
Confirm no echo=True in the engine (this outputs every SQL query to logs and kills performance)
Deploy to Render and confirm the health check endpoint (/health or equivalent) returns 200
Check Render logs for the startup message confirming PostgreSQL connection
1.10 — Do NOT Touch
Any Prophet forecasting code
Any Pandas / NumPy data pipeline
Any API route handlers (/api/...)
Any frontend files
Any Recharts, Leaflet, or PDF renderer code
Any existing Alembic migration files (only touch env.py if it has SQLite branching)

Do NOT change any feature behavior — only what is explicitly stated in each plan
Do NOT upgrade or downgrade any package versions unless required by the plan
Do NOT rename any existing API routes, query keys, or data shapes
Do NOT touch the render.yaml (Render Blueprint IaC) unless adding an env var reference
When in doubt about scope: do less, not more — then ask
All new files must follow the existing project's file naming convention (kebab-case or PascalCase as observed in the project)
All TypeScript must be strictly typed — no any unless the existing codebase already uses it in that file