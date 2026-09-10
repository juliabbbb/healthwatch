import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartType } from "@/hooks/useChartType";
import {
  HIST_MONTHS,
  METRIC_META,
  REGION_BY_CODE,
  acf,
  decompose,
  metricValue,
  monthMeta,
  seriesFor,
  type MetricMode,
} from "@/lib/healthwatch/data";
import { formatMonthYear } from "@/utils/formatDate";

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--color-muted-foreground)", fontSize: "13px" },
};

interface Row {
  label: string;
  reported: number | null;
  predicted: number | null;
  bandBase: number | null;
  bandFill: number | null;
  yhatUpper: number | null;
  yhatLower: number | null;
  adjustedPoint: number | null;
  adjustReason?: string;
  season: string;
  index: number;
}

function ForecastTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  const value = row.reported ?? row.predicted ?? 0;
  return (
    <div className="glass-panel max-w-[15rem] rounded-md px-2.5 py-2" style={{ fontSize: "13px" }}>
      <p className="text-muted-foreground">
        {formatMonthYear(label ?? "")} · {row.season} season
      </p>
      <p className="mt-0.5 font-medium">
        {row.reported !== null ? "Reported" : "Predicted"}{" "}
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
      </p>
      {row.yhatLower !== null && row.yhatUpper !== null && (
        <p className="text-muted-foreground">
          95% CI {row.yhatLower.toLocaleString(undefined, { maximumFractionDigits: 1 })}–
          {row.yhatUpper.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </p>
      )}
      {row.adjustReason && (
        <p className="mt-1 leading-snug" style={{ color: "var(--risk-high)" }}>
          {row.adjustReason}
        </p>
      )}
    </div>
  );
}

/** Forecast chart with confidence band and season shading. */
export function ForecastChart({
  regionCode,
  illness,
  horizon,
  monthsBack = 36,
  height = 300,
  mode = "raw",
  chartType = "line",
}: {
  regionCode: string;
  illness: string;
  horizon: number;
  monthsBack?: number;
  height?: number;
  mode?: MetricMode;
  chartType?: ChartType;
}) {
  const isBar = chartType === "bar";
  const ChartComponent = isBar ? BarChart : ComposedChart;
  const series = seriesFor(regionCode, illness);

  if (!series.length) {
    return (
      <div
        className="glass-panel flex items-center justify-center rounded-lg text-muted-foreground text-sm"
        style={{ height }}
      >
        No forecast data available
      </div>
    );
  }

  const region = REGION_BY_CODE[regionCode]!;
  const conv = (v: number) => metricValue(v, region, mode);
  const clip = (v: number) => Math.max(0, v);
  const start = Math.max(0, HIST_MONTHS - monthsBack);
  const slice: Row[] = series.slice(start, HIST_MONTHS + horizon).map((p) => {
    const reported = p.forecast ? null : clip(conv(p.cases));
    const predicted = p.forecast ? clip(conv(p.cases)) : null;
    const yhatUpper = p.forecast ? clip(conv(p.upper)) : null;
    const yhatLower = p.forecast ? clip(conv(p.lower)) : null;
    const bandBase = yhatLower;
    const bandFill = yhatUpper !== null && yhatLower !== null ? yhatUpper - yhatLower : null;
    return {
      label: p.label,
      reported,
      predicted,
      bandBase,
      bandFill,
      yhatUpper,
      yhatLower,
      adjustedPoint: p.adjusted ? clip(conv(p.cases)) : null,
      ...(p.adjustReason ? { adjustReason: p.adjustReason } : {}),
      season: p.season,
      index: p.index,
    };
  });

  const wetBands: { x1: string; x2: string }[] = [];
  let open: string | null = null;
  slice.forEach((p, i) => {
    if (p.season === "wet" && !open) open = p.label;
    if ((p.season === "dry" || i === slice.length - 1) && open) {
      wetBands.push({ x1: open, x2: p.label });
      open = null;
    }
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={slice} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        {wetBands.map((b, i) => (
          <ReferenceArea
            key={i}
            x1={b.x1}
            x2={b.x2}
            fill="var(--wet)"
            fillOpacity={0.07}
            ifOverflow="extendDomain"
          />
        ))}
        <XAxis dataKey="label" {...axis} minTickGap={40} tickFormatter={formatMonthYear} />
        <YAxis {...axis} width={52} domain={[0, "auto"]} />
        <Tooltip
          content={<ForecastTooltip unit={METRIC_META[mode].unit} />}
          {...(isBar ? {} : { cursor: { stroke: "var(--border)" } })}
        />

        {isBar
          ? [
              <Bar
                key="reported"
                dataKey="reported"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                name="Reported"
                isAnimationActive={false}
              />,
              <Bar
                key="predicted"
                dataKey="predicted"
                fill="var(--chart-3)"
                radius={[4, 4, 0, 0]}
                name="Predicted"
                isAnimationActive={false}
              />,
            ]
          : [
              <Area
                key="bandBase"
                type="monotone"
                dataKey="bandBase"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                name="95% CI"
                stackId="band"
              />,
              <Area
                key="bandFill"
                type="monotone"
                dataKey="bandFill"
                stroke="none"
                fill="var(--chart-3)"
                fillOpacity={0.22}
                isAnimationActive={false}
                name="95% CI"
                stackId="band"
              />,
              <Line
                key="reported"
                dataKey="reported"
                stroke="var(--chart-1)"
                strokeWidth={1.6}
                dot={{
                  r: 2.5,
                  strokeWidth: 1.2,
                  fill: "var(--background)",
                  stroke: "var(--chart-1)",
                }}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: "var(--background)",
                  stroke: "var(--chart-1)",
                }}
                connectNulls
                name="Reported"
                isAnimationActive={false}
              />,
              <Line
                key="predicted"
                dataKey="predicted"
                stroke="var(--chart-3)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{
                  r: 2.5,
                  strokeWidth: 1.2,
                  fill: "var(--background)",
                  stroke: "var(--chart-3)",
                }}
                activeDot={{
                  r: 5,
                  strokeWidth: 2,
                  fill: "var(--background)",
                  stroke: "var(--chart-3)",
                }}
                connectNulls
                name="Predicted"
                isAnimationActive={false}
              />,
              // Rule-adjusted points: hollow markers, reason shown in the tooltip.
              <Line
                key="adjustedPoint"
                dataKey="adjustedPoint"
                stroke="none"
                name="Rule-adjusted"
                isAnimationActive={false}
                dot={{
                  r: 3.4,
                  fill: "var(--background)",
                  stroke: "var(--risk-high)",
                  strokeWidth: 1.4,
                }}
              />,
            ]}

        <ReferenceLine
          x={monthMeta(HIST_MONTHS - 1).label}
          stroke="var(--color-muted-foreground)"
          strokeDasharray="3 3"
          label={{
            value: "Forecast start",
            fill: "var(--color-muted-foreground)",
            fontSize: 12,
            position: "insideTopRight",
          }}
        />
      </ChartComponent>
    </ResponsiveContainer>
  );
}

/** STL-style decomposition: observed / trend / seasonal / residual. */
export function DecompositionChart({
  regionCode,
  illness,
  component,
  height = 150,
  endIndex,
  chartType = "line",
}: {
  regionCode: string;
  illness: string;
  component: "observed" | "trend" | "seasonal" | "residual";
  height?: number;
  endIndex?: number | undefined;
  chartType?: ChartType;
}) {
  const isBar = chartType === "bar";
  const ChartComponent = isBar ? BarChart : ComposedChart;
  const data = decompose(regionCode, illness, endIndex);
  const color =
    component === "trend"
      ? "var(--chart-2)"
      : component === "seasonal"
        ? "var(--chart-3)"
        : component === "residual"
          ? "var(--chart-4)"
          : "var(--chart-1)";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={60} tickFormatter={formatMonthYear} />
        <YAxis {...axis} width={52} />
        <Tooltip {...tooltipStyle} />
        {component === "residual" && (
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
        )}
        {isBar ? (
          <Bar dataKey={component} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        ) : (
          <Line
            dataKey={component}
            stroke={color}
            strokeWidth={component === "observed" ? 1 : 1.8}
            dot={{ r: 2.5, strokeWidth: 1.2, fill: "var(--background)", stroke: color }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "var(--background)", stroke: color }}
            isAnimationActive={false}
          />
        )}
      </ChartComponent>
    </ResponsiveContainer>
  );
}

/** Autocorrelation bars — the spike near lag 12 is the annual cycle. */
export function AcfChart({
  regionCode,
  illness,
  height = 160,
  endIndex,
  chartType = "bar",
}: {
  regionCode: string;
  illness: string;
  height?: number;
  endIndex?: number | undefined;
  chartType?: ChartType;
}) {
  const isBar = chartType === "bar";
  const ChartComponent = isBar ? BarChart : LineChart;
  const data = acf(regionCode, illness, 24, endIndex);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="lag" {...axis} minTickGap={14} />
        <YAxis {...axis} width={46} domain={[-1, 1]} />
        <Tooltip {...tooltipStyle} />
        <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
        <ReferenceLine x={12} stroke="var(--chart-3)" strokeDasharray="3 3" />
        {isBar ? (
          <Bar dataKey="value" fill="var(--chart-1)" isAnimationActive={false} />
        ) : (
          <Line
            dataKey="value"
            stroke="var(--chart-1)"
            strokeWidth={1.8}
            dot={{ r: 2.5, strokeWidth: 1.2, fill: "var(--background)", stroke: "var(--chart-1)" }}
            activeDot={{
              r: 5,
              strokeWidth: 2,
              fill: "var(--background)",
              stroke: "var(--chart-1)",
            }}
            isAnimationActive={false}
          />
        )}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
