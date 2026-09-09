# HEALTHWATCH — Implementation Plan 4 of 8
**Item:** Remove Top Badge/Tag Clutter on Seasonality Page 
**Execute this plan fully before moving to Plan 5.**

---

## ⚠️ STANDING DIRECTIVE — READ BEFORE EXECUTING ANYTHING

DO NOT touch, refactor, rename, restructure, or rewrite any file, component, function, variable, route, API endpoint, database schema, model, or configuration that is not explicitly listed in this plan.

This system is a live academic research tool (HealthWatch) with a validated forecasting pipeline and a live deployment on Render. Any unrequested change risks breaking the Prophet pipeline, the Supabase connection, the walk-forward evaluation results, the PDF export, or the deployment itself.

The rule is: if it is not in this plan, do not touch it. If you are unsure whether something is in scope, do not touch it. Stop and flag it instead.

All changes must be surgical, minimal, and scoped to the exact files described below.

---

## SYSTEM CONTEXT

HealthWatch is a regional public health decision-support tool for Philippine LGUs and the DOH. It forecasts dengue case volumes per region using Facebook Prophet with a wet/dry seasonal regressor, classifies each of the 18 Philippine regions (+ National aggregate) as Low / Moderate / High risk using P50/P75 percentile thresholds, and presents findings through a dashboard, map, seasonality page, compare page, and export module.

**Tech stack (frontend):** React 19 + Vite + TanStack Router + TanStack Query + Tailwind CSS 4 + Recharts + Leaflet + React PDF Renderer + TypeScript 5.8

**DO NOT touch:** FastAPI backend, Prophet pipeline, SQLAlchemy models, Supabase/PostgreSQL config, classification algorithm, evaluation logic, CSV export, routing config, render.yaml.

---

## ITEM 1 — Remove Top Visual Clutter on the Seasonality Page

### Goal
The Seasonality page currently has a row of pill/badge tags above the page title ("Seasonal Pattern Identification"). These tags — visible as: `PROPHET`, `12-MONTH CENTRED MA TREND`, `ACF - LAGS 1-24`, `MONTHLY DATA` — serve no functional purpose for end users (LGUs, DOH staff, healthcare administrators) and create visual noise. Remove them entirely.

### Step 1 — Locate the badge block
Open the Seasonality page component. In the JSX return, find the block of badge/chip/pill elements that appears above the page title (`<h1>` or equivalent heading). This block likely renders as a `<div>` containing multiple `<span>` or badge components with the text values listed above.

### Step 2 — Remove the badge block
Delete the entire JSX block containing the badge/pill elements and any wrapping container `<div>` that exists solely to hold them. If the wrapping `<div>` also wraps the page title or any other content, do not delete the wrapper — only delete the badge elements themselves.

### Step 3 — Do not remove anything else
- Do NOT remove the page title ("Seasonal Pattern Identification" or equivalent)
- Do NOT remove the FilterPanel
- Do NOT remove any chart, table, or data section
- Do NOT remove any import that is still used elsewhere in the file

### Step 4 — Check for orphaned imports
After removing the badge block, check if any imported component (e.g., a `<Badge>` component) is now unused in this file. If it is unused only because of this removal, remove that specific import line. Do not remove any other import.

### Verification
After this plan is complete:
- The Seasonality page opens with the page title as the topmost visible element (after the nav bar)
- No pill badges, tag rows, or label chips appear above the title
- All charts, filters, and functional content below the title are untouched and working