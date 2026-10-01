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
      "Color-coded map displaying disease outbreak risk across all 18 Philippine regions for the selected month. Green = Low risk (below P50), Amber = Moderate (P50–P75), Red = High (above P75). Click any region to open its 12-month forecast drawer.",
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
      "The point prediction of reported cases for the selected region and month, along with the 95% prediction interval.",
  },
  {
    selector: "[data-explain='forecast-metric-percentile']",
    title: "Historical Percentile Rank",
    icon: "Percent",
    description:
      "Where this region's case level sits among all 18 regions for the selected month. A 75th-percentile rank means 75% of regions are reporting fewer cases.",
  },
  {
    selector: "[data-explain='forecast-metric-change']",
    title: "3-Month Trend Change",
    icon: "Activity",
    description:
      "Percentage change in case volume compared to 3 months earlier, indicating whether the current wave is building or easing.",
  },
  {
    selector: "#hw-forecast-card, [data-explain='forecast-card']",
    title: "Regional Forecast Panel",
    icon: "TrendingUp",
    description:
      "Shows a 12-month case projection for the selected region generated by a Prophet time-series model. Includes monthly risk tier, projected numbers, a 95% prediction interval, and seasonal outlook.",
  },
  {
    selector: "#hw-timeline, [data-explain='timeline-scrubber']",
    title: "Timeline Scrubber Control",
    icon: "Clock",
    description:
      "Drag the slider or click Play to animate case patterns from 2019 through the forecast horizon into 2027. Grey markers represent historical DOH surveillance data; orange markers represent forward 12-month forecasts.",
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
      "Filter by illness type. Each disease has its own Prophet time-series model and risk tiers; selecting 'All Illnesses' shows a genuine per-month sum across all five diseases.",
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
    icon: "CalendarRange",
    description:
      "Filter views by calendar window: the June–November window vs the December–May window. These labels name the periods the pipeline groups months into; they are not a claim about rainfall or its effect on cases.",
  },
  {
    selector: "[data-explain='time-scrubber']",
    title: "Seasonality Time Scrubber",
    icon: "SlidersHorizontal",
    description:
      "Drag to shift the focus window across past historical data (2019–2026) or into the future 12-month forecast horizon.",
  },
  {
    selector: "[data-explain='simple-summary']",
    title: "Plain-Language Seasonal Summary",
    icon: "FileText",
    description:
      "A 2–3 sentence plain-language synthesis of this region's annual case rhythm, describing when case loads surge, peak timing, and overall seasonal predictability.",
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
      "Raw monthly reported cases from the DOH surveillance line-lists on the shared 2019–2026 calendar. Shows real surveillance data prior to mathematical decomposition.",
  },
  {
    selector: "[data-explain='seasonality-chart-trend']",
    title: "Trend Component Chart",
    icon: "TrendingUp",
    description:
      "The underlying long-term trajectory of reported cases with seasonal highs and lows smoothed out via a 12-month centred moving average.",
  },
  {
    selector: "[data-explain='seasonality-chart-seasonal']",
    title: "Seasonal Pattern Component",
    icon: "Waves",
    description:
      "The repeating annual rise-and-fall pattern: how much above or below the underlying trend cases run in each calendar month. Highlights the months that reliably carry the most cases.",
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
      "Tabular breakdown of forecasted cases per month, showing the predicted count, the lower and upper bounds of its 95% prediction interval, the calendar season, and the assigned risk tier.",
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
      "The calendar month when reported transmission reaches its highest volume in this region. Critical for timing response interventions.",
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
    selector: "[data-explain='compare-card-grid']",
    title: "Side-by-Side Regional Cards",
    icon: "LayoutGrid",
    description:
      "One card per selected region, showing its predicted volume, risk tier, and sparkline of the trend. Tap a card to open the full analysis for that region. Any number of regions can be selected at once.",
  },
  {
    selector: "[data-explain='compare-table']",
    title: "Benchmark Comparison Table",
    icon: "Table",
    description:
      "Every selected region in one row, ranked on risk tier, predicted cases with its 95% prediction interval, historical percentile, and 3-month change. Expand a row to read the recommended interventions.",
  },
  {
    selector:
      "input[aria-label='Temporal surveillance scrubber from -12 past months to +12 forecast months']",
    title: "Comparison Time Scrubber",
    icon: "Clock",
    description:
      "Shifts the whole comparison to a different month, from 12 months of reported history through to 12 months of forecast.",
  },
  {
    selector: "[data-explain='compare-page']",
    title: "Regional Comparison View",
    icon: "GitCompare",
    description:
      "Compare risk tier, forecast caseload and seasonal timing across any set of Philippine regions for the same month.",
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
      "HealthWatch is an epidemiological time-series analysis and early-warning forecast system for seasonal disease outbreaks in the Philippines.",
  },

  // ── Fallback Container Elements ─────────────────────────────────────────
  {
    selector: "[data-explain='seasonality-page']",
    title: "Seasonal Pattern Page",
    icon: "Waves",
    description:
      "This page decomposes regional disease series into trend, seasonal, and residual components. Click specific charts, cards, or controls to inspect them.",
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
