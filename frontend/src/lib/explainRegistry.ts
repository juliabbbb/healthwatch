/** Home-page tour copy shortened from the former explanation registry. */
export interface TourStep {
  id: string;
  target?: string;
  title: string;
  text: string;
  placement?: "top" | "bottom" | "left" | "right";
}

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to HealthWatch",
    text: "Explore regional illness risk, monthly forecasts and seasonal patterns. Use Next and Back, or the arrow keys, to move through this tour. Press Escape to leave at any time.",
  },
  {
    id: "map",
    target: "#hw-map",
    title: "Regional risk map",
    text: "The map shows the selected illness and month across Philippine regions. Green, amber and red represent Low, Moderate and High risk. Select a region after the tour to open its forecast panel.",
  },
  {
    id: "snapshot",
    target: "#hw-legend-card",
    title: "National snapshot",
    text: "Review the national summary, regional risk distribution and active filters for the selected month. The metric controls switch between case counts and per-capita values.",
    placement: "right",
  },
  {
    id: "illness",
    target: "[data-tour='illness-filter']",
    title: "Choose an illness",
    text: "Choose an illness to update the map and its related summaries. The selected illness also carries through to the region panel.",
    placement: "right",
  },
  {
    id: "legend",
    target: "[aria-label='What these map colors mean']",
    title: "Understand the map colours",
    text: "Risk tiers use historical percentile thresholds for each region and month: Low below P50, Moderate from P50 to P75, and High above P75.",
    placement: "right",
  },
  {
    id: "alerts",
    target: ".hw-alerts-panel",
    title: "Active alerts",
    text: "Review regions with seasonal outbreak alerts. After the tour, select an alert to focus on that region on the map.",
    placement: "right",
  },
  {
    id: "timeline",
    target: "#hw-timeline",
    title: "Move through time",
    text: "Move the slider to inspect historical reports and the forecast horizon. Play animates the monthly patterns.",
    placement: "top",
  },
  {
    id: "audience",
    target: "[data-explain='audience-mode']",
    title: "Choose your perspective",
    text: "Switch between Healthcare Worker and General Public views. Each perspective presents the relevant risk information and guidance.",
    placement: "bottom",
  },
  {
    id: "region",
    target: "#hw-forecast-card, [data-tour='region-card']",
    title: "Explore a region",
    text: "The region panel shows the selected month's status, risk tier and forecast outlook. Open More details for guidance and weather, or Open region analysis for further charts.",
    placement: "left",
  },
  {
    id: "replay",
    target: "#hw-tour-btn, [data-tour='replay-tour']",
    title: "Replay this tour",
    text: "Use the Explain Mode button to replay this tour from the beginning. Choose Done to return to the dashboard.",
    placement: "bottom",
  },
];
