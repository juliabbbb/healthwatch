import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Copy,
  Download,
  Maximize2,
  MoreHorizontal,
  Sparkles,
  Waves,
  TrendingUp,
  Info,
} from "lucide-react";
import { SeasonalityChartCard } from "@/components/hw/SeasonalityChartCard";
import { ChartExpandModal } from "@/components/hw/ChartExpandModal";
import { AIExplanationModal } from "@/components/hw/AIExplanationModal";
import {
  SeasonalityContextMenu,
  type ContextMenuAction,
  type ContextMenuAnchor,
} from "@/components/hw/SeasonalityContextMenu";
import { SeasonTag } from "@/components/hw/RiskBadge";
import { StatusChipRow } from "@/components/hw/StatusChip";
import { SettingsModal } from "@/components/hw/SettingsModal";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import {
  ILLNESSES,
  REGIONS,
  REGION_BY_CODE,
  acf,
  decompose,
  type SeasonalityComponent,
} from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

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
  const region = REGION_BY_CODE[code]!;

  // Right-click or CTA button tap → AI explanation workflow. Opt-in: when the setting is off,
  // choosing an AI action opens Settings instead and makes zero requests.
  const [aiEnabled] = useAiAnalysisSetting();
  const [menu, setMenu] = useState<ContextMenuAnchor | null>(null);
  const [explainComponent, setExplainComponent] = useState<SeasonalityComponent | null>(null);
  const [expandComponent, setExpandComponent] = useState<SeasonalityComponent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const decompData = useMemo(() => decompose(code, illness), [code, illness]);
  const acfData = useMemo(() => acf(code, illness, 24), [code, illness]);

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
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusChipRow
              items={["Prophet", "12-month centred MA trend", "ACF · lags 1–24", "Monthly data"]}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Seasonal Pattern Identification
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-3xl">
            Decompose any regional illness series into trend, seasonality and noise, then confirm
            the recurring annual cycle with 12-month autocorrelation indicators.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground shadow-xs">
          <Waves className="size-3.5 text-primary" /> {wetMonths} wet-season months ·{" "}
          {region.island}
        </span>
      </div>

      {/* Region & Disease Filters */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip key={r.code} active={code === r.code} onClick={() => setCode(r.code)}>
              {r.short}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={illness === "all"} onClick={() => setIllness("all")}>
            All illnesses
          </Chip>
          {ILLNESSES.map((i) => (
            <Chip key={i.id} active={illness === i.id} onClick={() => setIllness(i.id)}>
              {i.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* Summary KPI Metrics */}
      <div className="mt-6">
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
      <section className="mt-6 rounded-2xl border border-border/80 bg-card/30 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Trend / seasonality / noise
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {region.name} · {illness === "all" ? "all illnesses" : illness} · observed 2022–2026
              split into a 12-month centred moving-average trend, a month-of-year seasonal index and
              the irregular remainder.
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
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Observed series")}
            onExportCsv={exportCsv}
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
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Trend component")}
            onExportCsv={exportCsv}
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
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Seasonality component")}
            onExportCsv={exportCsv}
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
            onRequestAI={requestExplain}
            onExpand={setExpandComponent}
            onOpenMenu={(e, c) => openMenu(e, c, "Noise (residual)")}
            onExportCsv={exportCsv}
          />
        </div>
      </section>

      {/* 12-Month Cycle Indicators (ACF) with Dedicated AI Analysis */}
      <section className="mt-6 rounded-2xl border border-border/80 bg-card/30 p-4 sm:p-5 shadow-xs">
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
          onRequestAI={requestExplain}
          onExpand={setExpandComponent}
          onOpenMenu={(e, c) => openMenu(e, c, "12-month cycle indicators")}
          onExportCsv={exportCsv}
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
      <div className="mt-6">
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
    <div className="rounded-xl border border-border/80 bg-card/60 p-4 transition-all hover:border-border hover:bg-card/80">
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
        "rounded-full border px-3 py-1 text-[11px] capitalize transition-all cursor-pointer touch-manipulation",
        active
          ? "border-primary/60 bg-primary/20 text-primary font-semibold shadow-xs"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      )}
    >
      {children}
    </button>
  );
}
