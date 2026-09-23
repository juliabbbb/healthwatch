/**
 * explainRegistry.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Registry of known UI elements and their plain-language explanations.
 *
 * Each entry has:
 *   selector    — CSS selector used to match the clicked element (walks up DOM tree)
 *   title       — Short name of the element
 *   description — 1–3 sentence explanation shown in the inspector card
 *   icon        — lucide-react icon name string (rendered by ExplainOverlay)
 *
 * Entries are evaluated in order; specific component matches ALWAYS win before
 * generic section or page fallbacks.
 */

export interface ExplainEntry {
  selector: string;
  title: string;
  description: string;
  /** lucide-react icon name, e.g. "Map", "BarChart2". Defaults to "Info". */
  icon?: string;
}

export const EXPLAIN_REGISTRY: ExplainEntry[] = [
  // ── Explain mode button itself ────────────────────────────────────────────
  {
    selector: "#hw-tour-btn",
    title: "Explain Mode",
    icon: "HelpCircle",
    description:
      "That's this button! Click it to enter Explain Mode, then click anything on screen to learn what it does in plain language. Click it again or press Esc to exit.",
  },

  // ── Top navigation & header tools ─────────────────────────────────────────
  {
    selector: "input[aria-label='Search regions'], .hw-search-input, [data-explain='region-search']",
    title: "Region Search",
    icon: "Search",
    description:
      "Type a region name or PSGC code (e.g. \"NCR\", \"Davao\", \"Region III\") to instantly fly the map to that region and open its detailed forecast panel.",
  },
  {
    selector: "nav.glass-panel a, nav.glass-panel button, [data-explain='nav-links']",
    title: "Navigation Tabs",
    icon: "Navigation",
    description:
      "Switch between the primary views: Map (outbreak risk choropleth), Seasonality (monthly cycle charts per region), Compare (side-by-side region analysis), and Methodology (how forecasts are built).",
  },
  {
    selector: "button[aria-label='Switch to light mode'], button[aria-label='Switch to dark mode'], [data-explain='theme-toggle']",
    title: "Theme Toggle",
    icon: "Sun",
    description: "Switch between Dark and Light color themes. Your preference is saved locally in your browser.",
  },
  {
    selector: "button[aria-label='Settings'], [data-explain='settings-btn']",
    title: "Platform Settings",
    icon: "Settings",
    description:
      "Open the settings modal to configure local preferences, including toggling AI-assisted analysis and display settings.",
  },
  {
    selector: "button[aria-label='Share this view'], [data-explain='share-btn']",
    title: "Share Link",
    icon: "Share2",
    description:
      "Copies a shareable URL containing your exact active dashboard state (selected region, month, filters) to your clipboard.",
  },

  // ── Map Dashboard (homepage / root route) ──────────────────────────────────
  {
    selector: ".leaflet-container, #hw-map, [data-explain='map-canvas']",
    title: "Interactive Risk Choropleth Map",
    icon: "Map",
    description:
      "Color-coded map displaying dengue outbreak risk across all 18 Philippine regions for the selected month. Green = Low risk (below P50), Amber = Moderate (P50–P75), Red = High (above P75). Click any region to open its 12-month forecast drawer.",
  },
  {
    selector: ".leaflet-control-zoom, [data-explain='zoom-controls']",
    title: "Map Zoom Controls",
    icon: "ZoomIn",
    description: "Zoom the interactive map in or out. You can also pinch to zoom or drag with your mouse/finger to pan across islands.",
  },
  {
    selector: "#hw-legend-card, [data-explain='national-snapshot']",
    title: "National Snapshot Panel",
    icon: "BarChart2",
    description:
      "Displays the nationwide summary for the selected month: total projected incidence, regional risk distribution (number of regions in High / Moderate / Low risk), active filters, and per-capita toggles.",
  },
  {
    selector: "[aria-label='What these map colors mean'], [data-explain='risk-legend']",
    title: "Risk Tier Threshold Legend",
    icon: "Info",
    description:
      "Explains the statistical percentile thresholds used to classify risk: Low (below 50th percentile), Moderate (50th–75th percentile), and High (above 75th percentile), tailored per region and month.",
  },
  {
    selector: ".hw-alerts-panel, [data-alerts-panel], [data-explain='alerts-panel']",
    title: "Active Outbreak Alerts",
    icon: "AlertTriangle",
    description:
      "Highlights regions currently triggering seasonal outbreak alerts based on multi-year historical benchmarks. Click any alert item to fly directly to that region on the map.",
  },
  {
    selector: "[data-explain='forecast-metric-predicted']",
    title: "Predicted Case Count",
    icon: "TrendingUp",
    description:
      "The point prediction of reported dengue cases for the selected region and month, along with the 80% statistical confidence interval (CI).",
  },
  {
    selector: "[data-explain='forecast-metric-percentile']",
    title: "Historical Percentile Rank",
    icon: "Percent",
    description:
      "Compares the forecasted case level against historical records for the same month. A 75th percentile rank indicates cases are expected to exceed 75% of past years.",
  },
  {
    selector: "[data-explain='forecast-metric-change']",
    title: "3-Month Trend Change",
    icon: "Activity",
    description:
      "Percentage change in projected case volume compared to 3 months prior, indicating whether the outbreak wave is accelerating or subsiding.",
  },
  {
    selector: "#hw-forecast-card, [data-explain='forecast-card']",
    title: "Regional Forecast Panel",
    icon: "TrendingUp",
    description:
      "Shows a 12-month dengue case projection for the selected region generated by a Prophet time-series model. Includes monthly risk tier, projected numbers, 80% confidence interval, and seasonal outlook.",
  },
  {
    selector: "#hw-timeline, [data-explain='timeline-scrubber']",
    title: "Timeline Scrubber Control",
    icon: "Clock",
    description:
      "Drag the slider or click Play to animate dengue case patterns from 2022 through 2026. Grey markers represent historical DOH surveillance data; orange markers represent forward 12-month forecasts.",
  },

  // ── Seasonality Page ──────────────────────────────────────────────────────
  {
    selector: "[data-explain='view-toggle']",
    title: "Simple / Advanced Mode Toggle",
    icon: "Layers",
    description:
      "Switch between Simple view (plain-language summary + primary observed series chart) and Advanced view (all four time-series decomposition components, 12-month outlook strip, and autocorrelation statistics).",
  },
  {
    selector: "[data-explain='filter-panel']",
    title: "Analysis Filter Panel",
    icon: "Filter",
    description:
      "Adjust the target region, illness category, forecast horizon, and analysis timeline to inspect seasonal patterns for specific scenarios.",
  },
  {
    selector: "[data-explain='region-select']",
    title: "Region Selector",
    icon: "MapPin",
    description:
      "Select any of the 18 administrative regions of the Philippines. All charts, decomposition metrics, and seasonal summaries update instantly for the chosen region.",
  },
  {
    selector: "[data-explain='illness-filter']",
    title: "Illness Filter",
    icon: "Activity",
    description:
      "Filter by illness type. Dengue has dedicated Prophet time-series models; selecting 'All Illnesses' aggregates all available surveillance data.",
  },
  {
    selector: "[data-explain='forecast-chips']",
    title: "Forecast Horizon Chips",
    icon: "Calendar",
    description:
      "Sets the forward projection length (3, 6, or 12 months ahead). Shorter horizons have tighter confidence bounds; 12-month horizons cover the full annual cycle.",
  },
  {
    selector: "[data-explain='season-chips']",
    title: "Seasonality Filter",
    icon: "CloudRain",
    description:
      "Filter views by climate season: Wet Season (June–November monsoon months) vs Dry Season (December–May). Highlights peak vulnerability periods.",
  },
  {
    selector: "[data-explain='time-scrubber']",
    title: "Seasonality Time Scrubber",
    icon: "SlidersHorizontal",
    description:
      "Drag to shift the focus window across past historical data (2022–2025) or into the future 12-month forecast horizon.",
  },
  {
    selector: "[data-explain='simple-summary']",
    title: "Plain-Language Seasonal Summary",
    icon: "FileText",
    description:
      "A 2–3 sentence plain-language synthesis of this region's annual dengue rhythm, describing when cases surge, peak timing, and overall seasonal predictability.",
  },
  {
    selector: "[data-explain='simple-chart']",
    title: "Observed Cases Chart",
    icon: "BarChart2",
    description:
      "Monthly reported dengue case counts for the selected region. Displays actual surveillance records alongside the projected 12-month trend.",
  },
  {
    selector: "[data-explain='risk-outlook']",
    title: "12-Month Risk Outlook Strip",
    icon: "CalendarRange",
    description:
      "A color-coded 12-month outlook showing the predicted risk tier (Low / Moderate / High) for each upcoming month based on historical percentile cutoffs.",
  },
  {
    selector: "[data-explain='seasonality-chart-observed']",
    title: "Observed Series Chart",
    icon: "BarChart2",
    description:
      "Raw monthly dengue cases reported by the DOH Epidemiology Bureau from 2022 to the selected month. Shows real surveillance data prior to mathematical decomposition.",
  },
  {
    selector: "[data-explain='seasonality-chart-trend']",
    title: "Trend Component Chart",
    icon: "TrendingUp",
    description:
      "The underlying long-term trajectory of dengue cases with seasonal highs and lows smoothed out via a 12-month centred moving average.",
  },
  {
    selector: "[data-explain='seasonality-chart-seasonal']",
    title: "Seasonal Pattern Component",
    icon: "Waves",
    description:
      "The repeating annual rise-and-fall pattern driven by monsoon rainfall and temperature cycles. Highlights predictable yearly surge months.",
  },
  {
    selector: "[data-explain='seasonality-chart-residual']",
    title: "Residual Noise Component",
    icon: "Activity",
    description:
      "Unexplained fluctuations remaining after subtracting trend and seasonal components. Unusually large spikes signify unexpected outbreak anomalies.",
  },
  {
    selector: ".recharts-responsive-container, [data-explain='seasonality-chart']",
    title: "Decomposition Series Chart",
    icon: "BarChart2",
    description:
      "Interactive time-series chart showing the selected component (Observed, Trend, Seasonal, or Residual). Hover over data points for exact monthly case counts.",
  },
  {
    selector: "[data-explain='forecast-table']",
    title: "12-Month Detailed Breakdown Table",
    icon: "Table",
    description:
      "Tabular breakdown of forecasted cases per month, showing predicted count, lower/upper confidence bounds, climate season, and assigned risk tier.",
  },
  {
    selector: "[aria-label='Decomposition series tabs'], [data-explain='series-tabs']",
    title: "Decomposition Tabs",
    icon: "LayoutGrid",
    description:
      "Switch between time-series components: Observed cases, Trend, Seasonal rhythm, and Residual noise.",
  },
  {
    selector: "[data-kpi='seasonality-strength']",
    title: "Seasonality Strength (%)",
    icon: "Percent",
    description:
      "Percentage of month-to-month case variation explained strictly by the annual seasonal cycle. Higher values (e.g. 70%+) indicate highly predictable yearly surges.",
  },
  {
    selector: "[data-kpi='acf-lag12']",
    title: "ACF at 12-Month Lag",
    icon: "RefreshCw",
    description:
      "Autocorrelation at a 12-month lag. Values near 1.0 confirm that cases in any month closely mirror the same month in prior years, proving a strong annual cycle.",
  },
  {
    selector: "[data-kpi='dominant-cycle']",
    title: "Dominant Cycle Period",
    icon: "RotateCcw",
    description:
      "The primary repeating time period identified in the time series. A 12-month cycle confirms an annual pattern; a 6-month cycle indicates bi-annual peaks.",
  },
  {
    selector: "[data-kpi='typical-peak']",
    title: "Typical Peak Month",
    icon: "Calendar",
    description:
      "The calendar month when historical dengue transmission reaches its highest volume in this region. Critical for timing vector control interventions.",
  },
  {
    selector: "[data-explain='wet-dry-card']",
    title: "Wet vs. Dry Season Analysis",
    icon: "CloudRain",
    description:
      "Compares average monthly case volume between the Wet Season (June–Nov) and Dry Season (Dec–May), measuring rainfall-driven surge intensity.",
  },
  {
    selector: "button[title='Export a seasonal pattern analysis PDF'], [data-explain='pdf-export-btn']",
    title: "Export Seasonal Analysis PDF",
    icon: "FileDown",
    description:
      "Generates and downloads a complete PDF report containing all four decomposition charts, risk outlooks, and statistical metrics.",
  },

  // ── Compare Page ─────────────────────────────────────────────────────────
  {
    selector: "[data-explain='compare-select-a']",
    title: "Region A Selector",
    icon: "MapPin",
    description:
      "Select the first region to compare. Its forecast trend line, peak timing, and risk metrics will be plotted alongside Region B.",
  },
  {
    selector: "[data-explain='compare-select-b']",
    title: "Region B Selector",
    icon: "MapPin",
    description:
      "Select the second region to compare. Allows direct side-by-side evaluation of transmission volume and outbreak timing.",
  },
  {
    selector: "[data-explain='compare-chart']",
    title: "Comparative Time-Series Chart",
    icon: "GitCompare",
    description:
      "Dual line chart overlaying reported and forecasted cases for Region A vs. Region B, revealing differences in wave timing and surge magnitude.",
  },
  {
    selector: "[data-explain='compare-kpi-diff']",
    title: "Volume Difference Metric",
    icon: "BarChart2",
    description:
      "Quantifies the absolute difference in expected case burden between Region A and Region B for the selected forecast window.",
  },
  {
    selector: "[data-explain='compare-kpi-risk']",
    title: "Comparative Risk Tiers",
    icon: "AlertTriangle",
    description:
      "Compares the assigned risk level of both regions, highlighting which area requires higher priority allocation of health resources.",
  },
  {
    selector: "[data-explain='compare-kpi-correlation']",
    title: "Regional Correlation Score",
    icon: "Activity",
    description:
      "Measures how closely the outbreak timing of Region A mirrors Region B (Pearson correlation from -1.0 to +1.0). High positive correlation indicates synchronized outbreak waves.",
  },
  {
    selector: "[data-explain='compare-table']",
    title: "Side-by-Side Comparison Table",
    icon: "Table",
    description:
      "Month-by-month table comparing predicted case counts, confidence bounds, and risk tiers for both regions side-by-side.",
  },
  {
    selector: "[data-explain='compare-page']",
    title: "Regional Comparison View",
    icon: "GitCompare",
    description:
      "Compare dengue transmission dynamics, seasonal timing, and forecasted caseloads across any two Philippine regions side-by-side.",
  },

  // ── Methodology Page ─────────────────────────────────────────────────────
  {
    selector: "[id^='collapsible-trigger-'], [data-explain='collapsible-trigger']",
    title: "Methodology Section Header",
    icon: "ChevronDown",
    description:
      "Click to expand or collapse this documentation section. Topics cover DOH data sources, Prophet model specifications, risk tiers, and validation metrics.",
  },
  {
    selector: "[id^='collapsible-content-'], [data-explain='collapsible-content']",
    title: "Section Explanation Details",
    icon: "FileText",
    description:
      "Detailed technical documentation outlining data formulas, threshold definitions, baseline comparisons, and model limits.",
  },
  {
    selector: "[data-validation-panel], [data-explain='validation-panel']",
    title: "Model Validation Metrics Panel",
    icon: "CheckCircle",
    description:
      "Live accuracy metrics computed on historical holdout data: Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and Skill Score vs a naive baseline.",
  },
  {
    selector: "[data-explain='methodology-page']",
    title: "Data & Methodology Guide",
    icon: "BookOpen",
    description:
      "Comprehensive technical reference explaining how HealthWatch ingests DOH data, fits Prophet time-series models, classifies risk, and validates predictions.",
  },

  // ── Shared UI & Branding ──────────────────────────────────────────────────
  {
    selector: "button[aria-label='Open national surveillance overview']",
    title: "National Overview Drawer Pill",
    icon: "Globe",
    description:
      "On mobile devices, tap this pill to open the National Snapshot drawer displaying overall risk distribution and active alerts.",
  },
  {
    selector: "button[aria-label='Open mobile navigation menu'], button[aria-label='Open search']",
    title: "Mobile Navigation & Search",
    icon: "Menu",
    description:
      "Opens the navigation menu, search panel, or platform options when viewing on mobile screens.",
  },
  {
    selector: ".hw-logo, [data-hw-logo]",
    title: "HealthWatch Platform",
    icon: "Activity",
    description:
      "HealthWatch is an epidemiological time-series analysis and early-warning forecast system for seasonal dengue outbreaks in the Philippines.",
  },

  // ── Fallback Container Elements ─────────────────────────────────────────
  {
    selector: "[data-explain='seasonality-page']",
    title: "Seasonal Pattern Page",
    icon: "Waves",
    description:
      "This page decomposes regional dengue series into trend, seasonal, and residual components. Click specific charts, cards, or controls to inspect them.",
  },
  {
    selector: "[data-explain='methodology-page']",
    title: "Data & Methodology",
    icon: "BookOpen",
    description:
      "Technical documentation explaining DOH data ingestion, Prophet model setup, percentile risk tiers, and validation results.",
  },
  {
    selector: "main",
    title: "HealthWatch Dashboard",
    icon: "LayoutDashboard",
    description:
      "Main application workspace. Click on specific elements—map regions, forecast cards, charts, scrubbers, or metric pills—to learn what they show in plain language.",
  },
];
