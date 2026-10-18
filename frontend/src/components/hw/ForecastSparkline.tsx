import { useMemo } from "react";
import { CHART_COLORS } from "@/lib/chartConfig";
import type { RiskLevel } from "@/lib/healthwatch/data";

export interface SparklinePoint {
  /** Short month label, e.g. "Sep". */
  label: string;
  /** Full tooltip label, e.g. "Sep 2026". */
  month: string;
  yhat: number;
  lower: number;
  upper: number;
  risk: RiskLevel;
}

const VB_W = 300;
const VB_H = 96;
const PAD = { top: 14, right: 8, bottom: 18, left: 8 };

/**
 * Compact hand-rolled SVG sparkline (bars + dotted trend) so the map info
 * panel never pays for the lazy-loaded recharts bundle.
 */
export function ForecastSparkline({ data }: { data: SparklinePoint[] }) {
  const n = data.length;
  const plotW = VB_W - PAD.left - PAD.right;
  const plotH = VB_H - PAD.top - PAD.bottom;
  const slot = n > 0 ? plotW / n : plotW;

  const maxV = useMemo(() => Math.max(1, ...data.map((d) => d.yhat)), [data]);

  const barW = Math.min(26, slot * 0.55);
  const baselineY = VB_H - PAD.bottom;
  const linePoints = data
    .map((d, i) => {
      const x = PAD.left + i * slot + slot / 2;
      const y = PAD.top + plotH - (d.yhat / maxV) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full"
      role="img"
      aria-label="6-month forecast with 95% confidence interval"
    >
      <title>6-month forecast — hover bars for exact values</title>

      {/* Baseline */}
      <line
        x1={PAD.left}
        y1={baselineY}
        x2={VB_W - PAD.right}
        y2={baselineY}
        stroke={CHART_COLORS.gridLine}
        strokeWidth={1}
      />

      {/* Dotted trend through forecast values */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={CHART_COLORS.actual}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {data.map((d, i) => {
        const x = PAD.left + i * slot + slot / 2;
        const y = PAD.top + plotH - (d.yhat / maxV) * plotH;
        const h = Math.max(2, baselineY - y);
        const tooltip = `${d.month} — ${Math.round(d.yhat).toLocaleString()} cases (95% CI ${Math.round(
          d.lower,
        ).toLocaleString()}–${Math.round(d.upper).toLocaleString()}) · ${d.risk}`;
        return (
          <g key={i}>
            <rect
              x={x - barW / 2}
              y={y}
              width={barW}
              height={h}
              rx={3}
              fill={CHART_COLORS.primary}
            >
              <title>{tooltip}</title>
            </rect>
            <text
              x={x}
              y={VB_H - 5}
              textAnchor="middle"
              fontSize={9}
              fill={CHART_COLORS.axisLabel}
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}