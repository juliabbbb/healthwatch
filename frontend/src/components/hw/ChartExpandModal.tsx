import { useState } from "react";
import {
  Copy,
  Check,
  Download,
  Sparkles,
  Info,
  TrendingUp,
  Activity,
  Waves,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecompositionChart, AcfChart } from "@/components/hw/Charts";
import { REGION_BY_CODE, decompose, acf, type SeasonalityComponent } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

const COMPONENT_METADATA: Record<
  SeasonalityComponent,
  {
    title: string;
    badge: string;
    color: string;
    formula: string;
    description: string;
    interpretation: string;
  }
> = {
  observed: {
    title: "Observed Historical Series",
    badge: "Raw Series",
    color: "var(--chart-1)",
    formula: "y_t = T_t + S_t + R_t",
    description:
      "The recorded monthly dengue case counts as reported by the DOH Epidemiology Bureau surveillance system (2022–2026).",
    interpretation:
      "Shows actual reported monthly incidence across historical months. Combines underlying multi-year baseline trends, annual wet-season outbreak cycles, and random sporadic shocks.",
  },
  trend: {
    title: "Centred Moving-Average Trend (T_t)",
    badge: "12-Month Trend",
    color: "var(--chart-2)",
    formula: "T_t = 1/12 ( 0.5 y_{t-6} + y_{t-5} + ... + y_{t+5} + 0.5 y_{t+6} )",
    description:
      "A 12-month centred moving average filter that smooths away annual seasonal cycles and irregular monthly noise.",
    interpretation:
      "Reveals whether long-term endemic dengue transmission is structurally rising, falling, or remaining stable over multi-year periods independently of seasonal weather peaks.",
  },
  seasonal: {
    title: "Month-of-Year Seasonal Index (S_t)",
    badge: "Seasonal Rhythm",
    color: "var(--chart-3)",
    formula: "S_m = avg_{years}( y_{m,year} - T_{m,year} )  with  sum(S_m) = 0",
    description:
      "The recurring month-by-month deviation from the multi-year baseline trend, representing the climatological outbreak cycle.",
    interpretation:
      "Peaks during the Philippine wet season (typically July–October) due to increased mosquito breeding habitats, and troughs during the dry months (January–April).",
  },
  residual: {
    title: "Irregular Remainder / Noise (R_t)",
    badge: "Residual Noise",
    color: "var(--chart-4)",
    formula: "R_t = y_t - T_t - S_t",
    description:
      "The unexplained variance remaining after subtracting the smoothed trend and the repeating seasonal cycle from the observed data.",
    interpretation:
      "Represents unexpected outbreaks, localized weather anomalies (such as typhoons or floods), reporting delays, or unmodeled intervention campaigns. Centred around zero.",
  },
  acf: {
    title: "Autocorrelation Function (ACF)",
    badge: "Annual Cycle",
    color: "var(--chart-1)",
    formula: "r_k = sum((y_t - y_bar)(y_{t-k} - y_bar)) / sum((y_t - y_bar)^2)",
    description:
      "Correlation of the surveillance series with itself at time lags from 1 to 24 months, diagnosing recurring periodicity.",
    interpretation:
      "A prominent peak at lag 12 (and lag 24) confirms a strong, repeating 12-month annual outbreak cycle that powers reliable seasonal forecasting.",
  },
};

export function ChartExpandModal({
  open,
  onOpenChange,
  regionCode,
  illness,
  component,
  onRequestAI,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regionCode: string;
  illness: string;
  component: SeasonalityComponent | null;
  onRequestAI?: (component: SeasonalityComponent) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "data" | "methodology">("chart");

  if (!component) return null;
  const meta = COMPONENT_METADATA[component];
  if (!meta) return null;

  const region = REGION_BY_CODE[regionCode];
  const decompData = decompose(regionCode, illness);
  const acfData = acf(regionCode, illness, 24);

  // Compute key stats for this component
  const stats = (() => {
    if (component === "acf") {
      const peakLag = acfData.reduce((best, p) => (p.value > best.value ? p : best), acfData[0]!);
      const lag12 = acfData.find((p) => p.lag === 12)?.value ?? 0;
      const lag6 = acfData.find((p) => p.lag === 6)?.value ?? 0;
      return [
        {
          label: "Lag 12 ACF",
          value: lag12.toFixed(3),
          hint: lag12 > 0.4 ? "Strong annual cycle" : "Moderate cycle",
        },
        { label: "Lag 6 ACF", value: lag6.toFixed(3), hint: "Semi-annual relationship" },
        {
          label: "Dominant Cycle",
          value: `${peakLag.lag} months`,
          hint: `Peak ACF ${peakLag.value.toFixed(3)}`,
        },
        { label: "Lags Tested", value: `${acfData.length} months`, hint: "1–24 month range" },
      ];
    }

    const values = decompData.map((d) => d[component as keyof typeof d] as number);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const meanVal = Math.round(values.reduce((a, b) => a + b, 0) / (values.length || 1));
    const latestVal = values.at(-1) ?? 0;

    return [
      {
        label: "Latest Value",
        value: latestVal.toLocaleString(),
        hint: decompData.at(-1)?.label ?? "",
      },
      {
        label: "Series Average",
        value: meanVal.toLocaleString(),
        hint: "Mean across observed months",
      },
      {
        label: "Range (Min / Max)",
        value: `${minVal.toLocaleString()} — ${maxVal.toLocaleString()}`,
        hint: `Span: ${(maxVal - minVal).toLocaleString()}`,
      },
      {
        label: "Months Analyzed",
        value: `${values.length} months`,
        hint: `${decompData[0]?.label} → ${decompData.at(-1)?.label}`,
      },
    ];
  })();

  const downloadCsv = () => {
    let csvContent = "";
    if (component === "acf") {
      csvContent =
        "Lag_Months,Autocorrelation_Value,Region,Illness\n" +
        acfData
          .map((d) => `${d.lag},${d.value},"${region?.name ?? regionCode}","${illness}"`)
          .join("\n");
    } else {
      csvContent =
        `Month_Label,${component.toUpperCase()}_Value,Season,Region,Illness\n` +
        decompData
          .map(
            (d) =>
              `${d.label},${d[component as keyof typeof d]},${d.season},"${region?.name ?? regionCode}","${illness}"`,
          )
          .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `healthwatch_${region?.short ?? regionCode}_${component}_data.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = async () => {
    let text = "";
    if (component === "acf") {
      text = JSON.stringify(acfData, null, 2);
    } else {
      const rows = decompData.map((d) => ({
        month: d.label,
        [component]: d[component as keyof typeof d],
        season: d.season,
      }));
      text = JSON.stringify(rows, null, 2);
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-black/50 backdrop-blur-sm"
        className="z-[600] glass-panel max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-border/80 p-6 shadow-2xl"
      >
        <DialogHeader className="space-y-1 pr-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shadow-xs"
                style={{ backgroundColor: meta.color }}
              />
              <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {meta.badge}
              </span>
              <span className="text-xs text-muted-foreground">
                {region?.name} ({region?.short}) · {illness === "all" ? "All illnesses" : illness}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onRequestAI && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onRequestAI(component);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs transition-all hover:bg-primary/25 hover:border-primary/80 active:scale-95 cursor-pointer"
                >
                  <Sparkles className="size-3.5" />
                  <span>Explain with AI</span>
                </button>
              )}
              <button
                type="button"
                onClick={downloadCsv}
                title="Download CSV dataset"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                type="button"
                onClick={copyToClipboard}
                title="Copy series JSON to clipboard"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                {copied ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {meta.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {meta.description}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Tabs */}
        <div className="mt-4 flex border-b border-border/80">
          <button
            type="button"
            onClick={() => setActiveTab("chart")}
            className={cn(
              "px-3.5 py-2 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
              activeTab === "chart"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Activity className="size-3.5" />
            <span>Interactive Chart</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("methodology")}
            className={cn(
              "px-3.5 py-2 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
              activeTab === "methodology"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Info className="size-3.5" />
            <span>Methodology & Formula</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={cn(
              "px-3.5 py-2 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
              activeTab === "data"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <TrendingUp className="size-3.5" />
            <span>Data Points ({component === "acf" ? acfData.length : decompData.length})</span>
          </button>
        </div>

        {/* Tab 1: High-res Chart & Stats */}
        {activeTab === "chart" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-inner">
              {component === "acf" ? (
                <AcfChart regionCode={regionCode} illness={illness} height={280} />
              ) : (
                <DecompositionChart
                  regionCode={regionCode}
                  illness={illness}
                  component={component as "observed" | "trend" | "seasonal" | "residual"}
                  height={280}
                />
              )}
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map((st, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/50 p-3">
                  <p className="label-caps text-[10px] text-muted-foreground">{st.label}</p>
                  <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                    {st.value}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{st.hint}</p>
                </div>
              ))}
            </div>

            {/* Interpretation Note */}
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/90">
              <Waves className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <span className="font-semibold text-primary">Epidemiological Interpretation: </span>
                <span>{meta.interpretation}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Formula & Mathematical Method */}
        {activeTab === "methodology" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Mathematical Definition
              </h3>
              <div className="mt-2 rounded-lg bg-black/40 p-3 font-mono text-xs text-emerald-300 overflow-x-auto border border-border/50">
                {meta.formula}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {meta.description}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card/50 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Role in HEALTHWATCH Surveillance & Forecasting
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {meta.interpretation}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <AlertCircle className="size-3.5 text-primary" />
                <span>
                  Computed deterministically from monthly DOH surveillance without synthetic
                  interpolation.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Data Table */}
        {activeTab === "data" && (
          <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-card/50">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card/90 backdrop-blur-xs border-b border-border text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-2.5">{component === "acf" ? "Lag (Months)" : "Month"}</th>
                  <th className="p-2.5 text-right">Value</th>
                  {component !== "acf" && <th className="p-2.5">Season</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                {component === "acf"
                  ? acfData.map((d) => (
                      <tr key={d.lag} className="hover:bg-secondary/40">
                        <td className="p-2.5 text-foreground">Lag {d.lag}</td>
                        <td className="p-2.5 text-right text-primary font-semibold">
                          {d.value.toFixed(3)}
                        </td>
                      </tr>
                    ))
                  : decompData.map((d) => (
                      <tr key={d.index} className="hover:bg-secondary/40">
                        <td className="p-2.5 text-foreground">{d.label}</td>
                        <td className="p-2.5 text-right text-primary font-semibold">
                          {(d[component as keyof typeof d] as number).toLocaleString()}
                        </td>
                        <td className="p-2.5 capitalize text-muted-foreground">{d.season}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
