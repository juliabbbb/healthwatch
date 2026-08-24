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
          "Trend, seasonality and noise decomposition with 52-week autocorrelation cycle indicators for Philippine regional illness surveillance series.",
      },
      { property: "og:title", content: "Seasonal Pattern Identification — HEALTHWATCH" },
      {
        property: "og:description",
        content:
          "Split any regional illness series into trend, seasonality and noise, and confirm the annual outbreak cycle with 52-week ACF indicators.",
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
    const a = acf(code, illness, 60);
    const seasonalVar = variance(d.map((p) => p.seasonal));
    const residualVar = variance(d.map((p) => p.residual));
    const trendVals = d.map((p) => p.trend);
    const strength = seasonalVar / (seasonalVar + residualVar || 1);
    const lag52 = a.find((p) => p.lag === 52)?.value ?? 0;
    const lag26 = a.find((p) => p.lag === 26)?.value ?? 0;
    const peak = a.reduce((best, p) => (p.value > best.value ? p : best), a[0]!);
    // Peak calendar week of the seasonal component.
    const byWeek = new Map<number, number>();
    d.forEach((p, i) => byWeek.set((i % 52) + 1, p.seasonal));
    let peakWeek = 1;
    let peakVal = -Infinity;
    byWeek.forEach((v, w) => {
      if (v > peakVal) {
        peakVal = v;
        peakWeek = w;
      }
    });
    const trendChange =
      trendVals.length > 104
        ? Math.round(
            ((trendVals.at(-1)! - trendVals[trendVals.length - 105]!) /
              (trendVals[trendVals.length - 105]! || 1)) *
              100,
          )
        : 0;
    const peakMonth = MONTHS[Math.min(11, Math.floor(((peakWeek - 1) / 52) * 12))]!;
    return { strength, lag52, lag26, peak, peakWeek, peakMonth, trendChange };
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
          <h1 className="text-3xl">Seasonal pattern identification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Decompose any regional illness series into trend, seasonality and noise, then confirm
            the recurring annual cycle with 52-week autocorrelation.
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
          label="ACF at lag 52"
          value={stats.lag52.toFixed(2)}
          sub={
            stats.lag52 > 0.4
              ? "Strong annual cycle confirmed"
              : "Weak annual cycle — check drivers"
          }
        />
        <Kpi
          label="Dominant cycle"
          value={`${stats.peak.lag} weeks`}
          sub={`Peak ACF ${stats.peak.value.toFixed(2)} · semi-annual (lag 26) ${stats.lag26.toFixed(2)}`}
        />
        <Kpi
          label="Typical peak"
          value={`Week ${stats.peakWeek}`}
          sub={`Around ${stats.peakMonth} · 2-year trend ${stats.trendChange >= 0 ? "+" : ""}${stats.trendChange}%`}
        />
      </div>

      <section
        className="mt-6 rounded-xl border border-border bg-card/40 p-4"
        onContextMenu={(e) => openMenu(e, "decomposition")}
      >
        <h2 className="text-lg">Trend / seasonality / noise</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          {region.name} · {illness === "all" ? "all illnesses" : illness} · observed 2017–2023 split
          into a 52-week centred moving-average trend, a week-of-year seasonal index and the
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
        <h2 className="text-lg">52-week cycle indicators</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Autocorrelation of the observed series against itself at increasing lags. A pronounced
          spike at lag 52 (marked) is the signature of a recurring annual outbreak cycle.
        </p>
        <AcfChart regionCode={code} illness={illness} height={200} />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <SeasonTag season="wet" />
          <span>
            Interpretation: lag 52 = {stats.lag52.toFixed(2)}, lag 26 = {stats.lag26.toFixed(2)}.
            Values above 0.4 at lag 52 indicate the series repeats reliably year over year, which is
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
      <p className="mt-1 text-2xl">{value}</p>
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
