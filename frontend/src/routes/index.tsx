import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Info, X } from "lucide-react";
import { TimelineScrubber } from "@/components/hw/TimelineScrubber";
import { TopToolbar } from "@/components/hw/TopToolbar";
import { ForecastCard } from "@/components/hw/ForecastCard";
import { NationalSnapshot } from "@/components/hw/NationalSnapshot";
import { AlertsPanel } from "@/components/hw/AlertsPanel";
import { CURRENT_WEEK_INDEX, REPORT_UPCOMING_SEASON, assessAll, weekMeta, type MetricMode, type Season } from "@/lib/healthwatch/data";
import { deriveAlerts } from "@/lib/healthwatch/alerts";

const MapCanvas = lazy(() => import("@/components/hw/MapCanvas"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HEALTHWATCH — PH Outbreak Hotspot Map & Forecasts" },
      {
        name: "description",
        content:
          "Regional time-series forecasting and hotspot classification for seasonal illness outbreaks across all 17 Philippine regions.",
      },
      { property: "og:title", content: "HEALTHWATCH — PH Outbreak Hotspot Map" },
      {
        property: "og:description",
        content:
          "Live choropleth of Low/Moderate/High outbreak risk per Philippine region with 12-week case forecasts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapView,
});

function MapView() {
  const [mounted, setMounted] = useState(false);
  const [illness, setIllness] = useState("all");
  const [weekIndex, setWeekIndex] = useState(CURRENT_WEEK_INDEX + 4);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>("130000000");
  const [flyTo, setFlyTo] = useState<string | null>(null);
  const [mode, setMode] = useState<MetricMode>("percapita");
  const [outbreakSeason, setOutbreakSeason] = useState<Season>(REPORT_UPCOMING_SEASON);

  useEffect(() => setMounted(true), []);

  const assessments = useMemo(
    () => assessAll(illness, weekIndex, mode),
    [illness, weekIndex, mode],
  );
  const counts = useMemo(() => {
    const c = { high: 0, moderate: 0, low: 0 };
    assessments.forEach((a) => (c[a.risk] += 1));
    return c;
  }, [assessments]);
  const alerts = useMemo(
    () => deriveAlerts(assessments, illness, outbreakSeason),
    [assessments, illness, outbreakSeason],
  );

  const totalCases = assessments.reduce((a, r) => a + r.point.cases, 0);
  const nationalPer100k =
    (totalCases / assessments.reduce((s, a) => s + a.region.population, 0)) * 100000;

  const meta = weekMeta(weekIndex);

  const handleSelect = useCallback((code: string) => setSelected(code), []);
  const handleFocusRegion = useCallback((code: string) => {
    setSelected(code);
    setFlyTo(code);
  }, []);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        {mounted && (
          <Suspense fallback={null}>
            <MapCanvas
              illness={illness}
              weekIndex={weekIndex}
              mode={mode}
              selectedCode={selected}
              onSelect={handleSelect}
              flyToCode={flyTo}
              outbreakSeason={outbreakSeason}
            />
          </Suspense>
        )}
      </div>

      {/* Top-Left Dock: National Snapshot (top) → Active Alerts */}
      <div className="pointer-events-none absolute left-4 top-4 z-[500] flex max-h-[calc(100vh-8.5rem)] flex-col items-start gap-2.5">
        <NationalSnapshot
          weekLabel={meta.label}
          isForecast={meta.forecast}
          value={mode === "raw" ? totalCases : nationalPer100k}
          mode={mode}
          onModeChange={setMode}
          illness={illness}
          onIllnessChange={setIllness}
          counts={counts}
          dominantIllness={assessments[0]?.dominantIllness.name ?? "—"}
        />

        <AlertsPanel alerts={alerts} onFocusRegion={handleFocusRegion} />
      </div>

      {/* Toolbar */}
      <div className="absolute right-4 top-4 z-[500]">
        <TopToolbar onPick={handleFocusRegion} />
      </div>

      {/* Legend popup — appears on load, auto-dismisses */}
      <LegendToast />

      {/* Forecast card (Regional Data side panel) */}
      {selected && (
        <div className="absolute right-4 top-[5.5rem] z-[500] max-h-[calc(100vh-11rem)] overflow-y-auto hw-scroll">
          <ForecastCard
            regionCode={selected}
            illness={illness}
            weekIndex={weekIndex}
            mode={mode}
            onModeChange={setMode}
            onClose={() => setSelected(null)}
            outbreakSeason={outbreakSeason}
            onOutbreakSeasonChange={setOutbreakSeason}
          />
        </div>
      )}

      {/* Repositioned Logo (Bottom-Left) */}
      <div className="pointer-events-none absolute left-4 bottom-20 z-[500]">
        <div className="glass-panel pointer-events-auto flex items-center gap-2.5 rounded-xl px-3 py-2">
          <Activity className="size-5 text-primary" />
          <div>
            <p className="text-sm font-semibold leading-none tracking-wide">HEALTHWATCH</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              DOH · LGU outbreak decision support
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="absolute inset-x-4 bottom-4 z-[500]">
        <TimelineScrubber
          weekIndex={weekIndex}
          onChange={setWeekIndex}
          playing={playing}
          onPlayingChange={setPlaying}
        />
      </div>
    </main>
  );
}

/** Small auto-dismissing legend popup shown on first load of the map view. */
function LegendToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-x-0 top-[4.5rem] z-[700] flex justify-center px-4">
      <div
        role="status"
        className="glass-panel flex max-w-md items-start gap-3 rounded-xl border border-border p-3 text-left shadow-lg"
      >
        <span
          className="mt-0.5 shrink-0 rounded-md p-1 text-primary"
          style={{ backgroundColor: "color-mix(in oklab, var(--primary), transparent 88%)" }}
        >
          <Info className="size-3.5" />
        </span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-foreground">Reading the map</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Colors show weekly risk tier (Low/Moderate/High). The alert marker shows a seasonal
            outbreak flag for the upcoming dry or wet season.
          </p>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss map legend"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
