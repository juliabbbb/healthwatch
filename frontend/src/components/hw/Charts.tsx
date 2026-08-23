import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HIST_WEEKS,
  METRIC_META,
  REGION_BY_CODE,
  acf,
  decompose,
  metricValue,
  seriesFor,
  weekMeta,
  type MetricMode,
} from "@/lib/healthwatch/data";

const axis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--color-muted-foreground)", fontSize: "10px" },
};

interface Row {
  label: string;
  reported: number | null;
  predicted: number | null;
  band: [number, number] | null;
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
    <div className="glass-panel max-w-[15rem] rounded-md px-2.5 py-2 text-[11px]">
      <p className="text-muted-foreground">
        {label} · {row.season} season
      </p>
      <p className="mt-0.5 font-medium">
        {row.reported !== null ? "Reported" : "Predicted"}{" "}
        {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
      </p>
      {row.band && (
        <p className="text-muted-foreground">
          95% CI {row.band[0].toLocaleString(undefined, { maximumFractionDigits: 1 })}–
          {row.band[1].toLocaleString(undefined, { maximumFractionDigits: 1 })}
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
  weeksBack = 78,
  height = 300,
  mode = "raw",
}: {
  regionCode: string;
  illness: string;
  horizon: number;
  weeksBack?: number;
  height?: number;
  mode?: MetricMode;
}) {
  const series = seriesFor(regionCode, illness);
  const region = REGION_BY_CODE[regionCode]!;
  const conv = (v: number) => metricValue(v, region, mode);
  const start = Math.max(0, HIST_WEEKS - weeksBack);
  const slice: Row[] = series.slice(start, HIST_WEEKS + horizon).map((p) => ({
    label: p.label,
    reported: p.forecast ? null : conv(p.cases),
    predicted: p.forecast ? conv(p.cases) : null,
    band: p.forecast ? [conv(p.lower), conv(p.upper)] : null,
    adjustedPoint: p.adjusted ? conv(p.cases) : null,
    ...(p.adjustReason ? { adjustReason: p.adjustReason } : {}),
    season: p.season,
    index: p.index,
  }));

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
      <ComposedChart data={slice} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
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
        <XAxis dataKey="label" {...axis} minTickGap={40} />
        <YAxis {...axis} width={52} domain={[0, "auto"]} />
        <Tooltip
          content={<ForecastTooltip unit={METRIC_META[mode].unit} />}
          cursor={{ stroke: "var(--border)" }}
        />

        <Area
          dataKey="band"
          stroke="none"
          fill="var(--chart-3)"
          fillOpacity={0.22}
          isAnimationActive={false}
          name="95% CI"
        />
        <Line
          dataKey="reported"
          stroke="var(--chart-1)"
          strokeWidth={1.6}
          dot={false}
          connectNulls
          name="Reported"
          isAnimationActive={false}
        />
        <Line
          dataKey="predicted"
          stroke="var(--chart-3)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
          name="Predicted"
          isAnimationActive={false}
        />
        {/* Rule-adjusted points: hollow markers, reason shown in the tooltip. */}
        <Line
          dataKey="adjustedPoint"
          stroke="none"
          name="Rule-adjusted"
          isAnimationActive={false}
          dot={{ r: 3.4, fill: "var(--background)", stroke: "var(--risk-high)", strokeWidth: 1.4 }}
        />

        <ReferenceLine
          x={weekMeta(HIST_WEEKS - 1).label}
          stroke="var(--color-muted-foreground)"
          strokeDasharray="3 3"
          label={{
            value: "Forecast start",
            fill: "var(--color-muted-foreground)",
            fontSize: 9,
            position: "insideTopRight",
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** STL-style decomposition: observed / trend / seasonal / residual. */
export function DecompositionChart({
  regionCode,
  illness,
  component,
  height = 150,
}: {
  regionCode: string;
  illness: string;
  component: "observed" | "trend" | "seasonal" | "residual";
  height?: number;
}) {
  const data = decompose(regionCode, illness);
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
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={60} />
        <YAxis {...axis} width={52} />
        <Tooltip {...tooltipStyle} />
        {component === "residual" && (
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
        )}
        <Line
          dataKey={component}
          stroke={color}
          strokeWidth={component === "observed" ? 1 : 1.8}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Autocorrelation bars — the spike near lag 52 is the annual cycle. */
export function AcfChart({
  regionCode,
  illness,
  height = 160,
}: {
  regionCode: string;
  illness: string;
  height?: number;
}) {
  const data = acf(regionCode, illness, 60);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="lag" {...axis} minTickGap={14} />
        <YAxis {...axis} width={46} domain={[-1, 1]} />
        <Tooltip {...tooltipStyle} />
        <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
        <ReferenceLine x={52} stroke="var(--chart-3)" strokeDasharray="3 3" />
        <Bar dataKey="value" fill="var(--chart-1)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
