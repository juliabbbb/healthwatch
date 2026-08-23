# Health Watch PH

PROJECT: HEALTHWATCH — Regional Time-Series Analysis System for Seasonal Illness Outbreak Prediction and Hotspot Classification (Philippines)

## CONTEXT

Build a web-based public health decision-support dashboard for the Philippines called HEALTHWATCH. It forecasts seasonal illness case volume (Dengue, Leptospirosis, Influenza-like Illness, Acute Gastroenteritis, Heat-related illness) per region and classifies each region into Low / Moderate / High outbreak risk hotspots, visualized on an interactive map. This is a DOH/LGU-facing tool built from public DOH surveillance data (2017–2023) and PAGASA seasonal indicators.

## DESIGN INSPIRATION

Model the visual style after https://zoom.earth/places/philippines/manila/ (see attached screenshot):

- Full-bleed dark interactive map as the primary canvas (Philippines-centered)

- Left collapsible sidebar with toggleable layers: "Live Maps" (Satellite/Radar equivalent → repurpose as "Data Layers": Case Density, Precipitation Risk, Temperature, Humidity, Hotspot Classification)

- Floating glassmorphic/dark translucent card (top-right) showing the selected region's name, a "Daily/Weekly Forecast" style list with risk icons and predicted case ranges, similar to Zoom Earth's temperature forecast card

- Bottom timeline scrubber (repurpose from time-of-day scrubber into a WEEK/SEASON scrubber — lets users scrub through historical weeks or forecast weeks and watch the choropleth map update)

- Minimal top-right icon toolbar (search regions, share/export, settings, layers, zoom controls)

- Dark theme, thin white/gray borders, orange/red/green accent colors for risk severity (green=low, yellow/orange=moderate, red=high)

## MAP / GEODATA REQUIREMENT

Use a free Philippines street/basemap since this is a PH-only tool:

- Basemap: Leaflet.js (or Mapbox GL JS) with OpenStreetMap tiles, centered on the Philippines (lat 12.8797, lng 121.7740), constrained bounds to PH territory

- Region boundaries / choropleth: Philippine Standard Geographic Code (PSGC) GeoJSON boundaries (province/region level) — source from PhilGIS or PSA PSGC GeoJSON datasets — to color-code each region by its computed risk classification (Low/Moderate/High)

- Region click/hover should open the forecast card (like clicking "Manila" in the reference screenshot) showing: region name, current week case estimate, 4-week forecast trend, risk badge, dominant illness type, and recommended intervention text

- Search bar to jump to any PH region/city (autocomplete against PSGC region names)

## GENERAL OBJECTIVE

Design, develop, and evaluate HEALTHWATCH: an integrated regional time-series system that captures seasonal illness patterns, forecasts upcoming outbreak case counts using epidemiological domain logic, classifies regions into risk-level hotspots, and visualizes predictions to support public health intervention planning.

## SPECIFIC OBJECTIVES (build features for each of these explicitly)

1. **Seasonal Pattern Identification** — Build a module/page that visualizes historical seasonal outbreak patterns, trends, and recurring illness cycles per region using line/area charts that decompose data into Trend, Seasonality (Wet: June–Nov / Dry: Dec–May per PAGASA), and Irregular/Noise components. Include ACF-style cycle indicators (recurring 52-week patterns).

2. **Case Volume Forecasting** — Build a forecasting view that displays the expected number of illness cases for a selected region over a 4-to-12 week horizon, with a confidence interval band on the chart, filterable by illness type (Dengue, Leptospirosis, ILI, Waterborne Diarrheal Disease, Acute Gastroenteritis, Heat-related illness) and by season.

3. **Hotspot Risk Classification** — Implement a classification engine/UI that categorizes each region as Low-, Moderate-, or High-risk based on predicted case counts vs. historical percentile thresholds (<50th = Low, 50th–75th = Moderate, >75th = High). Reflect this as color-coded badges and the choropleth map fill.

4. **Comparative Dashboard & Recommendations** — Build a dashboard page allowing side-by-side comparison of 2+ regions (charts + risk cards), filterable by region, illness type, and season, plus an "Intervention Recommendations" panel that surfaces suggested actions (e.g., vector-control deployment, vaccination drive, medical supply pre-positioning) based on risk level.

5. **Epidemiological Rule Integration** — Ensure all displayed predictions respect domain rules: non-negativity constraints (no negative case predictions), seasonal indicator flags (Wet/Dry season tags shown on charts), and historical intervention markers (annotate charts with past cleanup drives/vector-control/vaccination campaign dates pulled from historical records) so predictions read as realistic, annotated, and trustworthy — not raw abstract numbers.

## CORE APP STRUCTURE

- **Home/Map View**: Full PH map (Zoom Earth style) with region hotspot coloring + floating forecast card on region select + layer toggle sidebar + week/season timeline scrubber

- **Region Detail Page**: Trend/seasonality/noise decomposition charts, forecast chart with confidence band, risk badge, intervention history annotations, recommended actions

- **Compare Page**: Multi-region side-by-side comparison view

- **Data/Methodology Page**: Short explainer of data sources (DOH PIDSR surveillance, Mendeley PH disease + epidemiological datasets 2017–2023), model approach, and limitations (no real-time IoT/live hospital data; pilot regions only; excludes rare non-seasonal diseases)

## DATA MODEL (key fields to structure in the backend/database)

- Region (PSGC code, name, urban/rural classification, population density)

- Date/Week

- Illness type

- Reported case count (historical)

- Predicted case count + confidence interval (forecast)

- Season flag (Wet/Dry)

- Risk classification (Low/Moderate/High)

- Intervention events (type, date, region)

- Environmental indicators (historical monthly rainfall, avg seasonal temp)

## TECH NOTES

- Since the actual time-series forecasting (Prophet/SARIMA/XGBoost) and STL decomposition are Python-based, structure the app to consume pre-computed forecast/classification results via a backend table or API endpoint (e.g., Supabase table `forecasts` populated by an external Python pipeline or edge function), rather than running ML training in the browser.

- Use mock/seeded realistic data for Philippine regions initially (Dengue/Leptospirosis/ILI patterns with wet-season spikes) so the UI is fully functional and demoable before real DOH data is wired in.

- Keep the whole experience single-page-app style with fast client-side filtering, matching the responsive, snappy feel of the Zoom Earth reference.

Build this as a polished, presentation-ready prototype dashboard.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ph-healthwatch-predict.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/78c5d9a6-0a34-4451-aa30-8aa7227e0884).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
