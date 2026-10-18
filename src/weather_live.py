"""Live PAGASA weather bulletin parser & disease nowcast risk engine.

Fetches the daily forecast bulletin directly from:
    https://pagasa.dost.gov.ph/weather#daily-weather-forecast

Extracts real-time parameters:
  - Issued timestamp and general synopsis
  - Active Tropical Cyclone / Weather System information
  - Regional weather condition, synoptic cause, and impact warnings
  - 24-hour temperature and relative humidity extremes

Translates ground-truth weather alerts into disease-specific transmission
advisories (Leptospirosis floodwater exposure, post-rainfall Dengue vector
proliferation, and FWBD water-source contamination) without modifying
any historical CSV files or relational database tables.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import bs4
import httpx

from . import db

logger = logging.getLogger(__name__)

PAGASA_WEATHER_URL = "https://pagasa.dost.gov.ph/weather"
CACHE_TTL_SECONDS = 3600  # 1 hour cache to avoid unnecessary network load

_CACHE: dict[str, Any] = {
    "timestamp": 0.0,
    "payload": None,
}

# Substring matches to canonical region names in REGION_META
SPECIFIC_MAPPINGS = {
    "metro manila": "National Capital Region",
    "ncr": "National Capital Region",
    "quezon city": "National Capital Region",
    "bicol": "Bicol Region",
    "eastern visayas": "Eastern Visayas",
    "western visayas": "Western Visayas",
    "central visayas": "Central Visayas",
    "negros": "Negros Island Region",
    "zamboanga": "Zamboanga Peninsula",
    "palawan": "MIMAROPA",
    "mimaropa": "MIMAROPA",
    "quezon": "CALABARZON",
    "calabarzon": "CALABARZON",
    "ilocos": "Ilocos Region",
    "cagayan": "Cagayan Valley",
    "cordillera": "Cordillera Administrative Region",
    "car": "Cordillera Administrative Region",
    "central luzon": "Central Luzon",
    "northern mindanao": "Northern Mindanao",
    "davao": "Davao Region",
    "soccsksargen": "SOCCSKSARGEN",
    "caraga": "Caraga",
    "basilan": "Bangsamoro (BARMM)",
    "tawi-tawi": "Bangsamoro (BARMM)",
    "sulu": "Bangsamoro (BARMM)",
    "barmm": "Bangsamoro (BARMM)",
}


def _classify_risk(condition: str, caused_by: str, impacts: str) -> dict[str, Any]:
    """Evaluate weather parameters into per-illness disease nowcast alerts.

    Returns differentiated advisories for all 5 SUPPORTED_DISEASES:
      - Dengue              (vector ecology: rain → breeding sites)
      - Acute Bloody Diarrhea (fastest responder to flood water contamination)
      - Cholera             (highest weather sensitivity; flood → V. cholerae)
      - Typhoid Fever       (moderate; 7-14 day incubation lag)
      - Acute Viral Hepatitis (lowest sensitivity; 15-50 day incubation lag)
    """
    c_lower = condition.lower()
    i_lower = impacts.lower()
    cb_lower = caused_by.lower()

    has_heavy_rain = any(
        kw in i_lower or kw in c_lower
        for kw in ("heavy rain", "moderate to at times heavy", "widespread rain", "torrential")
    )
    is_flood = ("flash flood" in i_lower and has_heavy_rain) or ("inundation" in i_lower)
    is_cyclone_monsoon = any(
        kw in cb_lower or kw in c_lower
        for kw in ("typhoon", "tropical", "cyclone", "monsoon", "habagat", "lpa", "low pressure", "itcz")
    )

    if is_flood or "typhoon" in cb_lower or has_heavy_rain:
        tier = "HIGH"
        timeline = {
            "immediate_days_1_3": "Active flood/heavy rain: drinking water infiltration risk and direct waterborne exposure are immediate.",
            "short_term_weeks_2_4": "Receding floodwaters leave stagnant pools — Dengue vector surge expected in 7–14 days; FWD case spike in 3–7 days.",
        }
        actions = [
            "Issue boil-water and water disinfection advisories in flooded barangays.",
            "Deploy chlorine purification kits and distribute oral rehydration salts (ORS) to affected communities.",
            "Schedule 4S vector search-and-destroy campaigns before Day 7 to break the larval breeding cycle.",
            "Alert health centers to increase inventory of Dengue NS1 RDTs and oral rehydration stocks.",
            "Issue public advisory to avoid contact with floodwater and consume only treated water.",
        ]
        disease_advisories = {
            "Dengue": {
                "alert_level": "ELEVATED",
                "multiplier": 1.20,
                "guidance": (
                    "Heavy rainfall creates flood pools and container water accumulation — ideal Aedes aegypti breeding conditions. "
                    "Expect a Dengue case surge 7–14 days post-event. Accelerate 4S fogging and larval source reduction now."
                ),
            },
            "Acute Bloody Diarrhea": {
                "alert_level": "HIGH",
                "multiplier": 1.30,
                "guidance": (
                    "Floodwater carries fecal-oral pathogens directly into drinking water sources. "
                    "ABD responds fastest (3–7 days) to contamination events. Issue immediate boil-water advisory and ORS distribution."
                ),
            },
            "Cholera": {
                "alert_level": "HIGH",
                "multiplier": 1.35,
                "guidance": (
                    "Cholera is the most weather-sensitive disease in this system. Flooding displaces sanitation infrastructure and "
                    "creates warm, brackish standing water where Vibrio cholerae thrives. Alert surveillance teams for early case detection."
                ),
            },
            "Typhoid Fever": {
                "alert_level": "MODERATE",
                "multiplier": 1.15,
                "guidance": (
                    "Typhoid incubation is 7–14 days; expect delayed case increase after flooding events. "
                    "Flooding of sewage and water supply infrastructure is the primary risk pathway. Enforce food and water hygiene."
                ),
            },
            "Acute Viral Hepatitis": {
                "alert_level": "MODERATE",
                "multiplier": 1.10,
                "guidance": (
                    "Hepatitis A follows a fecal-oral route and has a 15–50 day incubation period. "
                    "Flooding of sewage infrastructure elevates risk; the case rise will appear weeks after the event. Enforce safe water and food handling."
                ),
            },
        }
    elif is_cyclone_monsoon or "scattered" in c_lower:
        tier = "ELEVATED"
        timeline = {
            "immediate_days_1_3": "Scattered rains produce temporary puddles and damp soil; surface runoff may reach water sources.",
            "short_term_weeks_2_4": "Sustained humidity (>80%) shortens mosquito gonotrophic cycle; elevated biting frequency expected.",
        }
        actions = [
            "Empty water-collecting outdoor receptacles (tires, plastic bottles, plant saucers).",
            "Ensure health centers maintain adequate diagnostic test kits (Dengue NS1 RDT) in stock.",
            "Advise communities to seek medical consult for febrile illness lasting more than 2 days.",
        ]
        disease_advisories = {
            "Dengue": {
                "alert_level": "MODERATE",
                "multiplier": 1.15,
                "guidance": (
                    "Persistent moisture and high humidity accelerate mosquito egg-laying and hatching cycles. "
                    "Inspect and eliminate standing water around residences; sustained vector management required."
                ),
            },
            "Acute Bloody Diarrhea": {
                "alert_level": "MODERATE",
                "multiplier": 1.15,
                "guidance": (
                    "Heightened surface runoff under scattered rains increases contamination risk for open water sources. "
                    "Enforce food and water hygiene; monitor for case clusters in flood-prone barangays."
                ),
            },
            "Cholera": {
                "alert_level": "MODERATE",
                "multiplier": 1.18,
                "guidance": (
                    "Wet conditions support Vibrio cholerae persistence in surface water and coastal areas. "
                    "Maintain active surveillance in coastal and low-lying communities; enforce safe water access."
                ),
            },
            "Typhoid Fever": {
                "alert_level": "LOW",
                "multiplier": 1.10,
                "guidance": (
                    "Wet season conditions moderately elevate contamination pathways for Typhoid. "
                    "Standard water and food hygiene protocols are sufficient; no immediate surge expected."
                ),
            },
            "Acute Viral Hepatitis": {
                "alert_level": "LOW",
                "multiplier": 1.08,
                "guidance": (
                    "Scattered rains present low incremental risk for Hepatitis A given its long incubation window. "
                    "Maintain routine food handling and hand hygiene advisories."
                ),
            },
        }
    elif "isolated" in c_lower or "rainshower" in c_lower:
        tier = "MODERATE"
        timeline = {
            "immediate_days_1_3": "Isolated showers with dry intervals; minimal flood accumulation expected.",
            "short_term_weeks_2_4": "Normal seasonal baseline vector density; no weather-driven surge detected.",
        }
        actions = [
            "Maintain standard community sanitation and vector awareness programs.",
        ]
        disease_advisories = {
            "Dengue": {
                "alert_level": "BASELINE",
                "multiplier": 1.05,
                "guidance": "Localized showers; standard seasonal baseline vector management applies.",
            },
            "Acute Bloody Diarrhea": {
                "alert_level": "BASELINE",
                "multiplier": 1.03,
                "guidance": "Minimal runoff risk. Standard water and food hygiene monitoring is sufficient.",
            },
            "Cholera": {
                "alert_level": "BASELINE",
                "multiplier": 1.03,
                "guidance": "No active weather amplifier. Routine surveillance and safe water access protocols apply.",
            },
            "Typhoid Fever": {
                "alert_level": "BASELINE",
                "multiplier": 1.02,
                "guidance": "Baseline risk. Standard sanitation and food safety measures are adequate.",
            },
            "Acute Viral Hepatitis": {
                "alert_level": "BASELINE",
                "multiplier": 1.01,
                "guidance": "Baseline conditions. Routine hand hygiene and safe food handling advisories apply.",
            },
        }
    else:
        tier = "NORMAL"
        timeline = {
            "immediate_days_1_3": "Dry / fair weather prevailing; low waterborne and vector risk.",
            "short_term_weeks_2_4": "Baseline seasonal parameters; no weather-driven amplification.",
        }
        actions = [
            "Standard routine epidemiological surveillance.",
        ]
        disease_advisories = {
            "Dengue": {
                "alert_level": "BASELINE",
                "multiplier": 1.00,
                "guidance": "Fair weather; baseline seasonal Dengue activity. Routine vector monitoring applies.",
            },
            "Acute Bloody Diarrhea": {
                "alert_level": "BASELINE",
                "multiplier": 1.00,
                "guidance": "Fair weather; no weather-driven contamination amplification. Baseline food and water hygiene.",
            },
            "Cholera": {
                "alert_level": "BASELINE",
                "multiplier": 1.00,
                "guidance": "Dry conditions reduce waterborne transmission risk significantly. Routine surveillance applies.",
            },
            "Typhoid Fever": {
                "alert_level": "BASELINE",
                "multiplier": 1.00,
                "guidance": "Fair weather; no precipitation-driven amplification of Typhoid pathways. Baseline surveillance.",
            },
            "Acute Viral Hepatitis": {
                "alert_level": "BASELINE",
                "multiplier": 1.00,
                "guidance": "Baseline conditions. Standard sanitation and Hepatitis A surveillance apply.",
            },
        }

    return {
        "risk_tier": tier,
        "flood_warning": is_flood,
        # Overall multiplier kept for backward compat (max across diseases)
        "multiplier": max(v["multiplier"] for v in disease_advisories.values()),
        "transmission_timeline": timeline,
        "recommended_actions": actions,
        "disease_advisories": disease_advisories,
    }


def _parse_pagasa_html(html_text: str) -> dict[str, Any]:
    soup = bs4.BeautifulSoup(html_text, "html.parser")

    # 1. Issued timestamp
    issue_elem = soup.find(class_="issue")
    issued_at = issue_elem.get_text(strip=True) if issue_elem else "Latest Daily Forecast"
    if issued_at.startswith("Issued at:"):
        issued_at = issued_at.replace("Issued at:", "").strip()

    # 2. Synopsis
    synopsis_elem = soup.find("div", class_="panel-body")
    synopsis = synopsis_elem.get_text(strip=True) if synopsis_elem else ""

    # 3. Tropical Cyclone info
    tc_info = None
    for h3 in soup.find_all("h3"):
        if "TC" in h3.get_text() or "Cyclone" in h3.get_text():
            parent = h3.parent
            if parent:
                tc_info = parent.get_text(separator=" | ", strip=True)
                break

    # 4. Parse Forecast Weather Conditions table
    tables = soup.find_all("table")
    forecast_rows = []
    if len(tables) > 1:
        for row in tables[1].find_all("tr")[1:]:
            cols = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cols) >= 4:
                forecast_rows.append({
                    "place": cols[0],
                    "condition": cols[1],
                    "caused_by": cols[2],
                    "impacts": cols[3],
                })

    # 5. Temperature and Humidity Extremes
    extremes = {}
    if len(tables) > 3:
        for row in tables[3].find_all("tr"):
            cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cols) >= 5:
                label = cols[0]
                if "temperature" in label.lower():
                    extremes["temperature"] = {
                        "max": cols[1],
                        "max_time": cols[2],
                        "min": cols[3],
                        "min_time": cols[4],
                    }
                elif "humidity" in label.lower():
                    extremes["relative_humidity"] = {
                        "max": cols[1],
                        "max_time": cols[2],
                        "min": cols[3],
                        "min_time": cols[4],
                    }

    # 6. Map to each of the 18 regions
    assigned_regions = {}
    # Pass 1: match specific names
    for item in forecast_rows:
        p_lower = item["place"].lower()
        for kw, reg_name in SPECIFIC_MAPPINGS.items():
            if kw in p_lower and reg_name not in assigned_regions:
                if f"rest of {kw}" not in p_lower:
                    assigned_regions[reg_name] = item

    # Pass 2: match catch-alls ('rest of luzon', 'rest of visayas', 'rest of mindanao')
    for item in forecast_rows:
        p_lower = item["place"].lower()
        for island in ["luzon", "visayas", "mindanao"]:
            if f"rest of {island}" in p_lower:
                for r in db.REGION_META:
                    if r["island"].lower() == island and r["name"] not in assigned_regions:
                        assigned_regions[r["name"]] = item

    # Build per-region records
    regions_payload = {}
    severe_count = 0
    for r in db.REGION_META:
        reg_code = r["code"]
        raw = assigned_regions.get(r["name"], {
            "place": r["name"],
            "condition": "Partly cloudy with isolated rainshowers",
            "caused_by": "Localized Thunderstorms",
            "impacts": "Possible flash floods or landslides during severe thunderstorms",
        })
        risk = _classify_risk(raw["condition"], raw["caused_by"], raw["impacts"])
        if risk["flood_warning"]:
            severe_count += 1

        regions_payload[reg_code] = {
            "region_code": reg_code,
            "region_name": r["name"],
            "region_short": r["short"],
            "island": r["island"],
            "place_covered": raw["place"],
            "condition": raw["condition"],
            "caused_by": raw["caused_by"],
            "impacts": raw["impacts"],
            "flood_warning": risk["flood_warning"],
            "risk_tier": risk["risk_tier"],
            "multiplier": risk["multiplier"],
            "transmission_timeline": risk["transmission_timeline"],
            "recommended_actions": risk["recommended_actions"],
            "disease_advisories": risk["disease_advisories"],
            "extremes": extremes,
        }

    # Build national overview summary
    national_summary = {
        "region_code": db.NATIONAL_CODE,
        "region_name": db.NATIONAL_NAME,
        "region_short": "NAT",
        "issued_at": issued_at,
        "synopsis": synopsis,
        "tropical_cyclone": tc_info,
        "extremes": extremes,
        "active_flood_warnings_regions_count": severe_count,
        "total_regions": len(db.REGION_META),
        "source": "PAGASA Daily Weather Forecast (Synoptic Bulletin)",
        "source_url": PAGASA_WEATHER_URL,
    }

    return {
        "national": national_summary,
        "regions": regions_payload,
        "raw_table": forecast_rows,
        "cached_at": time.time(),
    }


def get_live_weather(force_refresh: bool = False) -> dict[str, Any]:
    """Retrieve the latest PAGASA daily weather bulletin, using cached copy if fresh."""
    global _CACHE  # noqa: PLW0603
    now = time.time()

    if not force_refresh and _CACHE["payload"] is not None and (now - _CACHE["timestamp"]) < CACHE_TTL_SECONDS:
        return _CACHE["payload"]

    try:
        resp = httpx.get(PAGASA_WEATHER_URL, timeout=15.0, verify=False)
        if resp.status_code == 200 and len(resp.text) > 1000:
            parsed = _parse_pagasa_html(resp.text)
            _CACHE["timestamp"] = now
            _CACHE["payload"] = parsed
            logger.info("Successfully fetched and parsed live PAGASA weather bulletin (%s)", parsed["national"]["issued_at"])
            return parsed
        else:
            logger.warning("PAGASA HTTP response non-200 (%s), using cache fallback", resp.status_code)
    except Exception as exc:
        logger.warning("Failed to fetch live PAGASA weather (%s); using fallback cache", exc)

    if _CACHE["payload"] is not None:
        return _CACHE["payload"]

    # If never fetched and network failed, provide safe mock payload
    return _build_fallback_payload()


def _build_fallback_payload() -> dict[str, Any]:
    """Graceful offline fallback if PAGASA is temporarily unreachable."""
    regions_payload = {}
    for r in db.REGION_META:
        reg_code = r["code"]
        regions_payload[reg_code] = {
            "region_code": reg_code,
            "region_name": r["name"],
            "region_short": r["short"],
            "island": r["island"],
            "place_covered": r["name"],
            "condition": "Partly cloudy with isolated rainshowers",
            "caused_by": "Easterlies / Localized Thunderstorms",
            "impacts": "Possible flash floods or landslides during severe thunderstorms",
            "flood_warning": False,
            "risk_tier": "NORMAL",
            "multiplier": 1.00,
            "disease_advisories": {
                "Dengue": {"alert_level": "BASELINE", "multiplier": 1.00, "guidance": "Standard seasonal baseline conditions apply."},
                "Acute Bloody Diarrhea": {"alert_level": "BASELINE", "multiplier": 1.00, "guidance": "Baseline food and water hygiene surveillance."},
                "Cholera": {"alert_level": "BASELINE", "multiplier": 1.00, "guidance": "Routine surveillance applies. No active weather amplifier."},
                "Typhoid Fever": {"alert_level": "BASELINE", "multiplier": 1.00, "guidance": "Baseline sanitation and food safety measures are adequate."},
                "Acute Viral Hepatitis": {"alert_level": "BASELINE", "multiplier": 1.00, "guidance": "Routine hand hygiene and safe food handling advisories apply."},
            },
        }

    return {
        "national": {
            "region_code": db.NATIONAL_CODE,
            "region_name": db.NATIONAL_NAME,
            "region_short": "NAT",
            "issued_at": "Offline / Fallback Bulletin",
            "synopsis": "Seasonal weather patterns prevailing over the Philippine archipelago.",
            "tropical_cyclone": None,
            "extremes": {},
            "active_flood_warnings_regions_count": 0,
            "total_regions": len(db.REGION_META),
            "source": "PAGASA Daily Weather Forecast (Fallback)",
            "source_url": PAGASA_WEATHER_URL,
        },
        "regions": regions_payload,
        "raw_table": [],
        "cached_at": time.time(),
    }
