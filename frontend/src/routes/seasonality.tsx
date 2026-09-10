import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type RefObject } from "react";
import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  Bot,
  Copy,
  Download,
  FileDown,
  History,
  Info,
  Loader2,
  Maximize2,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";
import {
  SeasonalityPdfDocument,
  type SeasonalityPdfChart,
} from "@/components/pdf/SeasonalityPdfDocument";
import { captureChartAsImage } from "@/utils/pdfChartExporter";
import { SeasonalityChartCard } from "@/components/hw/SeasonalityChartCard";
import { ChartExpandModal } from "@/components/hw/ChartExpandModal";
import { AIExplanationModal } from "@/components/hw/AIExplanationModal";
import {
  SeasonalityContextMenu,
  type ContextMenuAction,
  type ContextMenuAnchor,
} from "@/components/hw/SeasonalityContextMenu";
import { SeasonTag } from "@/components/hw/RiskBadge";
import { SettingsModal } from "@/components/hw/SettingsModal";
import { FilterPanel } from "@/components/FilterPanel";
import { SEASON_CONFIG } from "@/components/hw/ForecastCard";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import {
  CURRENT_MONTH_INDEX,
  ILLNESSES,
  REGIONS,
  REGION_BY_CODE,
  TOTAL_MONTHS,
  acf,
  decompose,
  monthMeta,
  type SeasonalityComponent,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/utils/formatDate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const Route = createFileRoute("/seasonality")({
  head: () => ({
    meta: [
      { title: "Seasonal Pattern Identification — HEALTHWATCH" },
      {
        name: "description",
        content:
          "Trend, seasonality and noise decomposition with 12-month autocorrelation cycle indicators for Philippine regional illness surveillance series.",
      },
      { property: "og:title", content: "Seasonal Pattern Identification — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "Split any regional illness series into trend, seasonality and noise, and confirm the annual outbreak cycle with 12-month ACF indicators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeasonalityPage,
});

function variance(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
}

export function SeasonalityPage() {
  const [code, setCode] = useState("130000000");
  const [illness, setIllness] = useState("all");
  const [horizon, setHorizon] = useState<number>(0);
  const region = REGION_BY_CODE[code]!;

  const monthIndex = Math.max(0, Math.min(TOTAL_MONTHS - 1, CURRENT_MONTH_INDEX + horizon));
  const currentMonth = monthMeta(monthIndex);
  const baselineMonth = monthMeta(CURRENT_MONTH_INDEX);
  const isHistorical = horizon < 0;
  const isCurrent = horizon === 0;
  const isForecast = horizon > 0;
  const currentSeasonLabel =
    currentMonth.season === "wet" ? SEASON_CONFIG.wet.display : SEASON_CONFIG.dry.display;

  // Right-click or CTA button tap → AI explanation workflow. Opt-in: when the setting is off,
  // choosing an AI action opens Settings instead and makes zero requests.
  const [aiEnabled] = useAiAnalysisSetting();
  const [menu, setMenu] = useState<ContextMenuAnchor | null>(null);
  const [explainComponent, setExplainComponent] = useState<SeasonalityComponent | null>(null);
  const [expandComponent, setExpandComponent] = useState<SeasonalityComponent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Refs to the five chart wrapper divs, used for PDF export capture.
  const chartRefs = {
    observed: useRef<HTMLDivElement>(null),
    trend: useRef<HTMLDivElement>(null),
    seasonal: useRef<HTMLDivElement>(null),
    residual: useRef<HTMLDivElement>(null),
    acf: useRef<HTMLDivElement>(null),
  };
  const [exporting, setExporting] = useState(false);

  const openMenu = (e: React.MouseEvent, section: string, title?: string) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;

    if (e.currentTarget && (!x || !y || e.type === "click")) {
      const rect = e.currentTarget.getBoundingClientRect();
      x = rect.left + Math.min(rect.width / 2, 120);
      y = rect.bottom + 4;
    }
    setMenu({ x, y, section, title });
  };

  const requestExplain = (component: SeasonalityComponent) => {
    if (!aiEnabled) {
      setSettingsOpen(true);
      return;
    }
    setExplainComponent(component);
  };

  const decompData = useMemo(
    () => decompose(code, illness, monthIndex),
    [code, illness, monthIndex],
  );
  const acfData = useMemo(() => acf(code, illness, 24, monthIndex), [code, illness, monthIndex]);

  const stats = useMemo(() => {
    const seasonalVar = variance(decompData.map((p) => p.seasonal));
    const residualVar = variance(decompData.map((p) => p.residual));
    const trendVals = decompData.map((p) => p.trend);
    const strength = seasonalVar / (seasonalVar + residualVar || 1);
    const lag12 = acfData.find((p) => p.lag === 12)?.value ?? 0;
    const lag6 = acfData.find((p) => p.lag === 6)?.value ?? 0;
    const peak = acfData.reduce((best, p) => (p.value > best.value ? p : best), acfData[0]!);

    // Peak calendar month of the seasonal component.
    const byMonth = new Map<number, number>();
    decompData.forEach((p, i) => byMonth.set((i % 12) + 1, p.seasonal));
    let peakMonthIdx = 1;
    let peakVal = -Infinity;
    byMonth.forEach((v, m) => {
      if (v > peakVal) {
        peakVal = v;
        peakMonthIdx = m;
      }
    });

    const trendChange =
      trendVals.length > 24
        ? Math.round(
            ((trendVals.at(-1)! - trendVals[trendVals.length - 25]!) /
              (trendVals[trendVals.length - 25]! || 1)) *
              100,
          )
        : 0;
    const peakMonth = MONTHS[Math.min(11, Math.max(0, peakMonthIdx - 1))]!;
    const latestObserved = decompData.at(-1)?.observed ?? 0;
    const residualStd = Math.round(Math.sqrt(residualVar));

    return {
      strength,
      lag12,
      lag6,
      peak,
      peakMonth,
      trendChange,
      latestObserved,
      residualStd,
    };
  }, [decompData, acfData]);

  const exportCsv = (comp: SeasonalityComponent) => {
    let csvContent = "";
    if (comp === "acf") {
      csvContent =
        "Lag_Months,Autocorrelation_Value,Region,Illness\n" +
        acfData.map((d) => `${d.lag},${d.value},"${region.name}","${illness}"`).join("\n");
    } else {
      csvContent =
        `Month_Label,${comp.toUpperCase()}_Value,Season,Region,Illness\n` +
        decompData
          .map(
            (d) =>
              `${d.label},${d[comp as keyof typeof d]},${d.season},"${region.name}","${illness}"`,
          )
          .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `healthwatch_${region.short}_${comp}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyDataJson = async (comp: SeasonalityComponent) => {
    let text = "";
    if (comp === "acf") {
      text = JSON.stringify(acfData, null, 2);
    } else {
      const rows = decompData.map((d) => ({
        month: d.label,
        [comp]: d[comp as keyof typeof d],
        season: d.season,
      }));
      text = JSON.stringify(rows, null, 2);
    }
    await navigator.clipboard.writeText(text);
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const chartDefs: { label: string; ref: RefObject<HTMLDivElement | null> }[] = [
        { label: "Observed series", ref: chartRefs.observed },
        { label: "Trend component", ref: chartRefs.trend },
        { label: "Seasonality component", ref: chartRefs.seasonal },
        { label: "Noise (residual)", ref: chartRefs.residual },
        { label: "Autocorrelation Function (ACF)", ref: chartRefs.acf },
      ];

      const charts: SeasonalityPdfChart[] = [];
      for (const def of chartDefs) {
        if (def.ref.current) {
          const imageDataUrl = await captureChartAsImage(def.ref.current);
          charts.push({ label: def.label, imageDataUrl });
        }
      }

      const now = new Date();
      const exportTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const illnessLabel = illness === "all" ? "all illnesses" : illness;

      const blob = await pdf(
        <SeasonalityPdfDocument
          regionName={region.name}
          illnessLabel={illnessLabel}
          forecastPeriod={{ start: monthMeta(0).label, end: currentMonth.label }}
          charts={charts}
          exportTimestamp={exportTimestamp}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `healthwatch_seasonality_${region.short}_report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Seasonality PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Build tailored menu actions based on the active anchor section / component
  const menuActions = useMemo((): ContextMenuAction[] => {
    if (!menu) return [];

    const isChartComponent = ["observed", "trend", "seasonal", "residual", "acf"].includes(
      menu.section,
    );

    if (isChartComponent) {
      const comp = menu.section as SeasonalityComponent;
      return [
        {
          id: `explain-${comp}`,
          label: "Explain with AI",
          hint: aiEnabled ? "Generates plain-language insight" : "Opens settings — AI is off",
          icon: Sparkles,
          run: () => requestExplain(comp),
        },
        {
          id: `expand-${comp}`,
          label: "Expand & Inspect",
          hint: "High-resolution view and statistics",
          icon: Maximize2,
          run: () => setExpandComponent(comp),
        },
        {
          id: `export-${comp}`,
          label: "Export to CSV",
          hint: "Download raw time series dataset",
          icon: Download,
          run: () => exportCsv(comp),
        },
        {
          id: `copy-${comp}`,
          label: "Copy JSON Data",
          hint: "Copy values to clipboard",
          icon: Copy,
          run: () => void copyDataJson(comp),
        },
      ];
    }

    if (menu.section === "kpis") {
      return [
        {
          id: "explain-kpis",
          label: "Explain Summary Metrics",
          hint: aiEnabled ? "AI summary of key seasonal indicators" : "Opens settings — AI is off",
          icon: Sparkles,
          run: () => requestExplain("observed"),
        },
        {
          id: "explain-seasonality",
          label: "Analyze Annual Rhythm",
          hint: aiEnabled ? "Deep dive into wet/dry cycle" : "Opens settings — AI is off",
          icon: Waves,
          run: () => requestExplain("seasonal"),
        },
      ];
    }

    // Default section menu (overview decomposition)
    return [
      {
        id: "explain-decomp",
        label: "Explain Full Decomposition",
        hint: aiEnabled ? undefined : "Opens settings — AI is off",
        icon: Sparkles,
        run: () => requestExplain("observed"),
      },
      {
        id: "pattern",
        label: "Analyze Seasonal Rhythm",
        hint: aiEnabled ? undefined : "Opens settings — AI is off",
        icon: Waves,
        run: () => requestExplain("seasonal"),
      },
    ];
  }, [menu, aiEnabled, decompData, acfData, region, illness]);

  // PAGASA defines the wet season as June–November (6 months).
  const wetMonths = 6;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 sm:px-6 py-8">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>

      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Seasonal Pattern Identification
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
            Decompose any regional illness series into trend, seasonality and noise, then confirm
            the recurring annual cycle with 12-month autocorrelation indicators.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
            <Waves className="size-3.5 text-primary" /> {wetMonths} wet-season months ·{" "}
            {region.island}
          </span>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shadow-xs disabled:opacity-50 disabled:hover:bg-primary/10"
            title="Export a seasonal pattern analysis PDF"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            <span className="hidden sm:inline">
              {exporting ? "Exporting…" : "Export Seasonal Report"}
            </span>
            <span className="sm:hidden">{exporting ? "Exporting…" : "Export"}</span>
          </button>
        </div>
      </div>

      {/* Unified Filter Panel */}
      <div className="mt-8">
        <FilterPanel
          regions={REGIONS}
          selectedRegions={[code]}
          onRegionToggle={(c) => setCode(c)}
          regionDropdown
          illnesses={ILLNESSES}
          selectedIllness={illness}
          onIllnessChange={setIllness}
          dateSliderSlot={
            <div className="glass-panel rounded-xl p-4 sm:p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Temporal Status Headline */}
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                    <SlidersHorizontal className="size-4" />
                  </div>
                  <div>
                    <p className="label-caps text-[10px] font-semibold">
                      Surveillance & Forecast Period
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-mono text-base font-bold text-foreground">
                        {formatMonthYear(currentMonth.label)}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                          isHistorical && "bg-secondary text-muted-foreground border-border",
                          isCurrent && "bg-primary/20 text-primary border-primary/40",
                          isForecast && "border-border",
                        )}
                        style={isForecast ? { color: "var(--dry)", backgroundColor: "color-mix(in oklab, var(--dry), transparent 85%)" } : undefined}
                      >
                        {isHistorical && `${Math.abs(horizon)}m past reported`}
                        {isCurrent && "Current baseline (Now)"}
                        {isForecast && `+${horizon}m forecast`}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor:
                            currentMonth.season === "wet" ? "var(--wet)" : "var(--dry)",
                          color: "#ffffff",
                        }}
                      >
                        {currentSeasonLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Slider Scrubber & Indicator Track */}
                <div className="flex flex-col gap-1.5 w-full md:max-w-md">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                    <span className="flex items-center gap-1">
                      <History className="size-3" />
                      <span>Past (-12m)</span>
                    </span>
                    <span
                      className={cn(
                        "transition-colors",
                        horizon === 0 ? "text-primary font-bold" : "text-muted-foreground",
                      )}
                    >
                      Now (0) · {formatMonthYear(baselineMonth.label)}
                    </span>
                    <span>Forecast (+12m)</span>
                  </div>

                  {/* Range slider with generous touch target for mobile */}
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={horizon}
                    onChange={(e) => setHorizon(Number(e.target.value))}
                    className="w-full accent-primary h-2.5 cursor-pointer bg-secondary rounded-lg my-1"
                    aria-label="Temporal surveillance scrubber from -12 past months to +12 forecast months"
                  />

                  {/* Quick Jump Buttons covering both Past and Future */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                    {[
                      { label: "-12m", val: -12 },
                      { label: "-6m", val: -6 },
                      { label: "-3m", val: -3 },
                      { label: "Now", val: 0 },
                      { label: "+3m", val: 3 },
                      { label: "+6m", val: 6 },
                      { label: "+12m", val: 12 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setHorizon(s.val)}
                        className={cn(
                          "rounded-md px-1.5 sm:px-2 py-1 text-[10px] font-mono font-medium transition-colors border min-w-[32px] text-center",
                          horizon === s.val
                            ? "border-primary bg-primary/15 text-primary font-bold shadow-xs"
                            : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </div>

      {/* Summary KPI Metrics */}
      <div className="mt-8">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="label-caps text-xs">Summary Metrics</p>
          <button
            onClick={(e) => openMenu(e, "kpis", "Summary Metrics")}
            aria-label="Open AI analysis options for summary metrics"
            className="flex items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary shadow-xs transition-all hover:bg-primary/20 active:scale-95 cursor-pointer touch-manipulation"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>AI Options</span>
            <MoreHorizontal className="size-3.5 text-primary/70" />
          </button>
        </div>
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onContextMenu={(e) => openMenu(e, "kpis", "Summary Metrics")}
        >
          <Kpi
            label="Seasonality strength"
            value={`${Math.round(stats.strength * 100)}%`}
            sub="var(seasonal) / (var(seasonal) + var(residual))"
          />
          <Kpi
            label="ACF at lag 12"
            value={stats.lag12.toFixed(2)}
            sub={
              stats.lag12 > 0.4
                ? "Strong annual cycle confirmed"
                : "Weak annual cycle — check drivers"
            }
          />
          <Kpi
            label="Dominant cycle"
            value={`${stats.peak.lag} months`}
            sub={`Peak ACF ${stats.peak.value.toFixed(2)} · semi-annual (lag 6) ${stats.lag6.toFixed(2)}`}
          />
          <Kpi
            label="Typical peak"
            value={stats.peakMonth}
            sub={`Median seasonal index · 2-year trend ${stats.trendChange >= 0 ? "+" : ""}${stats.trendChange}%`}
          />
        </div>
      </div>

      {/* 2x2 Decomposition Section with Per-Chart AI Analysis and Options */}
      <section className="mt-8 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Trend / seasonality / noise
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {region.name} · {illness === "all" ? "all illnesses" : illness} · window{" "}
              {formatMonthYear(monthMeta(0).label)} – {formatMonthYear(currentMonth.label)} split
              into a 12-month centred moving-average trend, a month-of-year seasonal index and the
              irregular remainder.
            </p>
          </div>
          <button
            onClick={(e) => openMenu(e, "decomposition", "Full Decomposition")}
            aria-label="Open AI analysis overview menu"
            className="flex items-center gap-1.5 rounded-lg border border-primary/45 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary shadow-xs transition-all hover:bg-primary/20 active:scale-95 shrink-0 cursor-pointer touch-manipulation"
          >
            <Sparkles className="size-3.5" />
            <span>AI Overview</span>
            <MoreHorizontal className="size-3.5 text-primary/70" />
          </button>
        </div>

        {/* 4 Dedicated Chart Cards Grid (1 col on mobile, 2 cols on lg) */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 1. Observed Series */}
          <SeasonalityChartCard
            regionCode={code}
            illness={illness}
            component="observed"
            title="Observed series"
            subtitle="Raw monthly surveillance records (2022–2026)"
            statBadge={{ label: "Latest", value: `${stats.latestObserved.toLocaleString()} cases` }}
            height={160}
            endIndex={monthIndex}
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Observed series")}
            onExportCsv={exportCsv}
            chartRef={chartRefs.observed}
          />

          {/* 2. Trend Component */}
          <SeasonalityChartCard
            regionCode={code}
            illness={illness}
            component="trend"
            title="Trend component"
            subtitle="12-month centred moving average filter"
            statBadge={{
              label: "2-yr change",
              value: `${stats.trendChange >= 0 ? "+" : ""}${stats.trendChange}%`,
            }}
            height={160}
            endIndex={monthIndex}
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Trend component")}
            onExportCsv={exportCsv}
            chartRef={chartRefs.trend}
          />

          {/* 3. Seasonality Component */}
          <SeasonalityChartCard
            regionCode={code}
            illness={illness}
            component="seasonal"
            title="Seasonality component"
            subtitle="Month-of-year recurring seasonal index"
            statBadge={{ label: "Peak month", value: stats.peakMonth }}
            height={160}
            endIndex={monthIndex}
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Seasonality component")}
            onExportCsv={exportCsv}
            chartRef={chartRefs.seasonal}
          />

          {/* 4. Noise (Residual) */}
          <SeasonalityChartCard
            regionCode={code}
            illness={illness}
            component="residual"
            title="Noise (residual)"
            subtitle="Irregular remainder after subtracting trend and season"
            statBadge={{ label: "Std dev", value: `±${stats.residualStd}` }}
            height={160}
            endIndex={monthIndex}
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Noise (residual)")}
            onExportCsv={exportCsv}
            chartRef={chartRefs.residual}
          />
        </div>
      </section>

      {/* 12-Month Cycle Indicators (ACF) with Dedicated AI Analysis */}
      <section className="mt-8 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              12-month cycle indicators
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Autocorrelation of the observed series against itself at increasing lags. A pronounced
              spike at lag 12 (marked) is the signature of a recurring annual outbreak cycle.
            </p>
          </div>
        </div>

        <SeasonalityChartCard
          regionCode={code}
          illness={illness}
          component="acf"
          title="Autocorrelation Function (ACF)"
          subtitle="Lags 1 to 24 months (dashed line = lag 12 annual mark)"
          statBadge={{ label: "Lag 12 ACF", value: stats.lag12.toFixed(2) }}
          height={200}
          endIndex={monthIndex}
          onRequestAI={requestExplain}
          onExpand={setExpandComponent}
          onOpenMenu={(e, c) => openMenu(e, c, "12-month cycle indicators")}
          onExportCsv={exportCsv}
          chartRef={chartRefs.acf}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <SeasonTag season="wet" />
          <span>
            Interpretation: lag 12 = {stats.lag12.toFixed(2)}, lag 6 = {stats.lag6.toFixed(2)}.
            Values above 0.4 at lag 12 indicate the series repeats reliably year over year, which is
            what the forecast's seasonal-naive-with-drift baseline exploits.
          </span>
        </div>
      </section>

      {/* Footer Navigation */}
      <div className="mt-8">
        <Link
          to="/region/$code"
          params={{ code }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Open {region.short} forecast detail
        </Link>
      </div>

      {/* Context / Options Menu */}
      <SeasonalityContextMenu anchor={menu} actions={menuActions} onClose={() => setMenu(null)} />

      {/* Expanded Chart Diagnostics Modal */}
      <ChartExpandModal
        open={expandComponent !== null}
        onOpenChange={(open) => {
          if (!open) setExpandComponent(null);
        }}
        regionCode={code}
        illness={illness}
        component={expandComponent}
        endIndex={monthIndex}
        onRequestAI={requestExplain}
      />

      {/* AI Explanation Modal */}
      <AIExplanationModal
        open={explainComponent !== null}
        onOpenChange={(open) => {
          if (!open) setExplainComponent(null);
        }}
        regionShort={region.short}
        regionName={region.name}
        component={explainComponent ?? "seasonal"}
        illness={illness}
      />

      {/* Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="glass-panel rounded-xl p-5 transition-all hover:border-border">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs capitalize transition-all cursor-pointer touch-manipulation",
        active
          ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      {children}
    </button>
  );
}
