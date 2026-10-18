"""Minimal integration client for the HEALTHWATCH API (Objective 3).

Demonstrates programmatic retrieval of the forecast, risk tier, and escalation
ranking endpoints from an external health information system. Works against the
repo's own API (this project's dashboard uses exactly these endpoints).

Usage:
    python -m docs.examples.integration_client      # localhost:8000
    BASE_URL=https://healthwatch-api-xepv.onrender.com python -m docs.examples.integration_client

Requires: requests (pip install requests)
"""

import os
import sys

import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
DISEASE = "Dengue"


def get(path, **params):
    resp = requests.get(f"{BASE_URL}{path}", params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    forecasts = get(f"/forecast/{DISEASE}")
    classification = get(f"/risk-classification/{DISEASE}", region="Ilocos Region")
    ranking = get("/escalation", **{"disease": DISEASE, "top": 5})
    emergency = get("/outbreak", **{"disease": DISEASE})

    unknown_region_404 = False
    try:
        get("/series/Nowhere")
    except requests.HTTPError as exc:
        unknown_region_404 = exc.response.status_code == 404

    wrong_case_404 = False
    try:
        get("/forecast/dengue")
    except requests.HTTPError as exc:
        wrong_case_404 = exc.response.status_code == 404

    tiers = sorted({row["risk_level"] for row in classification["items"]})
    flags = sum(1 for r in emergency["items"] if r["outbreak"])

    print(f"Fetched {len(forecasts['items'])} forecast rows, "
          f"{len(classification['items'])} tier rows, "
          f"{len(ranking['items'])} escalation rows")
    print(f"Unknown region returns 404: {unknown_region_404}")
    print(f"Disease names are case-sensitive (lowercase 404): {wrong_case_404}")
    print(f"Ilocos risk tiers across horizon: {', '.join(tiers)}")
    print(f"Season-level outbreak flags: {flags}")
    print("Top escalation regions:", ", ".join(
        f"#{rank['rank']} {rank['region']} (+{rank['tier_climbs']})"
        for rank in ranking["items"]
    ))


if __name__ == "__main__":
    try:
        main()
    except requests.exceptions.ConnectionError as exc:
        print(f"Cannot reach {BASE_URL}: {exc}", file=sys.stderr)
        print("Start the backend with: .venv\\Scripts\\python -m uvicorn src.api:app --port 8000",
              file=sys.stderr)
        sys.exit(1)