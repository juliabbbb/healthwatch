/**
 * HEALTHWATCH chart design tokens.
 *
 * All values resolve to the app's design-system CSS variables (styles.css,
 * oklch token pairs) so charts follow light/dark theme and the
 * `Risk Reservation` rule automatically. Hardcoded hex values are
 * intentionally forbidden here — add a CSS token instead.
 */

export const CHART_COLORS = {
  // Forecast / primary series markers
  primary: "var(--chart-1)",
  actual: "var(--chart-2)",
  soft: "var(--chart-3)",
  trend: "var(--chart-4)",
  // Chart chrome
  gridLine: "var(--border)",
  axisLabel: "var(--color-muted-foreground)",
  tooltipBg: "var(--popover)",
  tooltipBorder: "var(--border)",
  // Risk tiers (risk data only — never repurpose for decorative series)
  low: "var(--risk-low)",
  moderate: "var(--risk-moderate)",
  high: "var(--risk-high)",
  lowSolid: "var(--risk-low-solid)",
  moderateSolid: "var(--risk-moderate-solid)",
  highSolid: "var(--risk-high-solid)",
  // Season shaders
  wet: "var(--wet)",
  dry: "var(--dry)",
} as const;

export interface AxisStyle {
  stroke: string;
  fontSize: number;
  tickLine: boolean;
  axisLine: boolean;
}

/** Shared minimalist axis styling for every Recharts axis. */
export const CHART_AXIS_STYLE: AxisStyle = {
  stroke: CHART_COLORS.axisLabel,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

/** Rounded-top bar radius used across all bar charts. */
export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** Prophet CI bounds are clipped to >= 0 upstream; guard the UI anyway. */
export function clampNonNeg(value: number): number {
  return Math.max(0, value);
}

/** Default y-domain floor so clipped series never paint below zero. */
export const CHART_Y_MIN = 0;