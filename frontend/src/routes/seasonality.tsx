import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Bot, Waves } from "lucide-react";
import { AcfChart, DecompositionChart } from "@/components/hw/Charts";
import { AIExplanationModal, type SeasonalityComponent } from "@/components/hw/AIExplanationModal";
import {
  SeasonalityContextMenu,
  type ContextMenuAction,
  type ContextMenuAnchor,
} from "@/components/hw/SeasonalityContextMenu";
import { SeasonTag } from "@/components/hw/RiskBadge";
import { StatusChipRow } from "@/components/hw/StatusChip";
import { SettingsModal } from "@/components/hw/SettingsModal";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";
import { ILLNESSES, REGIONS, REGION_BY_CODE, acf, decompose } from "@/lib/healthwatch/data";
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

function SeasonalityPage() {
  const [code, setCode] = useState("130000000");
  const [illness, setIllness] = useState("all");
  const region = REGION_BY_CODE[code]!;

  // Right-click → AI explanation workflow. Opt-in: when the setting is off,
  // choosing an AI action opens Settings instead and makes zero requests.
  const [aiEnabled] = useAiAnalysisSetting();
  const [menu, setMenu] = useState<ContextMenuAnchor | null>(null);
  const [explainComponent, setExplainComponent] = useState<SeasonalityComponent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openMenu = (e: React.MouseEvent, section: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, section });
  };

  const requestExplain = (component: SeasonalityComponent) => {
    if (!aiEnabled) {
      setSettingsOpen(true);
      return;
    }
    setExplainComponent(component);
  };

  const sectionComponent: Record<string, SeasonalityComponent> = {
    kpis: "observed",
    decomposition: "observed",
    acf: "acf",
  };

  const menuActions: ContextMenuAction[] = [
    {
      id: "explain",
      label: "Explain chart with AI",
      hint: aiEnabled ? undefined : "Opens settings — AI is off",
      icon: Bot,
      run: () => requestExplain(menu ? (sectionComponent[menu.section] ?? "observed") : "observed"),
    },
    {
      id: "pattern",
      label: "Analyze seasonal pattern",
      hint: aiEnabled ? undefined : "Opens settings — AI is off",
      icon: Waves,
      run: () => requestExplain("seasonal"),
    },
  ];

  const stats = useMemo(() => {
    const d = decompose(code, illness);
    const a = acf(code, illness, 24);
    const seasonalVar = variance(d.map((p) => p.seasonal));
    const residualVar = variance(d.map((p) => p.residual));
    const trendVals = d.map((p) => p.trend);
    const strength = seasonalVar / (seasonalVar + residualVar || 1);
    const lag12 = a.find((p) => p.lag === 12)?.value ?? 0;
    const lag6 = a.find((p) => p.lag === 6)?.value ?? 0;
    const peak = a.reduce((best, p) => (p.value > best.value ? p : best), a[0]!);
    // Peak calendar month of the seasonal component.
    const byMonth = new Map<number, number>();
    d.forEach((p, i) => byMonth.set((i % 12) + 1, p.seasonal));
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
    return { strength, lag12, lag6, peak, peakMonth, trendChange };
  }, [code, illness]);

  // PAGASA defines the wet season as June–November (6 months).
  const wetMonths = 6;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to map
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusChipRow
              items={["Prophet", "12-month centred MA trend", "ACF · lags 1–24", "Monthly data"]}
            />
          </div>
          <h1 className="text-3xl">Seasonal pattern identification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Decompose any regional illness series into trend, seasonality and noise, then confirm
            the recurring annual cycle with 12-month autocorrelation.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
          <Waves className="size-3.5" /> {wetMonths} wet-season months · {region.island}
        </span>
      </div>

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

      <div
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onContextMenu={(e) => openMenu(e, "kpis")}
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

      <section
        className="mt-6 rounded-xl border border-border bg-card/40 p-4"
        onContextMenu={(e) => openMenu(e, "decomposition")}
      >
        <h2 className="text-lg">Trend / seasonality / noise</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          {region.name} · {illness === "all" ? "all illnesses" : illness} · observed 2022–2026 split
          into a 12-month centred moving-average trend, a month-of-year seasonal index and the
          irregular remainder.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(
            [
              ["observed", "Observed series"],
              ["trend", "Trend component"],
              ["seasonal", "Seasonality component"],
              ["residual", "Noise (residual)"],
            ] as const
          ).map(([c, title]) => (
            <div key={c}>
              <p className="label-caps mb-1">{title}</p>
              <DecompositionChart regionCode={code} illness={illness} component={c} height={160} />
            </div>
          ))}
        </div>
      </section>

      <section
        className="mt-6 rounded-xl border border-border bg-card/40 p-4"
        onContextMenu={(e) => openMenu(e, "acf")}
      >
        <h2 className="text-lg">12-month cycle indicators</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Autocorrelation of the observed series against itself at increasing lags. A pronounced
          spike at lag 12 (marked) is the signature of a recurring annual outbreak cycle.
        </p>
        <AcfChart regionCode={code} illness={illness} height={200} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <SeasonTag season="wet" />
          <span>
            Interpretation: lag 12 = {stats.lag12.toFixed(2)}, lag 6 = {stats.lag6.toFixed(2)}.
            Values above 0.4 at lag 12 indicate the series repeats reliably year over year, which is
            what the forecast's seasonal-naive-with-drift baseline exploits.
          </span>
        </div>
      </section>

      <div className="mt-6">
        <Link
          to="/region/$code"
          params={{ code }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
        >
          Open {region.short} forecast detail
        </Link>
      </div>

      <SeasonalityContextMenu anchor={menu} actions={menuActions} onClose={() => setMenu(null)} />
      <AIExplanationModal
        open={explainComponent !== null}
        onOpenChange={(open) => {
          if (!open) setExplainComponent(null);
        }}
        regionShort={region.short}
        regionName={region.name}
        component={explainComponent ?? "seasonal"}
      />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="label-caps">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
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
        "rounded-full border px-3 py-1 text-[11px] capitalize transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
