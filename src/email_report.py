"""Recurring monthly forecast report: build + render + send.

The report mirrors the frontend dashboard classification engine
(frontend/src/lib/healthwatch/data.ts: getThresholds / classify /
assessRegion.changePct) so the emailed tier, trend, and per-capita figures
match what a user sees on the site:

- risk tier      -> pooled historical per-capita values across all regions,
                    restricted to the same calendar-month window (±1 month),
                    P50/P75 percentiles with linear interpolation.
- trend          -> percent change vs. the value three months earlier, computed
                    on raw case counts; +5%/-5% defines up/down.
- per-capita     -> cases / population * 100,000 (rounded to 2dp).

Email delivery uses Resend when RESEND_API_KEY is set; otherwise the rendered
report is written to data/email_outbox/ (dry-run) so the whole flow works
without credentials.
"""

from __future__ import annotations

import html
import math
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from . import db

PHT = timezone(timedelta(hours=8))

TIER_ORDER = {"Low": 0, "Moderate": 1, "High": 2}
_WELL_KNOWN_TIERS = ("Low", "Moderate", "High")

# Brand + warm print palette (kept hex here; must stay in line with
# DESIGN.md tokens and the export PDF palette).
_INK = "#211f1b"
_BG = "#fbf8f3"
_CARD = "#ffffff"
_BORDER = "#e9dfd1"
_ACCENT = "#e8542f"
_MUTED = "#5e574c"
_TIER_HEX = {"Low": "#007a54", "Moderate": "#a06315", "High": "#b82d2a"}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_OUTBOX_DIR = Path("data") / "email_outbox"


def pht_now() -> datetime:
    """Current wall-clock in Asia/Manila (PHT, UTC+8)."""
    return datetime.now(PHT)


def month_key(dt: datetime | None = None) -> str:
    """'YYYY-MM' month key used to make the monthly job idempotent."""
    return (dt or pht_now()).strftime("%Y-%m")


# --------------------------------------------------------------------------
# Classification replication (must match frontend data.ts exactly)
# --------------------------------------------------------------------------


def _percapita(cases: float, population: int) -> float:
    return round((cases / population) * 100000, 2)


def _in_season_window(month: int, month_of_year: int) -> bool:
    d = abs(month - month_of_year)
    return min(d, 12 - d) <= 1


def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = (len(sorted_vals) - 1) * p
    lo, hi = math.floor(idx), math.ceil(idx)
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (idx - lo)


def _classify(value: float, p50: float, p75: float) -> str:
    if value > p75:
        return "High"
    if value >= p50:
        return "Moderate"
    return "Low"


def _trend_from_pct(pct: float) -> str:
    if pct > 5:
        return "up"
    if pct < -5:
        return "down"
    return "stable"


# --------------------------------------------------------------------------
# Data loading + report assembly
# --------------------------------------------------------------------------


def _implied(trend: str) -> str:
    return {"up": "▲", "down": "▼", "stable": "—"}[trend]


def _load_tables() -> tuple[pd.DataFrame, pd.DataFrame]:
    obs = db.read_table("monthly_observations")
    obs = obs[obs["disease"] == "Dengue"].copy()
    obs["date"] = pd.to_datetime(
        obs["year"].astype(str) + "-" + obs["month"].astype(str).str.zfill(2) + "-01"
    )
    fcst = db.read_table("forecasts")
    fcst = fcst[fcst["disease"] == "Dengue"].copy()
    fcst["target_date"] = pd.to_datetime(fcst["target_date"])
    return obs, fcst


def _per_region_series(obs: pd.DataFrame, fcst: pd.DataFrame) -> dict[str, list[dict]]:
    """Unified monthly timeline per region: observed months then forecast
    months with yhat, sorted by date."""
    series: dict[str, list[dict]] = {}
    for code in [r["code"] for r in db.REGION_META]:
        rows: list[dict] = []
        o = obs[obs["region_code"] == code].sort_values("date")
        for dt, cases in zip(o["date"], o["cases"]):
            rows.append({"date": dt, "cases": float(cases), "forecast": False})
        f = fcst[fcst["region_code"] == code].sort_values("target_date")
        for dt, yhat in zip(f["target_date"], f["yhat"]):
            rows.append({"date": dt, "cases": float(yhat), "forecast": True})
        series[code] = rows
    return series


def _report_index(series: list[dict]) -> int:
    """Index of the current PHT month in the unified timeline, clamped."""
    now = pht_now()
    idx = (now.year - 2022) * 12 + (now.month - 1)
    return max(0, min(idx, len(series) - 1))


def build_report(region_codes: list[str], illness: str) -> dict:
    """Assemble the current month's report for the requested regions.

    `region_codes == []` subscribes to all 18 regions. Mirror of the
    frontend assessment math (pooled seasonal percentiles, idx-3 trend).
    """
    obs, fcst = _load_tables()
    series_by_code = _per_region_series(obs, fcst)
    report_idx = _report_index(series_by_code[db.REGION_META[0]["code"]])

    # Reporting date: same across regions (timelines are aligned).
    first_code = db.REGION_META[0]["code"]
    report_point = series_by_code[first_code][report_idx]
    report_date = report_point["date"].normalize()
    report_month = report_date.month

    ordered_codes = (
        [r["code"] for r in db.REGION_META]
        if not region_codes
        else [c for c in region_codes if c in {r["code"] for r in db.REGION_META}]
    )
    if not ordered_codes:
        ordered_codes = [r["code"] for r in db.REGION_META]

    population = {r["code"]: r["population"] for r in db.REGION_META}
    name = {r["code"]: r["name"] for r in db.REGION_META}
    short = {r["code"]: r["short"] for r in db.REGION_META}

    # Pooled historical per-capita distribution for this calendar-month window.
    pooled: list[float] = []
    for code, rows in series_by_code.items():
        for p in rows:
            if p["forecast"] or not _in_season_window(p["date"].month, report_month):
                continue
            pooled.append(_percapita(p["cases"], population[code]))
    pooled.sort()
    p50 = _percentile(pooled, 0.5)
    p75 = _percentile(pooled, 0.75)

    def _assess(code: str) -> dict:
        rows = series_by_code[code]
        idx = min(report_idx, len(rows) - 1)
        point = rows[idx]
        prev_idx = idx - 3
        prev_cases = rows[prev_idx]["cases"] if prev_idx >= 0 else 0
        cases = point["cases"]
        change_pct = round(((cases - prev_cases) / prev_cases) * 100) if prev_cases else 0
        value = _percapita(cases, population[code])
        tier = _classify(value, p50, p75)
        spark = [
            _percapita(rows[max(0, idx - 11 + k)]["cases"], population[code])
            for k in range(12)
        ]
        return {
            "code": code,
            "short": short[code],
            "name": name[code],
            "cases": cases,
            "value": value,
            "tier": tier,
            "trend": _trend_from_pct(change_pct),
            "pct_change": change_pct,
            "sparkline": spark,
        }

    regions = [_assess(c) for c in ordered_codes]
    regions.sort(key=lambda r: (TIER_ORDER[r["tier"]], r["value"]), reverse=True)

    # National strip (sum of all 18 regions — never a raw national series).
    all_region_codes = [r["code"] for r in db.REGION_META]
    obs_idx = report_idx
    national_cases = sum(
        series_by_code[c][min(obs_idx, len(series_by_code[c]) - 1)]["cases"]
        for c in all_region_codes
        if len(series_by_code[c]) > obs_idx
    )
    total_pop = sum(population[c] for c in all_region_codes)
    national_value = _percapita(national_cases, total_pop)
    top = regions[0] if regions else None
    national_tier = _classify(national_value, p50, p75) if regions else "Low"
    global_change = top["pct_change"] if top else 0

    scope = "all" if not region_codes else "custom"
    scope_label = (
        "All 18 regions"
        if scope == "all"
        else ", ".join(r["short"] for r in regions)
    )

    return {
        "month": report_date.strftime("%B %Y"),
        "month_key": report_date.strftime("%Y-%m"),
        "illness": illness.lower(),
        "illness_label": "Dengue",
        "scope": scope,
        "scope_label": scope_label,
        "total_regions": len(regions),
        "featured_count": min(6, len(regions)),
        "national": {
            "label": "National",
            "cases": national_cases,
            "value": national_value,
            "tier": national_tier,
            "trend": _trend_from_pct(global_change),
            "pct_change": global_change,
        },
        "regions": regions,
    }


# --------------------------------------------------------------------------
# Plain-language summary + email rendering
# --------------------------------------------------------------------------


def _narrative(report: dict) -> str:
    rg = report["national"] if report["scope"] == "all" else report["regions"][0]
    tier_word = {
        "High": "High-risk transmission continues this month",
        "Moderate": "transmission is elevated this month",
        "Low": "transmission remains low this month",
    }[rg["tier"]]
    trend_word = {
        "up": "trending upward",
        "down": "trending downward",
        "stable": "broadly stable",
    }[rg["trend"]]
    scope = report["scope_label"]
    pct = abs(rg["pct_change"])
    if rg["trend"] == "stable":
        trend_sentence = f"Cases are {trend_word} compared with three months ago."
    else:
        trend_sentence = f"Cases are {trend_word} compared with three months ago ({pct}% change)."
    return (
        f"{scope} — {report['illness_label']}: {tier_word}. "
        f"{scope} risk outlook for {report['month']} is '{rg['tier']}'. "
        f"{trend_sentence} These figures are model forecasts from the HealthWatch "
        f"system and should be used for planning, not as medical guidance."
    )


def _tier_badge(tier: str) -> str:
    color = _TIER_HEX[tier]
    return (
        f'<span style="display:inline-block;font-family:Georgia,serif;font-size:11px;'
        f'letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;'
        f'color:#ffffff;background:{color};">{tier}</span>'
    )


def _sparkline_svg(values: list[float], tier: str) -> str:
    w, h = 320, 64
    pad = 4
    n = len(values)
    if n < 2:
        return ""
    vmax = max(values) if values else 1
    vmax = vmax or 1
    bar_w = (w - 2 * pad) / n
    tier_color = _TIER_HEX[tier]
    bars: list[str] = []
    for i, v in enumerate(values):
        bh = max(3, (v / vmax) * (h - 18))
        x = pad + i * bar_w
        y = h - 8 - bh
        color = tier_color if i == n - 1 else _ACCENT
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w - 2:.1f}" height="{bh:.1f}" '
            f'rx="1.5" fill="{color}" opacity="{1.0 if i == n - 1 else 0.55}"/>'
        )
    return (
        f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" '
        f'aria-label="Last 12 months">'
        f'<rect x="0" y="0" width="{w}" height="{h}" fill="#ffffff" rx="8"/>'
        f'{"".join(bars)}'
        f'</svg>'
    )


def _fmt(value: float) -> str:
    return f"{value:,.1f}"


def _arrow(trend: str) -> str:
    return {"up": "&#8593;", "down": "&#8595;", "stable": "&#8212;"}[trend]


def render_html(report: dict, email: str, manage_token: str, base_url: str) -> tuple[str, str]:
    """Return (subject, html) for the report. `manage_token` powers the
    one-click manage/unsubscribe link in the footer."""
    scope_suffix = report["scope_label"]
    subject = f"Your {report['month']} HealthWatch Forecast — {scope_suffix}"

    nat = report["national"]
    featured = report["regions"][: report["featured_count"]]

    region_cards = "".join(
        f"""
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid {_BORDER};">
          <span style="font-family:Georgia,serif;font-size:14px;color:{_INK};font-weight:700;">{html.escape(r["name"])}</span>
          <div style="font-size:11px;color:{_MUTED};letter-spacing:.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;margin-top:2px;">Forecast · risk tier {html.escape(r["tier"])}</div>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid {_BORDER};text-align:right;">
          <div style="font-family:Georgia,serif;font-size:18px;color:{_INK};font-weight:700;">{_fmt(r["value"])}</div>
          <div style="font-size:10px;color:{_MUTED};letter-spacing:.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">per 100k</div>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid {_BORDER};text-align:center;">{_tier_badge(r["tier"])}</td>
        <td style="padding:10px 14px;border-bottom:1px solid {_BORDER};text-align:center;">
          <span style="font-size:13px;color:{_MUTED};">{_arrow(r["trend"])}</span>
          <span style="display:block;font-size:10px;color:{_MUTED};letter-spacing:.06em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">{'+' if r['pct_change'] >= 0 else ''}{r['pct_change']}%</span>
        </td>
        <td style="padding:8px 14px;border-bottom:1px solid {_BORDER};">
          {_sparkline_svg(r["sparkline"], r["tier"])}
        </td>
      </tr>
    """
        for r in featured
    )

    hero_tier = nat["tier"] if report["scope"] == "all" else (featured[0]["tier"] if featured else "Low")

    html_doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:{_BG};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">{html.escape(report['scope_label'])} · {html.escape(report['illness_label'])} risk outlook for {html.escape(report['month'])}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{_BG};">
      <tr><td align="center" style="padding:28px 12px 40px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92vw;background:{_CARD};border:1px solid {_BORDER};border-radius:16px;overflow:hidden;">
          <!-- Brand -->
          <tr><td style="padding:22px 28px;border-bottom:1px solid {_BORDER};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:{_INK};">HEALTHWATCH</span>
                  <div style="font-size:10px;color:{_MUTED};letter-spacing:.14em;text-transform:uppercase;margin-top:2px;">Monthly Forecast Report</div>
                </td>
                <td align="right">
                  <span style="font-size:11px;color:{_MUTED};letter-spacing:.08em;text-transform:uppercase;">{html.escape(report['month'])}</span>
                </td>
              </tr>
            </table>
          </td></tr>

          <!-- Hero -->
          <tr><td style="padding:28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:11px;color:{_MUTED};letter-spacing:.12em;text-transform:uppercase;">{html.escape(report['illness_label'])} outlook</span>
                  <h1 style="margin:6px 0 4px;font-family:Georgia,serif;font-size:26px;line-height:1.15;color:{_INK};">{html.escape(report['scope_label'])}</h1>
                  {_tier_badge(hero_tier)}
                </td>
                <td align="right" valign="top">
                  <div style="font-family:Georgia,serif;font-size:34px;font-weight:700;color:{_INK};">{_fmt(nat['value'])}</div>
                  <div style="font-size:10px;color:{_MUTED};letter-spacing:.1em;text-transform:uppercase;margin-top:2px;">cases per 100k</div>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:{_INK};">
              {html.escape(_narrative(report))}
            </p>
          </td></tr>

          <!-- National strip -->
          <tr><td style="padding:18px 28px;background:{_BG};border-top:1px solid {_BORDER};border-bottom:1px solid {_BORDER};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px;color:{_MUTED};letter-spacing:.1em;text-transform:uppercase;">National outlook</td>
                <td align="center" style="font-size:11px;color:{_MUTED};letter-spacing:.1em;text-transform:uppercase;">Risk level</td>
                <td align="center" style="font-size:11px;color:{_MUTED};letter-spacing:.1em;text-transform:uppercase;">Trend vs 3 mo</td>
              </tr>
              <tr>
                <td style="padding-top:6px;font-family:Georgia,serif;font-size:20px;font-weight:700;color:{_INK};">{_fmt(nat['value'])} <span style="font-size:11px;color:{_MUTED};font-family:Arial,Helvetica,sans-serif;">per 100k</span></td>
                <td align="center" style="padding-top:6px;">{_tier_badge(nat['tier'])}</td>
                <td align="center" style="padding-top:6px;font-size:14px;color:{_MUTED};">{_arrow(nat['trend'])} <span style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;">{'+' if nat['pct_change'] >= 0 else ''}{nat['pct_change']}%</span></td>
              </tr>
            </table>
          </td></tr>

          <!-- Regions -->
          <tr><td style="padding:14px 28px 6px;">
            <span style="font-size:11px;color:{_MUTED};letter-spacing:.12em;text-transform:uppercase;">{html.escape(report['scope_label'])} — regional detail</span>
          </td></tr>
          <tr><td style="padding:6px 28px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              {region_cards}
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td align="center" style="padding:20px 28px 28px;">
            <a href="{html.escape(base_url)}" target="_blank"
               style="display:inline-block;background:{_ACCENT};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:.02em;text-decoration:none;padding:13px 30px;border-radius:999px;">
              View Full Forecast
            </a>
          </td></tr>

          <!-- Footer -->
          <tr><td style="padding:20px 28px;border-top:1px solid {_BORDER};">
            <p style="margin:0 0 12px;font-size:11px;line-height:1.5;color:{_MUTED};">
              You are receiving this because you subscribed to monthly HealthWatch forecast reports for
              <strong>{html.escape(report['scope_label'])}</strong>.
              Forecasts are generated monthly from DOH Epidemiology Bureau surveillance and model projections.
            </p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:{_MUTED};">
              <a href="{html.escape(base_url)}/subscribe-manage?token={html.escape(manage_token)}" style="color:{_ACCENT};text-decoration:underline;">Manage your subscription &amp; unsubscribe</a>
              &nbsp;·&nbsp; HealthWatch — Regional Outbreak Surveillance · Philippines
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""

    return subject, html_doc


# --------------------------------------------------------------------------
# Delivery (Resend or dry-run)
# --------------------------------------------------------------------------


def _from_address() -> str:
    raw = os.environ.get("RESEND_FROM", "").strip()
    if raw:
        return raw
    return "HealthWatch <onboarding@resend.dev>"


def send_report(email: str, report: dict, manage_token: str) -> dict:
    """Render and deliver the report for a subscription.

    Returns {"provider": "resend" | "dry-run", "to", "subject", "file": ...}.
    """
    base_url = os.environ.get("APP_URL", "https://healthwatch-ui.onrender.com").rstrip("/")
    subject, html_doc = render_html(report, email, manage_token, base_url)

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if api_key:
        from resend import Resend

        client = Resend(api_key=api_key)
        resp = client.Emails.send(
            {
                "from": _from_address(),
                "to": [email],
                "subject": subject,
                "html": html_doc,
            }
        )
        if getattr(resp, "id", None) is None:
            raise RuntimeError(f"Resend failed for {email}: {resp}")
        return {"provider": "resend", "to": email, "subject": subject}
    return _dry_run(email, subject, html_doc)


def _dry_run(email: str, subject: str, html_doc: str) -> dict:
    _OUTBOX_DIR.mkdir(parents=True, exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", email.lower()).strip("-") or "subscription"
    path = _OUTBOX_DIR / f"{pht_now().strftime('%Y%m%d-%H%M%S')}_{slug}.html"
    path.write_text(html_doc, encoding="utf-8")
    return {
        "provider": "dry-run",
        "to": email,
        "subject": subject,
        "file": str(path),
    }


def is_valid_email(email: str) -> bool:
    return bool(_EMAIL_RE.match(email))